/**
 * Page-claim guard: only pages the tools returned in this turn may be cited.
 * A real sample cited the printed page of a different section (103 for
 * "生物分类"), which is a subject-matter error the student would trust.
 */

import { describe, expect, it } from 'vitest';
import { neutralizeUnsupportedPages } from '../src/adapters/page-claims.js';

const EVIDENCE = { pdfPages: [131, 133], printedPages: ['73', '76'] };

describe('neutralizeUnsupportedPages', () => {
  it('keeps page claims that the tools actually returned', () => {
    const text = '参考：课本第 73 页；PDF 第 131 页；课本第 76 页与 PDF 第 133 页。';
    const result = neutralizeUnsupportedPages(text, EVIDENCE);
    expect(result.replaced).toEqual([]);
    expect(result.text).toBe(text);
  });

  it('rewrites a printed page the tools never returned', () => {
    const result = neutralizeUnsupportedPages('本节学习目标见课本印刷页第 103 页（PDF 第 131 页）。', EVIDENCE);
    expect(result.text).not.toContain('103');
    expect(result.text).toContain('课本相应页（页码以出处为准）');
    expect(result.text).toContain('PDF 第 131 页');
    expect(result.replaced).toEqual(['printed:103']);
  });

  it('rewrites a PDF page the tools never returned', () => {
    const result = neutralizeUnsupportedPages('见 PDF 第 112 页。', EVIDENCE);
    expect(result.text).not.toContain('112');
    expect(result.text).toContain('PDF 相应页（以出处为准）');
    expect(result.replaced).toEqual(['pdf:112']);
  });

  it('handles lists: one unsupported number invalidates the whole claim', () => {
    const kept = neutralizeUnsupportedPages('PDF 第 131、133 页', EVIDENCE);
    expect(kept.replaced).toEqual([]);
    const rewritten = neutralizeUnsupportedPages('PDF 第 131、112 页', EVIDENCE);
    expect(rewritten.text).toBe('PDF 相应页（以出处为准）');
    expect(rewritten.replaced).toEqual(['pdf:131/112']);
  });

  it('leaves text without page claims untouched', () => {
    const text = '细胞的边界是细胞膜。参考：本节的出处。';
    expect(neutralizeUnsupportedPages(text, EVIDENCE)).toEqual({ text, replaced: [] });
  });

  it('rewrites everything when the turn returned no pages at all', () => {
    const result = neutralizeUnsupportedPages('课本第 73 页；PDF 第 131 页', { pdfPages: [], printedPages: [] });
    expect(result.text).not.toMatch(/\d{2,}/);
    expect(result.replaced).toHaveLength(2);
  });
});
