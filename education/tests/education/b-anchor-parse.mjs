/**
 * T15 supplementary-budget verification — anchor re-parse (0 model calls).
 *
 * Re-reads the saved raw turn responses and measures anchors with a broader
 * pattern set than the live run: the model writes page anchors in several
 * shapes ("PDF 第11页", "PDF 14／印刷 5", "印刷页18", "印刷页未标注").
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? '.');
const files = readdirSync(dir)
  .filter((name) => name.startsWith('anchor-') && name.endsWith('.json'))
  .sort();

const rules = {
  sourceIds: /source\.[A-Za-z0-9._-]+/gu,
  pdfPage: /PDF\s*第?\s*(\d+)/gu,
  printedPage: /印刷(?:页)?\s*(?:第)?\s*(\d+)/gu,
};

const turns = files.map((file) => {
  const raw = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  const message = raw.response?.data?.message ?? '';
  const decision = raw.response?.data?.decision ?? null;
  const citation = raw.response?.data?.sourceCitation ?? null;
  const collect = (pattern) => [...new Set([...message.matchAll(pattern)].map((match) => match[1] ?? match[0]))];
  const sourceIds = collect(rules.sourceIds);
  const pdfPages = collect(rules.pdfPage).map(Number);
  const printedPages = collect(rules.printedPage).map(Number);
  const decisionRefs = Array.isArray(decision?.sourceRefs) ? decision.sourceRefs : [];
  const citationRefs = Array.isArray(citation?.refs) ? citation.refs : [];
  return {
    file,
    scenario: raw.scenario?.id ?? file,
    kind: raw.scenario?.kind ?? null,
    conceptId: raw.scenario?.conceptId ?? null,
    ok: raw.response?.ok ?? null,
    gateway: raw.response?.data?.gateway ?? null,
    durationMs: raw.durationMs ?? null,
    action: decision?.action ?? null,
    chars: message.length,
    sourceIds,
    pieceOfSourceIds: sourceIds.length,
    pdfPages,
    printedPages,
    decisionSourceRefs: decisionRefs,
    citationRefs,
    citationMissing: citation?.missing ?? null,
    hasSourceAnchor: sourceIds.length > 0 || decisionRefs.length > 0 || citationRefs.length > 0,
    hasPageAnchor: pdfPages.length > 0 || printedPages.length > 0,
    quotedPrintedUnlabelled: /印刷页未标注/u.test(message),
  };
});

const summary = {
  schemaVersion: 1,
  kind: 't15-budget-anchor-reparse',
  generatedAt: new Date().toISOString(),
  modelCalls: 0,
  turns: turns.length,
  sourceAnchorTurns: turns.filter((turn) => turn.hasSourceAnchor).length,
  pageAnchorTurns: turns.filter((turn) => turn.hasPageAnchor).length,
  note: 'page anchors require numeric pdfPage/printedPage in the assistant text; "印刷页未标注" is recorded separately as an honest gap',
  results: turns,
};
writeFileSync(path.join(dir, 'anchor-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  turns: summary.turns,
  sourceAnchorTurns: summary.sourceAnchorTurns,
  pageAnchorTurns: summary.pageAnchorTurns,
  detail: turns.map((turn) => `${turn.scenario}: src=${turn.sourceIds.length} pdf=[${turn.pdfPages}] printed=[${turn.printedPages}] action=${turn.action}`),
}, null, 2));
