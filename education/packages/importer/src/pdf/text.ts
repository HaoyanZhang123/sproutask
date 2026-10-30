/**
 * Text-layer extraction.
 *
 * PDFs whose pages carry a real text layer must not be OCR-ed: OCR would
 * replace exact text with guesses (05 §4, 06 §3 "文本层优先"). This module
 * walks the page content stream, decodes strings through the page fonts
 * (ToUnicode CMaps, /Differences, WinAnsi) and reports explicit
 * `unavailable` reasons instead of silently returning an empty page.
 */

import type { NormalizedBBox } from '@edu/domain';

import type { PdfDocument, PageBox } from './document.js';
import {
  ByteCursor,
  asDict,
  asName,
  asNumber,
  decodeStream,
  dictGet,
  dictName,
  dictNumber,
  latin1Decode,
  parseObject,
  type PdfDict,
  type PdfObject,
} from './tokens.js';

export interface TextLine {
  readonly text: string;
  /** Normalized 0..1 rectangle (top-left origin) for source highlighting. */
  readonly bbox: NormalizedBBox;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly fontSize: number;
}

export type TextLayerUnavailableReason = 'EMPTY_TEXT_LAYER' | 'FONT_ENCODING_UNSUPPORTED';

export interface TextLayerPage {
  readonly pageNumber: number;
  readonly available: boolean;
  readonly reason: TextLayerUnavailableReason | null;
  readonly lines: readonly TextLine[];
  readonly glyphCount: number;
  readonly undecodableGlyphs: number;
  readonly pageBox: PageBox;
}

interface FontDecoder {
  readonly subtype: string;
  decode(bytes: Uint8Array): { text: string; glyphs: number; undecodable: number };
  /** Width in text space units (1/1000 em) for the given bytes. */
  advance(bytes: Uint8Array): number;
  readonly codeByteLength: number;
}

const WIN_ANSI_SPECIALS: Record<number, string> = {
  0x80: '\u20ac', 0x82: '\u201a', 0x83: '\u0192', 0x84: '\u201e', 0x85: '\u2026',
  0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02c6', 0x89: '\u2030', 0x8a: '\u0160',
  0x8b: '\u2039', 0x8c: '\u0152', 0x8e: '\u017d', 0x91: '\u2018', 0x92: '\u2019',
  0x93: '\u201c', 0x94: '\u201d', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02dc', 0x99: '\u2122', 0x9a: '\u0161', 0x9b: '\u203a', 0x9c: '\u0153',
  0x9e: '\u017e', 0x9f: '\u0178',
};

const GLYPH_NAMES: Record<string, string> = {
  space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%',
  ampersand: '&', quotesingle: "'", parenleft: '(', parenright: ')', asterisk: '*',
  plus: '+', comma: ',', hyphen: '-', period: '.', slash: '/', zero: '0', one: '1',
  two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  nine: '9', colon: ':', semicolon: ';', less: '<', equal: '=', greater: '>',
  question: '?', at: '@', bracketleft: '[', backslash: '\\', bracketright: ']',
  asciicircum: '^', underscore: '_', grave: '`', braceleft: '{', bar: '|',
  braceright: '}', asciitilde: '~', quoteleft: '\u2018', quoteright: '\u2019',
  quotedblleft: '\u201c', quotedblright: '\u201d', endash: '\u2013', emdash: '\u2014',
  bullet: '\u2022', ellipsis: '\u2026', fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi',
  ffl: 'ffl', degree: '\u00b0', plusminus: '\u00b1', multiply: '\u00d7',
  divide: '\u00f7', middot: '\u00b7', copyright: '\u00a9', registered: '\u00ae',
  trademark: '\u2122', nbspace: ' ',
};

function winAnsi(byte: number): string | null {
  if (byte >= 0x20 && byte <= 0x7e) return String.fromCharCode(byte);
  if (byte >= 0xa0) return String.fromCharCode(byte);
  return WIN_ANSI_SPECIALS[byte] ?? null;
}

