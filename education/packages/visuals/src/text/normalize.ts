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
