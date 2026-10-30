/**
 * Minimal, dependency-free PDF object layer.
 *
 * The importer may not add third-party runtime dependencies, so the PDF
 * syntax is parsed here directly (Cos objects, cross-reference tables, object
 * streams, Flate/ASCII filters, PNG predictors). Everything is defensive: a
 * malformed file yields a specific error code instead of an exception.
 */

import { inflateRawSync, inflateSync } from 'node:zlib';

import { ImporterFailure } from '../errors.js';

export type PdfDict = { readonly kind: 'dict'; readonly map: ReadonlyMap<string, PdfObject> };
export type PdfArray = { readonly kind: 'array'; readonly items: readonly PdfObject[] };
export type PdfName = { readonly kind: 'name'; readonly name: string };
export type PdfNumber = { readonly kind: 'number'; readonly value: number };
export type PdfString = { readonly kind: 'string'; readonly bytes: Uint8Array };
export type PdfRef = { readonly kind: 'ref'; readonly num: number; readonly gen: number };
export type PdfBool = { readonly kind: 'bool'; readonly value: boolean };
export type PdfNull = { readonly kind: 'null' };
export type PdfStream = {
  readonly kind: 'stream';
  readonly dict: PdfDict;
  /** Still-encoded bytes between `stream` and `endstream`. */
  readonly raw: Uint8Array;
};

export type PdfObject =
  | PdfDict
  | PdfArray
  | PdfName
  | PdfNumber
  | PdfString
  | PdfRef
  | PdfBool
  | PdfNull
  | PdfStream;

export const PDF_NULL: PdfNull = { kind: 'null' };
export const PDF_TRUE: PdfBool = { kind: 'bool', value: true };
export const PDF_FALSE: PdfBool = { kind: 'bool', value: false };

export function dictGet(dict: PdfDict | PdfStream | null, key: string): PdfObject | null {
  if (dict === null) return null;
  const map = dict.kind === 'stream' ? dict.dict.map : dict.map;
  return map.get(key) ?? null;
}

export function asDict(value: PdfObject | null): PdfDict | null {
  if (value === null) return null;
  if (value.kind === 'dict') return value;
  if (value.kind === 'stream') return value.dict;
  return null;
}

export function asArray(value: PdfObject | null): PdfArray | null {
  return value !== null && value.kind === 'array' ? value : null;
}

export function asNumber(value: PdfObject | null): number | null {
  return value !== null && value.kind === 'number' ? value.value : null;
}

export function asName(value: PdfObject | null): string | null {
  return value !== null && value.kind === 'name' ? value.name : null;
}

export function asStringBytes(value: PdfObject | null): Uint8Array | null {
  return value !== null && value.kind === 'string' ? value.bytes : null;
}

export function asRef(value: PdfObject | null): PdfRef | null {
  return value !== null && value.kind === 'ref' ? value : null;
}

export function dictNumber(dict: PdfDict | PdfStream | null, key: string): number | null {
  return asNumber(dictGet(dict, key));
}

export function dictName(dict: PdfDict | PdfStream | null, key: string): string | null {
  return asName(dictGet(dict, key));
}

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

export function isPdfWhitespace(byte: number): boolean {
  return WHITESPACE.has(byte);
}

export function isPdfDelimiter(byte: number): boolean {
  return DELIMITERS.has(byte);
}

function isRegular(byte: number): boolean {
  return !WHITESPACE.has(byte) && !DELIMITERS.has(byte);
}

/** Cursor over a byte buffer shared by the object parser and content scanner. */
export class ByteCursor {
  readonly bytes: Uint8Array;
  pos: number;

  constructor(bytes: Uint8Array, pos = 0) {
    this.bytes = bytes;
    this.pos = pos;
  }

  get eof(): boolean {
    return this.pos >= this.bytes.length;
  }

  peek(offset = 0): number {
    return this.bytes[this.pos + offset] ?? -1;
  }

  skipWhitespace(): void {
    while (!this.eof) {
      const byte = this.bytes[this.pos];
      if (byte === 0x25) {
        // Comment: skip to end of line.
        while (!this.eof && this.bytes[this.pos] !== 0x0a && this.bytes[this.pos] !== 0x0d) this.pos += 1;
        continue;
      }
      if (!isPdfWhitespace(byte)) return;
      this.pos += 1;
    }
  }

  readRegularToken(): string {
    const start = this.pos;
    while (!this.eof && isRegular(this.bytes[this.pos])) this.pos += 1;
    return latin1Decode(this.bytes.subarray(start, this.pos));
  }
}

