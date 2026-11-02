/**
 * PDF document access: cross-reference tables/streams, object streams, page
 * tree, page content. Only what the importer needs is implemented; unknown
 * constructs fail with a specific importer error code.
 */

import { ImporterFailure } from '../errors.js';
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
  type PdfRef,
} from './tokens.js';

export interface PageBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Rotation in degrees (0/90/180/270), as declared by the page tree. */
  readonly rotate: number;
}

export interface DocumentInfo {
  readonly headerVersion: string;
  readonly pageCount: number;
  readonly encrypted: boolean;
  /** True when the cross-reference data was unusable and objects were scanned. */
  readonly recovered: boolean;
  readonly title: string | null;
  readonly producer: string | null;
  readonly creator: string | null;
}

type XrefEntry =
  | { readonly kind: 'normal'; readonly offset: number }
  | { readonly kind: 'compressed'; readonly streamNum: number; readonly index: number };

interface PageNode {
  readonly dict: PdfDict;
  readonly resources: PdfDict | null;
  readonly box: PageBox;
}

function findStartXref(bytes: Uint8Array): number | null {
  const text = latin1Decode(bytes.subarray(Math.max(0, bytes.length - 4096)));
  const at = text.lastIndexOf('startxref');
  if (at < 0) return null;
  const match = /^startxref\s+(\d+)/.exec(text.slice(at));
  if (match === null) return null;
  const offset = Number.parseInt(match[1], 10);
  return offset >= 0 && offset < bytes.length ? offset : null;
}

export class PdfDocument {
  readonly info: DocumentInfo;
  private readonly bytes: Uint8Array;
  private readonly entries: Map<number, XrefEntry>;
  private readonly cache = new Map<number, PdfObject>();
  private readonly objectStreams = new Map<number, Map<number, PdfObject>>();
  private readonly pages: PageNode[] = [];
  private readonly trailer: PdfDict;

  private constructor(
    bytes: Uint8Array,
    trailer: PdfDict,
    entries: Map<number, XrefEntry>,
    recovered: boolean,
  ) {
    this.bytes = bytes;
    this.trailer = trailer;
    this.entries = entries;
    const root = this.resolveDict(dictGet(trailer, 'Root'));
    if (root === null) throw ImporterFailure.of('PDF_CORRUPT');
    const pagesDict = this.resolveDict(dictGet(root, 'Pages'));
    if (pagesDict === null) throw ImporterFailure.of('PDF_CORRUPT');
    this.collectPages(pagesDict, null, inheritedBox(null, pagesDict), 0);
    if (this.pages.length === 0) throw ImporterFailure.of('PDF_NO_PAGES');
    const infoDict = this.resolveDict(dictGet(trailer, 'Info'));
    const versionMatch = /%PDF-(\d+\.\d+)/.exec(latin1Decode(bytes.subarray(0, Math.min(1024, bytes.length))));
    this.info = {
      headerVersion: versionMatch === null ? 'unknown' : versionMatch[1],
      pageCount: this.pages.length,
      encrypted: dictGet(trailer, 'Encrypt') !== null,
      recovered,
      title: infoDict === null ? null : this.textOf(dictGet(infoDict, 'Title')),
      producer: infoDict === null ? null : this.textOf(dictGet(infoDict, 'Producer')),
      creator: infoDict === null ? null : this.textOf(dictGet(infoDict, 'Creator')),
    };
  }

