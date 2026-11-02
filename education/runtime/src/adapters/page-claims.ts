/**
 * Page-claim guard.
 *
 * The model is allowed to cite pages only from what the tools actually returned
 * during this turn. A real sample showed "生物学分类" answered with the printed
 * page of the *bacteria* section (103) because the pack has `printedPage: null`
 * for most sources and the model filled the gap from memory.
 *
 * This guard neutralises unsupported numbers instead of deleting the reference:
 * the student still sees "课本相应页（页码以出处为准）" and can open 查看出处.
 */

export interface PageEvidence {
  readonly pdfPages: readonly number[];
  readonly printedPages: readonly string[];
}

export interface PageClaimResult {
  readonly text: string;
  /** Human-readable list of the claims that were replaced, for the audit log. */
  readonly replaced: readonly string[];
}

function numbersIn(list: string): readonly string[] {
  return list
    .split(/[、,，/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function allSupported(list: string, allowed: ReadonlySet<string>): boolean {
  const numbers = numbersIn(list);
  return numbers.length > 0 && numbers.every((number) => allowed.has(number));
}

/**
 * Replaces unsupported page claims:
 * - `PDF 第 131 页` / `PDF 131、133 页` → kept only if every number is in `pdfPages`
 * - `课本第 73 页` / `教材第 73 页` / `印刷页 73` → kept only if every number is in `printedPages`
 *
 * Text without page claims is returned unchanged.
 */
export function neutralizeUnsupportedPages(text: string, evidence: PageEvidence): PageClaimResult {
  if (typeof text !== 'string' || text.length === 0) return { text, replaced: [] };
  const pdf = new Set(evidence.pdfPages.map((page) => String(page)));
  const printed = new Set(evidence.printedPages.map((page) => page.trim()).filter((page) => page.length > 0));
  const replaced: string[] = [];

  let out = text.replace(
    /PDF\s*第?\s*(\d{1,4}(?:\s*[、,，/]\s*\d{1,4})*)\s*页/gi,
    (match: string, list: string): string => {
      if (allSupported(list, pdf)) return match;
      replaced.push(`pdf:${numbersIn(list).join('/')}`);
      return 'PDF 相应页（以出处为准）';
    },
  );

  out = out.replace(
    /(?:课本|教材|印刷页)\s*第?\s*(\d{1,4}(?:\s*[、,，/]\s*\d{1,4})*)\s*页/g,
    (match: string, list: string): string => {
      if (allSupported(list, printed)) return match;
      replaced.push(`printed:${numbersIn(list).join('/')}`);
      return '课本相应页（页码以出处为准）';
    },
  );

  return { text: out, replaced };
}