export function latin1Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

export function latin1Encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** Parses one direct object at the cursor position. */
export function parseObject(cursor: ByteCursor, depth = 0): PdfObject {
  if (depth > 64) throw ImporterFailure.of('PDF_CORRUPT');
  cursor.skipWhitespace();
  if (cursor.eof) throw ImporterFailure.of('PDF_CORRUPT');
  const byte = cursor.bytes[cursor.pos];
  if (byte === 0x2f) return parseName(cursor);
  if (byte === 0x28) return parseLiteralString(cursor);
  if (byte === 0x3c) return cursor.peek(1) === 0x3c ? parseDictOrStream(cursor, depth) : parseHexString(cursor);
  if (byte === 0x5b) return parseArray(cursor, depth);
  if (byte === 0x30 + 0 || byte === 0x2b || byte === 0x2d || byte === 0x2e) return parseNumberOrRef(cursor);
  if (byte >= 0x30 && byte <= 0x39) return parseNumberOrRef(cursor);
  const token = cursor.readRegularToken();
  if (token === 'true') return PDF_TRUE;
  if (token === 'false') return PDF_FALSE;
  if (token === 'null') return PDF_NULL;
  if (token.length === 0) {
    cursor.pos += 1;
    return parseObject(cursor, depth + 1);
  }
  throw ImporterFailure.of('PDF_CORRUPT');
}

function parseName(cursor: ByteCursor): PdfName {
  cursor.pos += 1; // '/'
  let name = '';
  while (!cursor.eof) {
    const byte = cursor.bytes[cursor.pos];
    if (!isRegular(byte)) break;
    if (byte === 0x23 && cursor.pos + 2 < cursor.bytes.length) {
      const hex = latin1Decode(cursor.bytes.subarray(cursor.pos + 1, cursor.pos + 3));
      name += String.fromCharCode(Number.parseInt(hex, 16));
      cursor.pos += 3;
      continue;
    }
    name += String.fromCharCode(byte);
    cursor.pos += 1;
  }
  return { kind: 'name', name };
}

function parseNumberOrRef(cursor: ByteCursor): PdfObject {
  const token = cursor.readRegularToken();
  const value = Number(token);
  if (!Number.isFinite(value)) throw ImporterFailure.of('PDF_CORRUPT');
  // A reference is "<num> <gen> R"; only look ahead for positive integers.
  if (Number.isInteger(value) && value >= 0 && !token.includes('.')) {
    const save = cursor.pos;
    cursor.skipWhitespace();
    const genToken = cursor.readRegularToken();
    if (/^\d+$/.test(genToken)) {
      cursor.skipWhitespace();
      if (cursor.peek() === 0x52) {
        // 'R'
        cursor.pos += 1;
        return { kind: 'ref', num: value, gen: Number(genToken) };
      }
    }
    cursor.pos = save;
  }
  return { kind: 'number', value };
}

function parseLiteralString(cursor: ByteCursor): PdfString {
  cursor.pos += 1; // '('
  const out: number[] = [];
  let nesting = 1;
  while (!cursor.eof) {
    const byte = cursor.bytes[cursor.pos];
    cursor.pos += 1;
    if (byte === 0x5c) {
      if (cursor.eof) break;
      const esc = cursor.bytes[cursor.pos];
      cursor.pos += 1;
      switch (esc) {
        case 0x6e: out.push(0x0a); break;
        case 0x72: out.push(0x0d); break;
        case 0x74: out.push(0x09); break;
        case 0x62: out.push(0x08); break;
        case 0x66: out.push(0x0c); break;
        case 0x28: out.push(0x28); break;
        case 0x29: out.push(0x29); break;
        case 0x5c: out.push(0x5c); break;
        case 0x0d:
          if (!cursor.eof && cursor.bytes[cursor.pos] === 0x0a) cursor.pos += 1;
          break;
        case 0x0a:
          break;
        default:
          if (esc >= 0x30 && esc <= 0x37) {
            let octal = esc - 0x30;
            for (let i = 0; i < 2 && !cursor.eof; i += 1) {
              const digit = cursor.bytes[cursor.pos];
              if (digit < 0x30 || digit > 0x37) break;
              octal = octal * 8 + (digit - 0x30);
              cursor.pos += 1;
            }
            out.push(octal & 0xff);
          } else {
            out.push(esc);
          }
          break;
      }
      continue;
    }
    if (byte === 0x28) nesting += 1;
    if (byte === 0x29) {
      nesting -= 1;
      if (nesting === 0) break;
    }
    out.push(byte);
  }
  return { kind: 'string', bytes: Uint8Array.from(out) };
}