  static open(bytes: Uint8Array): PdfDocument {
    if (bytes.length < 8) throw ImporterFailure.of('PDF_CORRUPT');
    if (!latin1Decode(bytes.subarray(0, 1024)).includes('%PDF-')) {
      throw ImporterFailure.of('PDF_CORRUPT');
    }
    const state = new XrefState(bytes);
    const start = findStartXref(bytes);
    if (start !== null) {
      try {
        const parsed = state.parseFrom(start);
        return new PdfDocument(bytes, parsed.trailer, parsed.entries, false);
      } catch {
        /* fall back to whole-file recovery */
      }
    }
    const parsed = state.recover();
    return new PdfDocument(bytes, parsed.trailer, parsed.entries, true);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  isEncrypted(): boolean {
    return this.info.encrypted;
  }

  pageBox(pageNumber: number): PageBox {
    return this.page(pageNumber).box;
  }

  /** Decoded content stream bytes for a 1-based page. */
  pageContent(pageNumber: number): Uint8Array {
    const page = this.page(pageNumber);
    const contents = dictGet(page.dict, 'Contents');
    if (contents === null) return new Uint8Array(0);
    const pieces: Uint8Array[] = [];
    const push = (value: PdfObject): void => {
      const resolved = this.resolve(value);
      if (resolved === null) return;
      if (resolved.kind === 'stream') {
        pieces.push(decodeStream(resolved));
        return;
      }
      if (resolved.kind === 'array') {
        for (const item of resolved.items) push(item);
      }
    };
    if (contents.kind === 'array') {
      for (const item of contents.items) push(item);
    } else {
      push(contents);
    }
    if (pieces.length === 0) return new Uint8Array(0);
    if (pieces.length === 1) return pieces[0];
    const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const piece of pieces) {
      out.set(piece, at);
      at += piece.length;
    }
    return out;
  }

  /** Default resource dictionary of a page (fonts and xobjects). */
  pageResources(pageNumber: number): PdfDict | null {
    return this.page(pageNumber).resources;
  }

  resolve(value: PdfObject | null): PdfObject | null {
    if (value === null) return null;
    if (value.kind !== 'ref') return value;
    return this.getObject(value.num);
  }

  resolveDict(value: PdfObject | null): PdfDict | null {
    return asDict(this.resolve(value));
  }

  resolveName(value: PdfObject | null): string | null {
    return asName(this.resolve(value));
  }

  resolveNumber(value: PdfObject | null): number | null {
    return asNumber(this.resolve(value));
  }

  getObject(num: number): PdfObject | null {
    const cached = this.cache.get(num);
    if (cached !== undefined) return cached;
    const entry = this.entries.get(num);
    if (entry === undefined) return null;
    let value: PdfObject | null = null;
    if (entry.kind === 'normal') {
      value = parseIndirectAt(this.bytes, entry.offset, num);
    } else {
      value = this.readObjectStream(entry.streamNum).get(num) ?? null;
    }
    if (value !== null) this.cache.set(num, value);
    return value;
  }

  private readObjectStream(streamNum: number): Map<number, PdfObject> {
    const cached = this.objectStreams.get(streamNum);
    if (cached !== undefined) return cached;
    const objects = new Map<number, PdfObject>();
    this.objectStreams.set(streamNum, objects);
    const stream = this.getObject(streamNum);
    if (stream === null || stream.kind !== 'stream') return objects;
    let data: Uint8Array;
    try {
      data = decodeStream(stream);
    } catch {
      return objects;
    }
    const count = dictNumber(stream, 'N') ?? 0;
    const first = dictNumber(stream, 'First') ?? 0;
    const header = latin1Decode(data.subarray(0, Math.min(Math.max(first, 0), data.length)))
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .map((token) => Number.parseInt(token, 10));
    for (let i = 0; i < count; i += 1) {
      const num = header[i * 2];
      const offset = header[i * 2 + 1];
      if (num === undefined || offset === undefined) continue;
      if (!Number.isFinite(num) || !Number.isFinite(offset)) continue;
      try {
        const cursor = new ByteCursor(data, first + offset);
        objects.set(num, parseObject(cursor));
      } catch {
        /* keep the other objects of this stream */
      }
    }
    return objects;
  }

