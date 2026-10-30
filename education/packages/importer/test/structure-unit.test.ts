import { describe, expect, it } from 'vitest';

import { isInsideRoots } from '../src/assets.js';
import { stableStringify } from '../src/import/storage.js';
import { PARSER_VERSION, type PageExtraction } from '../src/import/types.js';
import { buildPageStructure } from '../src/structure/blocks.js';
import { materialInventory } from '../src/materials.js';
import { parseToUnicodeCMap } from '../src/pdf/text.js';
import { detectPrintedPage, summarizePageMapping } from '../src/structure/page-map.js';
import { detectTocCandidates } from '../src/structure/toc.js';
import { normalizeOcrText, scoreQuality } from '../src/structure/text.js';
import { encodeGrayscalePng, readPngSize } from '../src/util/png.js';

function extraction(page: number, lines: { text: string; y: number; height?: number }[]): PageExtraction {
  return {
    page,
    method: 'ocr',
    textAvailable: true,
    unavailableReason: null,
    lines: lines.map((line) => ({
      text: line.text,
      bbox: { x: 0.1, y: line.y, width: 0.6, height: line.height ?? 0.02 },
      fontSize: null,
    })),
    glyphCount: 10,
    undecodableGlyphs: 0,
    quality: scoreQuality({ lines, method: 'ocr' }),
    pageImageAssetId: 'asset:pg-1',
    renderMs: 100,
    ocrMs: 50,
    parserVersion: PARSER_VERSION,
    sha256: 'a'.repeat(64),
  };
}

describe('OCR text normalisation and quality', () => {
  it('collapses the engine space between CJK characters but keeps latin spacing', () => {
    // A space between two CJK characters is an engine artifact; a space next to
    // a digit or latin word is kept (the importer never joins words blindly).
    expect(normalizeOcrText('第 1 单 元 的 生 物 圈 ， 你 好')).toBe('第 1 单元的生物圈，你好');
    expect(normalizeOcrText('Page two body text.')).toBe('Page two body text.');
    expect(normalizeOcrText('图 2-1 显 微 镜')).toBe('图 2-1 显微镜');
  });

  it('flags empty and low character pages instead of scoring them as good', () => {
    expect(scoreQuality({ lines: [], method: 'ocr' }).flags).toContain('EMPTY');
    expect(scoreQuality({ lines: [], method: 'ocr' }).score).toBe(0);
    const short = scoreQuality({ lines: [{ text: '细胞' }], method: 'ocr' });
    expect(short.flags).toContain('LOW_CHARS');
    expect(short.score).toBeLessThan(0.9);
    const textLayer = scoreQuality({ lines: [{ text: 'A full text layer line.' }], method: 'text_layer' });
    expect(textLayer.flags).toContain('TEXT_LAYER');
    expect(textLayer.score).toBe(1);
  });
});

describe('page structure block building', () => {
  it('keeps decorative top-margin noise out of content blocks but counts it', () => {
    const page = extraction(1, [
      { text: '身 禹 上', y: 0.005, height: 0.012 },
      { text: '正 文 第 一 行 内 容 比 较 长', y: 0.2 },
      { text: '5', y: 0.96 },
    ]);
    const structure = buildPageStructure({ extraction: page, sha256: 'a'.repeat(64) });
    expect(structure.headerArtifacts).toHaveLength(1);
    expect(structure.blocks.map((block) => block.originalText)).not.toContain('身 禹 上');
    expect(structure.blocks).toHaveLength(1);
    // A real short heading outside the top margin is not dropped.
    const withHeading = extraction(2, [
      { text: '第一单元', y: 0.12, height: 0.03 },
      { text: '正 文', y: 0.2 },
    ]);
    const headingStructure = buildPageStructure({ extraction: withHeading, sha256: 'a'.repeat(64) });
    expect(headingStructure.headerArtifacts).toHaveLength(0);
    expect(headingStructure.blocks).toHaveLength(2);
  });
});