function parseHexString(cursor: ByteCursor): PdfString {
  cursor.pos += 1; // '<'
  let hex = '';
  while (!cursor.eof) {
    const byte = cursor.bytes[cursor.pos];
    cursor.pos += 1;
    if (byte === 0x3e) break;
    if (isPdfWhitespace(byte)) continue;
    hex += String.fromCharCode(byte);
  }
  if (hex.length % 2 === 1) hex += '0';
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const value = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    bytes[i] = Number.isFinite(value) ? value : 0;
  }
  return { kind: 'string', bytes };
}

function parseArray(cursor: ByteCursor, depth: number): PdfArray {
  cursor.pos += 1; // '['
  const items: PdfObject[] = [];
  for (;;) {
    cursor.skipWhitespace();
    if (cursor.eof) throw ImporterFailure.of('PDF_CORRUPT');
    if (cursor.peek() === 0x5d) {
      cursor.pos += 1;
      break;
    }
    items.push(parseObject(cursor, depth + 1));
  }
  return { kind: 'array', items };
}

function parseDictOrStream(cursor: ByteCursor, depth: number): PdfObject {
  cursor.pos += 2; // '<<'
  const map = new Map<string, PdfObject>();
  for (;;) {
    cursor.skipWhitespace();
    if (cursor.eof) throw ImporterFailure.of('PDF_CORRUPT');
    if (cursor.peek() === 0x3e && cursor.peek(1) === 0x3e) {
      cursor.pos += 2;
      break;
    }
    const key = parseObject(cursor, depth + 1);
    if (key.kind !== 'name') throw ImporterFailure.of('PDF_CORRUPT');
    cursor.skipWhitespace();
    const value = parseObject(cursor, depth + 1);
    map.set(key.name, value);
  }
  const dict: PdfDict = { kind: 'dict', map };
  // A stream keyword may follow the dictionary.
  const save = cursor.pos;
  cursor.skipWhitespace();
  const keyword = latin1Decode(cursor.bytes.subarray(cursor.pos, cursor.pos + 6));
  if (keyword !== 'stream') {
    cursor.pos = save;
    return dict;
  }
  cursor.pos += 6;
  if (cursor.peek() === 0x0d) cursor.pos += 1;
  if (cursor.peek() === 0x0a) cursor.pos += 1;
  const start = cursor.pos;
  const end = findEndStream(cursor.bytes, start);
  cursor.pos = end;
  return { kind: 'stream', dict, raw: cursor.bytes.subarray(start, end) };
}

function findEndStream(bytes: Uint8Array, from: number): number {
  const needle = 'endstream';
  for (let i = from; i < bytes.length - needle.length; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) {
      let end = i;
      // Trim the EOL that precedes `endstream`.
      if (end > from && bytes[end - 1] === 0x0a) end -= 1;
      if (end > from && bytes[end - 1] === 0x0d) end -= 1;
      return end;
    }
  }
  return bytes.length;
}

/** Best-effort stream decoding for the filters this reader supports. */
export function decodeStream(
  stream: PdfStream,
  failureCode: 'PDF_CORRUPT' | 'PDF_READ_FAILED' = 'PDF_READ_FAILED',
): Uint8Array {
  const filters = resolvedFilterNames(stream);
  const parms = resolvedDecodeParms(stream);
  let data = stream.raw;
  for (let i = 0; i < filters.length; i += 1) {
    const filter = filters[i];
    const parm = parms[i] ?? parms[0] ?? null;
    if (filter === 'FlateDecode' || filter === 'Fl') {
      data = inflate(data, failureCode);
      data = applyPredictor(data, parm, failureCode);
    } else if (filter === 'ASCIIHexDecode' || filter === 'AHx') {
      data = asciiHex(data);
    } else if (filter === 'ASCII85Decode' || filter === 'A85') {
      data = ascii85(data, failureCode);
    } else if (filter === 'Crypt') {
      throw ImporterFailure.of('PDF_ENCRYPTED');
    } else {
      // DCT/JPX/CCITT are image payloads, not text containers.
      throw ImporterFailure.of('UNSUPPORTED', { retryable: false });
    }
  }
  return data;
}

function resolvedFilterNames(stream: PdfStream): string[] {
  const filter = dictGet(stream, 'Filter');
  if (filter === null) return [];
  if (filter.kind === 'name') return [filter.name];
  if (filter.kind === 'array') {
    return filter.items.flatMap((item) => (item.kind === 'name' ? [item.name] : []));
  }
  return [];
}

