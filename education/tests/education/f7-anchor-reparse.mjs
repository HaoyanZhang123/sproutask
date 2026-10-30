/**
 * Recompute source/page anchors from already-saved turn responses (0 model calls).
 *
 * `budget-run.mjs` recorded anchors with an older page regex that missed the
 * common "印刷页 3" phrasing (no trailing 页). This script re-reads the saved
 * `turn-*.json` evidence, recomputes the anchors with the fixed patterns and
 * writes `anchors-recomputed.json` next to it. It never calls a model.
 *
 * Usage:
 *   node education/tests/education/f7-anchor-reparse.mjs <evidence-dir> [...]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function analyze(message, decision, sourceCitation) {
  const text = typeof message === 'string' ? message : '';
  const sourceIds = [...new Set(text.match(/source\.[A-Za-z0-9._-]+/gu) ?? [])];
  const pdfPages = [...new Set([...text.matchAll(/PDF\s*第?\s*(\d+)\s*页?/gu)].map((match) => Number(match[1])))];
  const printedPages = [...new Set([...text.matchAll(/印刷(?:页)?\s*第?\s*(\d+)\s*页?/gu)].map((match) => Number(match[1])))];
  const decisionRefs = Array.isArray(decision?.sourceRefs) ? decision.sourceRefs : [];
  const citationRefs = Array.isArray(sourceCitation?.refs) ? sourceCitation.refs : [];
  return {
    chars: text.length,
    sourceIdsInText: sourceIds,
    pdfPagesInText: pdfPages,
    printedPagesInText: printedPages,
    decisionSourceRefs: decisionRefs,
    citationRefs,
    hasSourceAnchor: sourceIds.length > 0 || decisionRefs.length > 0 || citationRefs.length > 0,
    hasPageAnchor: pdfPages.length > 0 || printedPages.length > 0,
    action: decision?.action ?? null,
    disclosure: decision?.disclosure ?? null,
  };
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('usage: node education/tests/education/f7-anchor-reparse.mjs <evidence-dir> [...]');
  process.exit(2);
}

const out = { generatedAt: new Date().toISOString(), modelCalls: 0, dirs: [] };
for (const dir of dirs) {
  const resolved = path.resolve(dir);
  if (!existsSync(resolved)) {
    out.dirs.push({ dir: resolved, missing: true });
    continue;
  }
  const turns = [];
  for (const name of readdirSync(resolved)) {
    if (!/^turn-.*\.json$/u.test(name)) continue;
    const saved = JSON.parse(readFileSync(path.join(resolved, name), 'utf8'));
    const data = saved.response?.data ?? {};
    const anchors = analyze(data.message, data.decision, data.sourceCitation);
    turns.push({
      file: name,
      ok: saved.response?.ok ?? null,
      gateway: data.gateway ?? null,
      action: anchors.action,
      anchors,
      verdict: saved.response?.ok === true && anchors.hasSourceAnchor && anchors.hasPageAnchor ? 'PASS' : 'FAIL',
    });
  }
  out.dirs.push({ dir: resolved, turns });
  writeFileSync(
    path.join(resolved, 'anchors-recomputed.json'),
    `${JSON.stringify({ generatedAt: out.generatedAt, modelCalls: 0, turns }, null, 2)}\n`,
    'utf8',
  );
}

console.log(JSON.stringify(out, null, 2));