describe('printed page and TOC detection', () => {  it('reads a footer page number as a printed page label', () => {
    const page = extraction(5, [
      { text: '正 文 内 容', y: 0.2 },
      { text: '1', y: 0.96 },
    ]);
    const evidence = detectPrintedPage(page);
    expect(evidence).toEqual({ page: 5, printedPage: '1', sourceLine: '1', confidence: 'high' });
  });

  it('supports 第 X 页, P.12 and roman labels, and returns null when absent', () => {
    expect(detectPrintedPage(extraction(1, [{ text: '第 3 页', y: 0.95 }]))?.printedPage).toBe('3');
    expect(detectPrintedPage(extraction(2, [{ text: 'P.12', y: 0.02 }]))?.printedPage).toBe('12');
    expect(detectPrintedPage(extraction(3, [{ text: 'iv', y: 0.97 }]))?.printedPage).toBe('iv');
    expect(detectPrintedPage(extraction(4, [{ text: '正文', y: 0.5 }]))).toBeNull();
  });

  it('computes the offset distribution without inventing a mapping', () => {
    const summary = summarizePageMapping([
      { page: 5, printedPage: '1', sourceLine: '1', confidence: 'high' },
      { page: 6, printedPage: '2', sourceLine: '2', confidence: 'high' },
      { page: 7, printedPage: '3', sourceLine: '3', confidence: 'high' },
    ]);
    expect(summary.offsets).toEqual([{ offset: -4, count: 3 }]);
    expect(summary.dominantOffset).toBe(-4);
    expect(summary.consistent).toBe(true);
  });

  it('proposes TOC candidates with the printed page numbers, not a PDF page guess', () => {
    const pages = [
      extraction(3, [
        { text: '目 录', y: 0.08 },
        { text: '第一单元 生物和生物圈........1', y: 0.2 },
        { text: '第二单元 生物体的结构层次........21', y: 0.24 },
      ]),
    ].map((page) => ({ ...page, method: 'text_layer' as const }));
    const candidates = detectTocCandidates(pages);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].pdfPage).toBe(3);
    expect(candidates[0].confidence).toBeCloseTo(0.9, 5);
    expect(candidates[0].entries.map((entry) => entry.printedPage)).toEqual(['1', '21']);
    expect(candidates[0].entries.every((entry) => entry.pdfPage === null)).toBe(true);
  });
});

describe('PDF font decoding helpers', () => {
  it('parses a ToUnicode CMap with bfchar and bfrange entries', () => {
    const cmap = [
      '/CIDInit /ProcSet findresource begin',
      'begincmap',
      '1 begincodespacerange',
      '<0000> <FFFF>',
      'endcodespacerange',
      '1 beginbfchar',
      '<0001> <751F>',
      'endbfchar',
      '1 beginbfrange',
      '<0002> <0004> <7269>',
      'endbfrange',
      'endcmap',
    ].join('\n');
    const parsed = parseToUnicodeCMap(cmap);
    expect(parsed.codeByteLength).toBe(2);
    expect(parsed.map.get(1)).toBe('生');
    expect(parsed.map.get(2)).toBe('物');
    // bfrange increments the destination code point, it does not walk glyphs.
    expect(parsed.map.get(3)).toBe(String.fromCharCode(0x726a));
    expect(parsed.map.get(4)).toBe(String.fromCharCode(0x726b));
  });
});

describe('storage and packaging helpers', () => {
  it('writes stable JSON with sorted keys', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('encodes a real PNG that can be read back', () => {
    const png = encodeGrayscalePng(12, 8, (x, y) => ((x + y) % 2 === 0 ? 255 : 0));
    expect(readPngSize(png)).toEqual({ width: 12, height: 8 });
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('checks path containment without prefix confusion', () => {
    const root = process.platform === 'win32' ? 'C:\\data\\edu' : '/data/edu';
    expect(isInsideRoots(root, [root])).toBe(true);
    expect(isInsideRoots(`${root}\\book.pdf`, [root])).toBe(true);
    expect(isInsideRoots(`${root}-other\\book.pdf`, [root])).toBe(false);
    expect(isInsideRoots(process.platform === 'win32' ? 'D:\\elsewhere\\book.pdf' : '/elsewhere/book.pdf', [root])).toBe(false);
  });

  it('lists the T16 materials without a Python or external OCR binary requirement', () => {
    const materials = materialInventory();
    const names = materials.map((entry) => entry.name).join(' | ');
    expect(names).toContain('Windows.Data.Pdf');
    expect(names).toContain('Windows.Media.Ocr');
    expect(names).toContain('OCR language pack zh-Hans-CN');
    const forbidden = materials.filter((entry) => entry.required && /Tesseract|Ghostscript|Poppler|Python/i.test(entry.name));
    expect(forbidden).toHaveLength(0);
    const optional = materials.find((entry) => /Tesseract/.test(entry.name));
    expect(optional?.required).toBe(false);
    expect(optional?.notes).toContain('no Python');
  });
});