function decodeUtf16Be(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  if (bytes.length % 2 === 1) return String.fromCharCode(...bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return out;
}

function parseHexStringBytes(text: string): Uint8Array | null {
  const match = /^<([0-9A-Fa-f\s]*)>$/.exec(text.trim());
  if (match === null) return null;
  const hex = match[1].replace(/\s+/g, '');
  if (hex.length % 2 === 1) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

interface CMap {
  readonly codeByteLength: number;
  readonly map: Map<number, string>;
}

/** Parses the subset of a ToUnicode CMap that matters for text extraction. */
export function parseToUnicodeCMap(text: string): CMap {
  const map = new Map<number, string>();
  let codeByteLength = 0;
  const codespace = /begincodespacerange([\s\S]*?)endcodespacerange/g;
  for (let m = codespace.exec(text); m !== null; m = codespace.exec(text)) {
    for (const token of m[1].matchAll(/<([0-9A-Fa-f]+)>/g)) {
      codeByteLength = Math.max(codeByteLength, Math.ceil(token[1].length / 2));
    }
  }
  const bfchar = /beginbfchar([\s\S]*?)endbfchar/g;
  for (let block = bfchar.exec(text); block !== null; block = bfchar.exec(text)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      const code = Number.parseInt(pair[1], 16);
      if (!Number.isFinite(code)) continue;
      map.set(code, decodeUtf16Be(hexToBytes(pair[2])));
    }
  }
  const bfrange = /beginbfrange([\s\S]*?)endbfrange/g;
  for (let block = bfrange.exec(text); block !== null; block = bfrange.exec(text)) {
    const body = block[1];
    // <lo> <hi> <dst> or <lo> <hi> [<dst1> <dst2> ...]
    const simple = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g;
    for (const range of body.matchAll(simple)) {
      const lo = Number.parseInt(range[1], 16);
      const hi = Number.parseInt(range[2], 16);
      const base = hexToBytes(range[3]);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) continue;
      for (let code = lo; code <= Math.min(hi, lo + 65535); code += 1) {
        map.set(code, decodeUtf16Be(incrementBytes(base, code - lo)));
      }
    }
    const list = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    for (const range of body.matchAll(list)) {
      const lo = Number.parseInt(range[1], 16);
      const items = [...range[3].matchAll(/<([0-9A-Fa-f]*)>/g)];
      for (let i = 0; i < items.length; i += 1) map.set(lo + i, decodeUtf16Be(hexToBytes(items[i][1])));
    }
  }
  if (codeByteLength === 0) codeByteLength = guessCodeByteLength(map);
  return { codeByteLength, map };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 1 ? `${hex}0` : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function incrementBytes(bytes: Uint8Array, delta: number): Uint8Array {
  if (bytes.length === 0) return bytes;
  const out = Uint8Array.from(bytes);
  let carry = delta;
  for (let i = out.length - 1; i >= 0 && carry > 0; i -= 1) {
    const sum = out[i] + carry;
    out[i] = sum & 0xff;
    carry = sum >> 8;
  }
  return out;
}

function guessCodeByteLength(map: Map<number, string>): number {
  let max = 0;
  for (const code of map.keys()) max = Math.max(max, code);
  return max > 0xff ? 2 : 1;
}

interface SimpleFontInfo {
  readonly differences: Map<number, string>;
  readonly widths: readonly number[];
  readonly firstChar: number;
  readonly defaultWidth: number;
}

function buildFontDecoder(doc: PdfDocument, fontDict: PdfDict): FontDecoder {
  const subtype = doc.resolveName(dictGet(fontDict, 'Subtype')) ?? 'Type1';
  const isType0 = subtype === 'Type0';
  const toUnicodeStream = doc.resolve(dictGet(fontDict, 'ToUnicode'));
  let cmap: CMap | null = null;
  if (toUnicodeStream !== null && toUnicodeStream.kind === 'stream') {
    try {
      cmap = parseToUnicodeCMap(latin1Decode(decodeStream(toUnicodeStream)));
    } catch {
      cmap = null;
    }
  }
  const simple = isType0 ? null : buildSimpleFontInfo(doc, fontDict);
  const widthsType0 = isType0 ? buildType0Widths(doc, fontDict) : null;
  const codeByteLength = cmap?.codeByteLength ?? (isType0 ? 2 : 1);

  return {
    subtype,
    codeByteLength,
    decode(bytes: Uint8Array): { text: string; glyphs: number; undecodable: number } {
      if (cmap !== null) {
        let text = '';
        let glyphs = 0;
        let undecodable = 0;
        for (let at = 0; at < bytes.length; at += codeByteLength) {
          let code = 0;
          for (let i = 0; i < codeByteLength; i += 1) code = code * 256 + (bytes[at + i] ?? 0);
          glyphs += 1;
          const mapped = cmap.map.get(code);
          if (mapped === undefined) {
            undecodable += 1;
            text += '\uFFFD';
          } else {
            text += mapped;
          }
        }
        return { text, glyphs, undecodable };
      }
      if (isType0) {
        // CID fonts without ToUnicode cannot be turned into Unicode text.
        const glyphs = Math.floor(bytes.length / 2);
        return { text: '', glyphs, undecodable: glyphs };
      }
      let text = '';
      let undecodable = 0;
      for (const byte of bytes) {
        const named = simple?.differences.get(byte);
        if (named !== undefined) {
          text += named;
          continue;
        }
        const decoded = winAnsi(byte);
        if (decoded === null) {
          undecodable += 1;
          continue;
        }
        text += decoded;
      }
      return { text, glyphs: bytes.length, undecodable };
    },
    advance(bytes: Uint8Array): number {
      if (isType0) {
        const widths = widthsType0;
        if (widths === null) return (bytes.length / 2) * 1000;
        let total = 0;
        for (let at = 0; at + 1 < bytes.length; at += 2) {
          const cid = (bytes[at] << 8) | bytes[at + 1];
          total += widths.get(cid) ?? 1000;
        }
        return total;
      }
      if (simple === null) return bytes.length * 500;
      let total = 0;
      for (const byte of bytes) {
        const index = byte - simple.firstChar;
        total += index >= 0 && index < simple.widths.length ? simple.widths[index] : simple.defaultWidth;
      }
      return total;
    },
  };
}

function buildSimpleFontInfo(doc: PdfDocument, fontDict: PdfDict): SimpleFontInfo {
  const differences = new Map<number, string>();
  const encoding = doc.resolve(dictGet(fontDict, 'Encoding'));
  if (encoding !== null && encoding.kind === 'dict') {
    const diffArray = doc.resolve(dictGet(encoding, 'Differences'));
    if (diffArray !== null && diffArray.kind === 'array') {
      let code = 0;
      for (const item of diffArray.items) {
        const resolved = doc.resolve(item);
        if (resolved === null) continue;
        if (resolved.kind === 'number') {
          code = resolved.value;
          continue;
        }
        if (resolved.kind === 'name') {
          const mapped = GLYPH_NAMES[resolved.name];
          if (mapped !== undefined) differences.set(code, mapped);
          code += 1;
        }
      }
    }
  }
  const widthsArray = doc.resolve(dictGet(fontDict, 'Widths'));
  const widths: number[] =
    widthsArray !== null && widthsArray.kind === 'array'
      ? widthsArray.items.map((item) => doc.resolveNumber(item) ?? 0)
      : [];
  return {
    differences,
    widths,
    firstChar: doc.resolveNumber(dictGet(fontDict, 'FirstChar')) ?? 0,
    defaultWidth: 500,
  };
}

function buildType0Widths(doc: PdfDocument, fontDict: PdfDict): Map<number, number> | null {
  const descendants = doc.resolve(dictGet(fontDict, 'DescendantFonts'));
  if (descendants === null || descendants.kind !== 'array' || descendants.items.length === 0) return null;
  const cidFont = doc.resolveDict(descendants.items[0]);
  if (cidFont === null) return null;
  const w = doc.resolve(dictGet(cidFont, 'W'));
  if (w === null || w.kind !== 'array') return null;
  const widths = new Map<number, number>();
  let at = 0;
  while (at < w.items.length) {
    const first = doc.resolveNumber(w.items[at]);
    const second = doc.resolve(w.items[at + 1]);
    if (first === null || second === null) break;
    if (second.kind === 'number') {
      const last = second.value;
      const width = doc.resolveNumber(w.items[at + 2]) ?? 1000;
      for (let cid = first; cid <= last && cid - first < 65535; cid += 1) widths.set(cid, width);
      at += 3;
      continue;
    }
    if (second.kind === 'array') {
      for (let i = 0; i < second.items.length; i += 1) {
        widths.set(first + i, doc.resolveNumber(second.items[i]) ?? 1000);
      }
      at += 2;
      continue;
    }
    break;
  }
  return widths;
}

interface Run {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly fontSize: number;
}

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as const;
type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };

function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.b * n.c,
    b: m.a * n.b + m.b * n.d,
    c: m.c * n.a + m.d * n.c,
    d: m.c * n.b + m.d * n.d,
    e: m.e * n.a + m.f * n.c + n.e,
    f: m.e * n.b + m.f * n.d + n.f,
  };
}

/** Extracts the text layer of one page; never throws for empty/undecodable pages. */
export function extractTextLayer(doc: PdfDocument, pageNumber: number): TextLayerPage {
  const pageBox = doc.pageBox(pageNumber);
  const content = doc.pageContent(pageNumber);
  const fonts = new Map<string, FontDecoder>();
  const resources = doc.pageResources(pageNumber);
  const fontDict = resources === null ? null : doc.resolveDict(dictGet(resources, 'Font'));

  const fontFor = (name: string): FontDecoder | null => {
    const cached = fonts.get(name);
    if (cached !== undefined) return cached;
    if (fontDict === null) return null;
    const entry = doc.resolveDict(dictGet(fontDict, name));
    if (entry === null) return null;
    const decoder = buildFontDecoder(doc, entry);
    fonts.set(name, decoder);
    return decoder;
  };

  const runs: Run[] = [];
  let glyphCount = 0;
  let undecodableGlyphs = 0;

  let tm: Matrix = { ...IDENTITY };
  let tlm: Matrix = { ...IDENTITY };
  let fontSize = 12;
  let leading = 0;
  let fontName: string | null = null;
  let horizontalScale = 1;

  const showText = (bytes: Uint8Array): void => {
    const decoder = fontName === null ? null : fontFor(fontName);
    if (decoder === null) {
      glyphCount += bytes.length;
      undecodableGlyphs += bytes.length;
    } else {
      const decoded = decoder.decode(bytes);
      glyphCount += decoded.glyphs;
      undecodableGlyphs += decoded.undecodable;
      const textWidth = (decoder.advance(bytes) / 1000) * fontSize * horizontalScale;
      if (decoded.text.length > 0) {
        runs.push({
          text: decoded.text,
          x: tm.e,
          y: tm.f,
          width: textWidth,
          fontSize,
        });
      }
      // Advance the text matrix by the shown width.
      tm = multiply(
        { a: 1, b: 0, c: 0, d: 1, e: textWidth, f: 0 },
        tm,
      );
      return;
    }
    const fallbackWidth = (bytes.length * 500) / 1000 * fontSize * horizontalScale;
    tm = multiply({ a: 1, b: 0, c: 0, d: 1, e: fallbackWidth, f: 0 }, tm);
  };

  if (content.length > 0) {
    const cursor = new ByteCursor(content);
    const operands: PdfObject[] = [];
    while (!cursor.eof) {
      cursor.skipWhitespace();
      if (cursor.eof) break;
      const byte = cursor.peek();
      const isOperand =
        byte === 0x2f || byte === 0x28 || byte === 0x3c || byte === 0x5b || byte === 0x2b ||
        byte === 0x2d || byte === 0x2e || (byte >= 0x30 && byte <= 0x39);
      try {
        if (isOperand) {
          operands.push(parseObject(cursor));
          if (operands.length > 64) operands.splice(0, operands.length - 64);
          continue;
        }
      } catch {
        cursor.pos += 1;
        continue;
      }
      const operator = cursor.readRegularToken();
      if (operator === '') {
        cursor.pos += 1;
        continue;
      }
      switch (operator) {
        case 'BT':
          tm = { ...IDENTITY };
          tlm = { ...IDENTITY };
          break;
        case 'Tf': {
          const name = operands.length >= 2 ? asName(operands[operands.length - 2]) : null;
          const size = operands.length >= 2 ? asNumber(operands[operands.length - 1]) : null;
          if (name !== null) fontName = name;
          if (size !== null && size > 0) fontSize = size;
          break;
        }
        case 'TL': {
          const value = operands.length >= 1 ? asNumber(operands[operands.length - 1]) : null;
          if (value !== null) leading = value;
          break;
        }
        case 'Tz': {
          const value = operands.length >= 1 ? asNumber(operands[operands.length - 1]) : null;
          if (value !== null) horizontalScale = value / 100;
          break;
        }
        case 'Td':
        case 'TD': {
          const tx = operands.length >= 2 ? asNumber(operands[operands.length - 2]) : null;
          const ty = operands.length >= 2 ? asNumber(operands[operands.length - 1]) : null;
          if (tx !== null && ty !== null) {
            tlm = multiply({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty }, tlm);
            tm = { ...tlm };
            if (operator === 'TD') leading = -ty;
          }
          break;
        }
        case 'Tm': {
          if (operands.length >= 6) {
            const values = operands.slice(-6).map((item) => asNumber(item) ?? 0);
            tlm = {
              a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5],
            };
            tm = { ...tlm };
          }
          break;
        }
        case 'T*':
          tlm = multiply({ a: 1, b: 0, c: 0, d: 1, e: 0, f: -leading }, tlm);
          tm = { ...tlm };
          break;
        case 'Tj': {
          const bytes = asStringBytes(operands[operands.length - 1]);
          if (bytes !== null) showText(bytes);
          break;
        }
        case 'TJ': {
          const array = operands[operands.length - 1];
          if (array !== null && array.kind === 'array') {
            for (const item of array.items) {
              if (item.kind === 'string') {
                showText(item.bytes);
              } else if (item.kind === 'number') {
                const shift = (-item.value / 1000) * fontSize * horizontalScale;
                tm = multiply({ a: 1, b: 0, c: 0, d: 1, e: shift, f: 0 }, tm);
              }
            }
          }
          break;
        }
        case "'":
        case '"': {
          tlm = multiply({ a: 1, b: 0, c: 0, d: 1, e: 0, f: -leading }, tlm);
          tm = { ...tlm };
          const bytes = asStringBytes(operands[operands.length - 1]);
          if (bytes !== null) showText(bytes);
          break;
        }
        case 'BI': {
          // Skip inline image data: find the EI operator after ID.
          const idAt = indexOfAscii(content, 'ID', cursor.pos);
          const eiAt = idAt < 0 ? -1 : indexOfAscii(content, 'EI', idAt + 2);
          cursor.pos = eiAt < 0 ? content.length : eiAt + 2;
          break;
        }
        default:
          break;
      }
      operands.length = 0;
    }
  }

  const lines = groupRuns(runs, pageBox);
  const available = glyphCount > 0 && undecodableGlyphs / Math.max(1, glyphCount) <= 0.5 && lines.length > 0;
  const reason: TextLayerUnavailableReason | null = available
    ? null
    : lines.length === 0 && glyphCount === 0
      ? 'EMPTY_TEXT_LAYER'
      : 'FONT_ENCODING_UNSUPPORTED';
  return {
    pageNumber,
    available,
    reason,
    lines,
    glyphCount,
    undecodableGlyphs,
    pageBox,
  };
}

