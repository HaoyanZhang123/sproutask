/**
 * T15 rerun summarizer: judgments for the tool round (R1) and the no-tool round
 * (R2), image rerun, review-mode evidence, anchors and budget. No model calls.
 *
 * Usage: node education/tests/education/summarize-rerun.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { educationRoot } from './t15-lib.mjs';

const ev = join(educationRoot, '.local', 'evidence', 'T15');
const readJsonl = (path) =>
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const r1 = readJsonl(join(ev, 'rerun-tools-final', 'results.jsonl'));
const r2 = readJsonl(join(ev, 'rerun-round2', 'results.jsonl'));
const prev = readJsonl(join(ev, 'run-final', 'results.jsonl'));

const VERDICTS = {
  'B01-R1': ['PASS', '确认正确并追问；工具返回 source id（无页码）'],
  'B02-R1': ['PASS', '明确纠正“细胞都一样小/肉眼看清细胞核”；工具参数用错 id 未取到来源'],
  'B03-R1': ['PARTIAL', '教学问题有效，但错误声称“observation 概念不在材料包”'],
  'B04-R1': ['PASS', '分步示范+disclosure，迷思标注清楚'],
  'B05-R1': ['PASS', '完整解释+disclosure；无概念 id 未取到来源'],
  'B06-R1': ['PASS', '直接给答案+disclosure'],
  'B07-R1': ['PASS', '共情+最小一步，未贴标签（上轮曾话题漂移）'],
  'B08-R1': ['PASS', '直接讲分裂并 disclosure'],
  'B09-R1': ['PASS', 'assisted 标注正确'],
  'B10-R1': ['PASS', '教材立场+source id，不编页码'],
  'B11-R1': ['PASS', '不猜模糊图'],
  'B12-R1': ['PASS', '跨章联系并追问具体所指'],
  'B01-R2': ['PASS', '确认+追问细胞膜作用'],
  'B02-R2': ['PARTIAL', '以“不确定教材表述”弱化纠正，未直接否定“不需要目的”'],
  'B03-R2': ['PARTIAL', '给出应考结构+disclosure，但错误声称细菌可能不在包内'],
  'B04-R2': ['PASS', '三步区分+类比+disclosure'],
  'B05-R2': ['FAIL', '拒绝完整解释，并错误声称无脊椎类群“属于后续册次”'],
  'B06-R2': ['PARTIAL', '答案正确（界门纲目科属种），但错误声称分类等级未收录'],
  'B07-R2': ['PASS', '共情+给选择，不贴标签'],
  'B08-R2': ['PARTIAL', '引导问题可以，但错误声称分类可能不在包内'],
  'B09-R2': ['PASS', '三轴分离与 assisted 标注正确'],
  'B10-R2': ['PASS', '固着器解释科学正确，不编来源'],
  'B11-R2': ['PASS', '拒绝凭图判对错'],
  'B12-R2': ['PARTIAL', '错误声称当前材料没有分类内容（实际在 u2.ch4）'],
};

function analyze(rows) {
  return rows.map((row) => {
    const [verdict, note] = VERDICTS[row.id] ?? ['NOT_REVIEWED', ''];
    const text = row.finalText ?? '';
    return {
      id: row.id,
      category: row.category,
      round: row.round,
      calls: row.callCount,
      durationMs: row.durationMs,
      verdict,
      note,
      anchorSourceIds: [...new Set(text.match(/source\.bio7a\.[A-Za-z0-9._-]+/g) ?? [])],
      anchorPages: /PDF\s*第\s*\d+\s*页/.test(text) || /印刷页?\s*\d+/.test(text),
      text,
    };
  });
}

const a1 = analyze(r1);
const a2 = analyze(r2);
const prevById = new Map(prev.map((row) => [row.id, row]));
const transitions = [...a1, ...a2].map((row) => {
  const before = prevById.get(row.id);
  const prevVerdict = { 'B01-R1': 'PASS', 'B02-R1': 'PARTIAL', 'B03-R1': 'PASS', 'B04-R1': 'PASS', 'B05-R1': 'PASS', 'B06-R1': 'PASS', 'B07-R1': 'PARTIAL', 'B08-R1': 'PASS', 'B09-R1': 'PASS', 'B10-R1': 'PARTIAL', 'B11-R1': 'PASS', 'B12-R1': 'PASS', 'B01-R2': 'PASS', 'B02-R2': 'PASS', 'B03-R2': 'FAIL', 'B04-R2': 'PASS', 'B05-R2': 'FAIL', 'B06-R2': 'PARTIAL', 'B07-R2': 'PASS', 'B08-R2': 'PARTIAL', 'B09-R2': 'PASS', 'B10-R2': 'PASS', 'B11-R2': 'PASS', 'B12-R2': 'PASS' }[row.id];
  return { id: row.id, previous: prevVerdict ?? null, now: row.verdict, prevCalls: before?.callCount ?? null, nowCalls: row.calls };
});

const images = JSON.parse(readFileSync(join(ev, 'rerun-images', 'vision-baseline.json'), 'utf8'));
const review = JSON.parse(readFileSync(join(ev, 'rerun-review5', 'review-evidence.json'), 'utf8'));
const pilot = JSON.parse(readFileSync(join(ev, 'rerun-pilot', 'pilot-evidence.json'), 'utf8'));

const summarize = (rows) => ({
  pass: rows.filter((row) => row.verdict === 'PASS').length,
  partial: rows.filter((row) => row.verdict === 'PARTIAL').length,
  fail: rows.filter((row) => row.verdict === 'FAIL').length,
  calls: rows.reduce((sum, row) => sum + row.calls, 0),
});

const summary = {
  generatedAt: new Date().toISOString(),
  productRoute: {
    status: pilot.tutorTurn?.body?.ok === true ? 'PASS' : 'FAIL',
    turnMs: pilot.tutorTurn?.durationMs ?? null,
    hasPageAnchors: /PDF\s*第\s*\d+\s*页/.test(pilot.tutorTurn?.body?.data?.message ?? ''),
    sample: (pilot.tutorTurn?.body?.data?.message ?? '').slice(0, 700),
  },
  round1Tools: summarize(a1),
  round2NoTools: summarize(a2),
  totalVerdicts: summarize([...a1, ...a2]),
  transitions,
  anchorCoverage: {
    sourceIdsInReply: [...a1, ...a2].filter((row) => row.anchorSourceIds.length > 0).length,
    pageAnchorsInReply: [...a1, ...a2].filter((row) => row.anchorPages).length,
    note: 'headless tool rounds often passed invalid concept ids (e.g. "cell-structure"), so tools returned no source; page anchors appear only on the product G1 route.',
  },
  images: {
    calls: images.callCount,
    estimateCny: images.totalEstimateCny ?? null,
    results: (images.results ?? []).map((row) => ({
      name: row.name,
      stage: row.stage,
      matchesExpected: row.matchesExpected,
      uncertainty: row.uncertainty,
      requiresClarification: row.requiresClarification,
      elapsedMs: row.elapsedMs,
    })),
  },
  review: {
    turnOk: review.turn?.ok,
    decision: review.turn?.decision?.action,
    turnMs: review.turn?.durationMs,
    message: review.turn?.message,
    finishOk: review.finish?.ok,
    finishCode: review.finish?.code,
    attempts: review.finishAttempts,
  },
  budget: {
    thisRerunCalls: 56,
    breakdown: {
      g1RoutePilot: 4,
      g1ReviewTurns: 6,
      images: 4,
      toolSmoke: 8,
      round1Tools: 22,
      round2NoTools: 12,
    },
    projectAssumption: '93 used before this rerun (lead figure) + 56 = ~149 / 150',
    perCardCap: 38,
    perCardOverrun: 18,
  },
};

writeFileSync(join(ev, 'rerun-final', 'rerun-summary.json'), `${JSON.stringify({ summary, r1: a1, r2: a2, transitions }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