  private page(pageNumber: number): PageNode {
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > this.pages.length) {
      throw ImporterFailure.of('PDF_NO_PAGES');
    }
    return this.pages[pageNumber - 1];
  }

  private collectPages(
    node: PdfDict,
    inheritedResources: PdfDict | null,
    inherited: PageBox | null,
    depth: number,
  ): void {
    if (depth > 64) throw ImporterFailure.of('PDF_CORRUPT');
    const box = inheritedBox(inherited, node);
    const resources = this.resolveDict(dictGet(node, 'Resources')) ?? inheritedResources;
    const kids = this.resolve(dictGet(node, 'Kids'));
    if (kids !== null && kids.kind === 'array') {
      for (const kid of kids.items) {
        const dict = this.resolveDict(kid);
        if (dict === null) continue;
        if (dictName(dict, 'Type') === 'Pages') {
          this.collectPages(dict, resources, box, depth + 1);
        } else {
          this.pages.push({
            dict,
            resources: this.resolveDict(dictGet(dict, 'Resources')) ?? resources,
            box: inheritedBox(box, dict) ?? box ?? { x: 0, y: 0, width: 595, height: 842, rotate: 0 },
          });
        }
      }
      return;
    }
    this.pages.push({ dict: node, resources, box: box ?? { x: 0, y: 0, width: 595, height: 842, rotate: 0 } });
  }

  private textOf(value: PdfObject | null): string | null {
    const resolved = this.resolve(value);
    if (resolved === null || resolved.kind !== 'string') return null;
    return latin1Decode(resolved.bytes).trim() || null;
  }
}

/** Skips whitespace, then reads one regular token. */
function nextToken(cursor: ByteCursor): string {
  cursor.skipWhitespace();
  return cursor.readRegularToken();
}

function parseIndirectAt(bytes: Uint8Array, offset: number, expectedNum: number): PdfObject | null {
  if (offset < 0 || offset >= bytes.length) return null;
  try {
    const cursor = new ByteCursor(bytes, offset);
    const num = nextToken(cursor);
    const gen = nextToken(cursor);
    const keyword = nextToken(cursor);
    if (!/^\d+$/.test(num) || !/^\d+$/.test(gen) || keyword !== 'obj') return null;
    if (Number.parseInt(num, 10) !== expectedNum) return null;
    return parseObject(cursor);
  } catch {
    return null;
  }
}

function inheritedBox(inherited: PageBox | null, node: PdfDict): PageBox | null {
  const media = dictGet(node, 'MediaBox');
  if (media === null) return inherited;
  const array = media.kind === 'array' ? media : null;
  if (array === null || array.items.length < 4) return inherited;
  const values = array.items.map((item) => (item.kind === 'number' ? item.value : null));
  if (values.some((value) => value === null)) return inherited;
  const [x1, y1, x2, y2] = values as number[];
  const left = Math.min(x1, x2);
  const bottom = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  if (width <= 0 || height <= 0) return inherited;
  const rotate = dictNumber(node, 'Rotate') ?? inherited?.rotate ?? 0;
  return { x: left, y: bottom, width, height, rotate };
}

/** Cross-reference parsing and whole-file object scanning. */
class XrefState {
  entries = new Map<number, XrefEntry>();
  readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  parseFrom(offset: number): { entries: Map<number, XrefEntry>; trailer: PdfDict } {
    const entries = new Map<number, XrefEntry>();
    let trailer: PdfDict | null = null;
    let next: number | null = offset;
    const seen = new Set<number>();
    while (next !== null) {
      if (seen.has(next)) throw ImporterFailure.of('PDF_CORRUPT');
      seen.add(next);
      const chunk = this.readSection(next);
      for (const [num, entry] of chunk.entries) {
        if (!entries.has(num)) entries.set(num, entry);
      }
      trailer = trailer ?? chunk.trailer;
      const hybrid = dictNumber(chunk.trailer, 'XRefStm');
      if (hybrid !== null && !seen.has(hybrid)) {
        seen.add(hybrid);
        const extra = this.readSection(hybrid);
        for (const [num, entry] of extra.entries) {
          if (!entries.has(num)) entries.set(num, entry);
        }
      }
      next = dictNumber(chunk.trailer, 'Prev');
    }
    if (trailer === null) throw ImporterFailure.of('PDF_CORRUPT');
    return { entries, trailer };
  }

