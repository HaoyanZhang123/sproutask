/**
 * Text normalization shared by answer comparison and the rule graders.
 *
 * Normalization is deliberately conservative: width/case/whitespace and a few
 * trailing punctuation marks. It never rewrites words, so a student's meaning
 * cannot be changed by the grader.
 */

export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[，。；、,.;!?！？]$/u, '')
    .toLowerCase();
}

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

/** Tokens: latin words (>=2 chars) and CJK bigrams. */
export function textTokens(text: string): Set<string> {
  const normalized = normalizeText(text);
  const tokens = new Set<string>();
  for (const word of normalized.match(/[a-z0-9]{2,}/g) ?? []) tokens.add(word);
  const chars = [...normalized];
  for (let index = 0; index + 1 < chars.length; index += 1) {
    if (CJK.test(chars[index]) && CJK.test(chars[index + 1])) {
      tokens.add(`${chars[index]}${chars[index + 1]}`);
    }
  }
  return tokens;
}

/**
 * 去掉评分要点里的括注说明。
 *
 * `acceptableEvidence` 常写成 "…四个环节（措辞可不同）"、"…至少三项" 这种带说明
 * 的句子；括注是给内容审核看的，学生作答里不会出现，留着会把覆盖率整体压低，
 * 让写得好的回答也判不清。
 */
export function stripCriterionNotes(text: string): string {
  return text
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/中的至少[一二三四五六七八九十\d]+[项条个]/g, '')
    .replace(/\s+/g, '');
}

export function tokenOverlap(needle: string, haystack: Set<string>): number {
  const tokens = textTokens(needle);
  if (tokens.size === 0) return 0;
  let hits = 0;
  for (const token of tokens) if (haystack.has(token)) hits += 1;
  return hits / tokens.size;
}

/** Visible character count (whitespace excluded), used for length rules. */
export function visibleLength(text: string): number {
  return [...text.replace(/\s/g, '')].length;
}