function resolvedDecodeParms(stream: PdfStream): (PdfDict | null)[] {
  const parms = dictGet(stream, 'DecodeParms') ?? dictGet(stream, 'DP');
  if (parms === null) return [];
  if (parms.kind === 'array') return parms.items.map((item) => asDict(item));
  return [asDict(parms)];
}

function inflate(data: Uint8Array, failureCode: 'PDF_CORRUPT' | 'PDF_READ_FAILED'): Uint8Array {
  try {
    return inflateSync(data);
  } catch {
    try {
      return inflateRawSync(data);
    } catch {
      throw ImporterFailure.of(failureCode);
    }
  }
}

function asciiHex(data: Uint8Array): Uint8Array {
  const text = latin1Decode(data);
  let hex = '';
  for (const char of text) {
    if (char === '>') break;
    if (/[0-9A-Fa-f]/.test(char)) hex += char;
  }
  if (hex.length % 2 === 1) hex += '0';
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function ascii85(data: Uint8Array, failureCode: 'PDF_CORRUPT' | 'PDF_READ_FAILED'): Uint8Array {
  const text = latin1Decode(data).replace(/^<~/, '');
  const out: number[] = [];
  let tuple = 0;
  let count = 0;
  for (const char of text) {
    if (char === '~' || char === '>') break;
    if (char === 'z' && count === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const code = char.charCodeAt(0) - 33;
    if (code < 0 || code > 84) throw ImporterFailure.of(failureCode);
    tuple = tuple * 85 + code;
    count += 1;
    if (count === 5) {
      out.push((tuple >> 24) & 0xff, (tuple >> 16) & 0xff, (tuple >> 8) & 0xff, tuple & 0xff);
      tuple = 0;
      count = 0;
    }
  }
  if (count > 0) {
    for (let i = count; i < 5; i += 1) tuple = tuple * 85 + 84;
    const bytes = [(tuple >> 24) & 0xff, (tuple >> 16) & 0xff, (tuple >> 8) & 0xff, tuple & 0xff];
    out.push(...bytes.slice(0, count - 1));
  }
  return Uint8Array.from(out);
}

function applyPredictor(
  data: Uint8Array,
  parm: PdfDict | null,
  failureCode: 'PDF_CORRUPT' | 'PDF_READ_FAILED',
): Uint8Array {
  const predictor = dictNumber(parm, 'Predictor');
  if (predictor === null || predictor <= 1) return data;
  const colors = dictNumber(parm, 'Colors') ?? 1;
  const bits = dictNumber(parm, 'BitsPerComponent') ?? 8;
  const columns = dictNumber(parm, 'Columns') ?? 1;
  const bytesPerPixel = Math.max(1, Math.ceil((colors * bits) / 8));
  const rowLength = Math.ceil((columns * colors * bits) / 8);
  if (predictor === 2) {
    // TIFF predictor with 8-bit components only.
    if (bits !== 8) throw ImporterFailure.of(failureCode);
    const rows = Math.floor(data.length / rowLength);
    const out = Uint8Array.from(data);
    for (let row = 0; row < rows; row += 1) {
      const base = row * rowLength;
      for (let i = bytesPerPixel; i < rowLength; i += 1) {
        out[base + i] = (out[base + i] + out[base + i - bytesPerPixel]) & 0xff;
      }
    }
    return out;
  }
  if (predictor < 10) throw ImporterFailure.of(failureCode);
  const rows = Math.floor(data.length / (rowLength + 1));
  const out = new Uint8Array(rows * rowLength);
  let previous = new Uint8Array(rowLength);
  for (let row = 0; row < rows; row += 1) {
    const tag = data[row * (rowLength + 1)];
    const raw = data.subarray(row * (rowLength + 1) + 1, (row + 1) * (rowLength + 1));
    const current = new Uint8Array(rowLength);
    for (let i = 0; i < rowLength; i += 1) {
      const left = i >= bytesPerPixel ? current[i - bytesPerPixel] : 0;
      const up = previous[i];
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      const value = raw[i] ?? 0;
      let next = value;
      switch (tag) {
        case 0: next = value; break;
        case 1: next = value + left; break;
        case 2: next = value + up; break;
        case 3: next = value + Math.floor((left + up) / 2); break;
        case 4: next = value + paeth(left, up, upLeft); break;
        default: throw ImporterFailure.of(failureCode);
      }
      current[i] = next & 0xff;
    }
    out.set(current, row * rowLength);
    previous = current;
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