  private readSection(offset: number): { entries: Map<number, XrefEntry>; trailer: PdfDict } {
    const cursor = new ByteCursor(this.bytes, offset);
    cursor.skipWhitespace();
    if (latin1Decode(this.bytes.subarray(cursor.pos, cursor.pos + 4)) === 'xref') {
      cursor.pos += 4;
      return this.readClassicTable(cursor);
    }
    return this.readXrefStream(cursor.pos);
  }

  private readClassicTable(cursor: ByteCursor): { entries: Map<number, XrefEntry>; trailer: PdfDict } {
    const entries = new Map<number, XrefEntry>();
    for (;;) {
      cursor.skipWhitespace();
      if (latin1Decode(cursor.bytes.subarray(cursor.pos, cursor.pos + 7)) === 'trailer') {
        cursor.pos += 7;
        cursor.skipWhitespace();
        const trailer = asDict(parseObject(cursor));
        if (trailer === null) throw ImporterFailure.of('PDF_CORRUPT');
        return { entries, trailer };
      }
      const startToken = nextToken(cursor);
      const countToken = nextToken(cursor);
      if (!/^\d+$/.test(startToken) || !/^\d+$/.test(countToken)) throw ImporterFailure.of('PDF_CORRUPT');
      const start = Number.parseInt(startToken, 10);
      const count = Number.parseInt(countToken, 10);
      for (let i = 0; i < count; i += 1) {
        const entryOffset = nextToken(cursor);
        const gen = nextToken(cursor);
        const kind = nextToken(cursor);
        if (!/^\d+$/.test(entryOffset) || !/^\d+$/.test(gen)) throw ImporterFailure.of('PDF_CORRUPT');
        if (kind === 'n') {
          entries.set(start + i, { kind: 'normal', offset: Number.parseInt(entryOffset, 10) });
        }
      }
    }
  }

  private readXrefStream(offset: number): { entries: Map<number, XrefEntry>; trailer: PdfDict } {
    const object = parseIndirectAt(this.bytes, offset, -1);
    if (object === null || object.kind !== 'stream') throw ImporterFailure.of('PDF_CORRUPT');
    if (dictName(object, 'Type') !== 'XRef') throw ImporterFailure.of('PDF_CORRUPT');
    const data = decodeStream(object);
    const widthsObject = dictGet(object, 'W');
    if (widthsObject === null || widthsObject.kind !== 'array') throw ImporterFailure.of('PDF_CORRUPT');
    const widths = widthsObject.items.map((item) => (item.kind === 'number' ? item.value : 0));
    if (widths.length < 3) throw ImporterFailure.of('PDF_CORRUPT');
    const size = dictNumber(object, 'Size') ?? 0;
    const indexRaw = dictGet(object, 'Index');
    const index: number[] = [];
    if (indexRaw !== null && indexRaw.kind === 'array') {
      for (const item of indexRaw.items) {
        const value = asNumber(item);
        if (value !== null) index.push(value);
      }
    }
    if (index.length === 0) index.push(0, size);
    const entries = new Map<number, XrefEntry>();
    const rowLength = widths[0] + widths[1] + widths[2];
    if (rowLength <= 0) throw ImporterFailure.of('PDF_CORRUPT');
    let at = 0;
    for (let pair = 0; pair < index.length; pair += 2) {
      const startNum = index[pair];
      const count = index[pair + 1] ?? 0;
      for (let i = 0; i < count && at + rowLength <= data.length; i += 1) {
        const type = widths[0] === 0 ? 1 : readField(data, at, widths[0]);
        const field2 = readField(data, at + widths[0], widths[1]);
        const field3 = readField(data, at + widths[0] + widths[1], widths[2]);
        at += rowLength;
        const num = startNum + i;
        if (type === 1) entries.set(num, { kind: 'normal', offset: field2 });
        else if (type === 2) entries.set(num, { kind: 'compressed', streamNum: field2, index: field3 });
      }
    }
    const map = new Map(object.dict.map);
    if (!map.has('Root')) {
      const root = findRootByScan(this.bytes, entries);
      if (root === null) throw ImporterFailure.of('PDF_CORRUPT');
      map.set('Root', root);
    }
    return { entries, trailer: { kind: 'dict', map } };
  }