function asStringBytes(value: PdfObject | null): Uint8Array | null {
  return value !== null && value.kind === 'string' ? value.bytes : null;
}

function indexOfAscii(bytes: Uint8Array, needle: string, from: number): number {
  for (let i = Math.max(0, from); i <= bytes.length - needle.length; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function groupRuns(runs: readonly Run[], box: PageBox): TextLine[] {
  if (runs.length === 0) return [];
  const sorted = [...runs].sort((left, right) => right.y - left.y || left.x - right.x);
  const buckets: Run[][] = [];
  for (const run of sorted) {
    const bucket = buckets[buckets.length - 1];
    if (bucket !== undefined) {
      const reference = bucket[0];
      const tolerance = Math.max(2, Math.min(reference.fontSize, run.fontSize) * 0.45);
      if (Math.abs(reference.y - run.y) <= tolerance) {
        bucket.push(run);
        continue;
      }
    }
    buckets.push([run]);
  }
  const lines: TextLine[] = [];
  for (const bucket of buckets) {
    bucket.sort((left, right) => left.x - right.x);
    let text = '';
    let previousEnd = Number.NEGATIVE_INFINITY;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let size = 0;
    let y = bucket[0].y;
    for (const run of bucket) {
      const gap = run.x - previousEnd;
      if (text.length > 0 && Number.isFinite(gap) && gap > run.fontSize * 0.25) text += ' ';
      text += run.text;
      previousEnd = run.x + run.width;
      left = Math.min(left, run.x);
      right = Math.max(right, run.x + run.width);
      size = Math.max(size, run.fontSize);
      y = Math.max(y, run.y);
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) continue;
    const width = Math.max(right - left, size * 0.5);
    const boxTop = box.y + box.height - (y + size * 0.85);
    lines.push({
      text: trimmed,
      bbox: {
        x: clamp01((left - box.x) / box.width),
        y: clamp01(boxTop / box.height),
        width: clamp01(width / box.width),
        height: clamp01((size * 1.2) / box.height),
      },
      x: left,
      y,
      width,
      fontSize: size,
    });
  }
  return lines;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Re-exported for tests: font decoding needs the same tables as extraction. */
export const __testables = { winAnsi, parseHexStringBytes, GLYPH_NAMES };

/** Reads the /Info title helper used by identification (best effort). */
export function documentTitle(doc: PdfDocument): string | null {
  return doc.info.title;
}

export type { FontDecoder as PdfFontDecoder };
export type { PdfDict as PdfResourceDict };
export { dictName as pdfDictName, dictNumber as pdfDictNumber };