  /** Scan the whole file for indirect objects and rebuild an object table. */
  recover(): { entries: Map<number, XrefEntry>; trailer: PdfDict } {
    const text = latin1Decode(this.bytes);
    const offsets = new Map<number, number>();
    const pattern = /(\d{1,10})\s+(\d{1,5})\s+obj\b/g;
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      offsets.set(Number.parseInt(match[1], 10), match.index);
    }
    if (offsets.size === 0) throw ImporterFailure.of('PDF_CORRUPT');
    const entries = new Map<number, XrefEntry>();
    for (const [num, offset] of offsets) entries.set(num, { kind: 'normal', offset });
    // Objects packed inside object streams are not visible to the scan above.
    for (const [num, offset] of offsets) {
      const object = parseIndirectAt(this.bytes, offset, num);
      if (object === null || object.kind !== 'stream') continue;
      if (dictName(object, 'Type') !== 'ObjStm') continue;
      try {
        const data = decodeStream(object);
        const count = dictNumber(object, 'N') ?? 0;
        for (let i = 0; i < count; i += 1) {
          const inner = readObjectStreamNumber(data, i);
          if (inner !== null && !entries.has(inner)) entries.set(inner, { kind: 'compressed', streamNum: num, index: i });
        }
      } catch {
        /* ignore an unreadable object stream */
      }
    }
    const root = findRootByScan(this.bytes, entries);
    if (root === null) throw ImporterFailure.of('PDF_CORRUPT');
    const map = new Map<string, PdfObject>([['Root', root]]);
    const trailerAt = text.lastIndexOf('trailer');
    if (trailerAt >= 0) {
      try {
        const cursor = new ByteCursor(this.bytes, trailerAt + 'trailer'.length);
        const parsed = asDict(parseObject(cursor));
        if (parsed !== null) {
          for (const [key, value] of parsed.map) map.set(key, value);
          map.set('Root', root);
        }
      } catch {
        /* keep the minimal trailer */
      }
    }
    return { entries, trailer: { kind: 'dict', map } };
  }
}

function readObjectStreamNumber(data: Uint8Array, index: number): number | null {
  // Object stream header: "num1 off1 num2 off2 ..." before offset First.
  const head = latin1Decode(data.subarray(0, Math.min(4096, data.length)));
  const tokens = head.split(/\s+/).filter((token) => token.length > 0);
  const token = tokens[index * 2];
  if (token === undefined) return null;
  const value = Number.parseInt(token, 10);
  return Number.isFinite(value) ? value : null;
}

function readField(data: Uint8Array, at: number, width: number): number {
  let value = 0;
  for (let i = 0; i < width; i += 1) value = value * 256 + (data[at + i] ?? 0);
  return value;
}

function findRootByScan(bytes: Uint8Array, entries: Map<number, XrefEntry>): PdfRef | null {
  for (const [num, entry] of entries) {
    if (entry.kind !== 'normal') continue;
    const object = parseIndirectAt(bytes, entry.offset, num);
    const dict = asDict(object);
    if (dict === null) continue;
    if (dictName(dict, 'Type') === 'Catalog') return { kind: 'ref', num, gen: 0 };
  }
  return null;
}
