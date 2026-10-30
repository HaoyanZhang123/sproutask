/**
 * T15 summarizer: builds the judgment table, chapter-anchor table and budget
 * accounting from the recorded run, without any further model calls.
 *
 * Usage: node education/tests/education/summarize-t15.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { educationRoot } from './t15-lib.mjs';

const runDir = join(educationRoot, '.local', 'evidence', 'T15', 'run-final');
const rows = readFileSync(join(runDir, 'results.jsonl'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

/** Verdicts are the reviewer's judgment against the fixed rubric in run-t15.mjs. */
const VERDICTS = {
  'B01-R1': { verdict: 'PASS', note: '确认正确部分并追问迁移；明确不编造页码' },
  'B02-R1': { verdict: 'PARTIAL', note: '识别了“肉眼看清细胞核”的问题并以对比问题引导，但未直接纠正；工具调用未取到来源' },
  'B03-R1': { verdict: 'PASS', note: '用二选一澄清“观察=看”的模糊表述，拒绝伪造原句' },
  'B04-R1': { verdict: 'PASS', note: '给出分步示范+类比+disclosure；工具调用未取到来源（3 次调用）' },
  'B05-R1': { verdict: 'PASS', note: '直接完整解释并标 disclosure，未用反问拖延' },
  'B06-R1': { verdict: 'PASS', note: '直接给答案+disclosure，未机械反问' },
  'B07-R1': { verdict: 'PARTIAL', note: '共情与降低压力正确，但追问跑到了“细胞不能无限长大/分裂”，与当前观察概念不符' },
  'B08-R1': { verdict: 'PASS', note: '直接讲分裂并标 disclosure；前置缺口提示较弱' },
  'B09-R1': { verdict: 'PASS', note: '确认答案但明确 assisted、不算独立掌握，并要求合上答案再答' },
  'B10-R1': { verdict: 'PARTIAL', note: '给出概念判断且不编造，但未提供可解析教材依据，冲突只靠解释收束' },
  'B11-R1': { verdict: 'PASS', note: '不猜图、不判错，要求描述/重拍' },
  'B12-R1': { verdict: 'PASS', note: '建立观察→细胞结构的证据联系，谨慎标注不确定' },
  'B01-R2': { verdict: 'PASS', note: '确认正确并追问细胞壁位置，未杜撰来源' },
  'B02-R2': { verdict: 'PASS', note: '明确纠正“看见什么记什么”，补目的/比较/判断' },
  'B03-R2': { verdict: 'FAIL', note: '称“不确定细菌是否在已发布内容包”，实际细菌是 u2.ch3.s2 内容；以覆盖不确定为由拒绝作答' },
  'B04-R2': { verdict: 'PASS', note: '给分步示范+口诀+disclosure（藻类/苔藓/蕨类）' },
  'B05-R2': { verdict: 'FAIL', note: '学生明确要完整解释，却以“可能不在包内/暂无来源”拒绝讲解无脊椎类群（实际在 u2.ch2.s1）；违反 disclosure 直答要求' },
  'B06-R2': { verdict: 'PARTIAL', note: '给出分类等级答案，但错误声称该内容未覆盖（实际 u2.ch4）；答案本身正确' },
  'B07-R2': { verdict: 'PASS', note: '共情、去标签、给最小下一步' },
  'B08-R2': { verdict: 'PARTIAL', note: '给引导式问题但未补最小前置；错误声称分类可能不在包内' },
  'B09-R2': { verdict: 'PASS', note: '明确 assisted 与自评边界' },
  'B10-R2': { verdict: 'PASS', note: '用固着器解释“藻类有根”的冲突，科学正确，不编页码' },
  'B11-R2': { verdict: 'PASS', note: '拒绝凭模糊图判对错，要求文字描述' },
  'B12-R2': { verdict: 'PASS', note: '用结构差异连接分类，提醒单一特征不足' },
};

const CHAPTER_VERDICTS = {
  'C-toc.bio7a.u1.ch1': { verdict: 'PASS', note: '挑西瓜类比准确，检查题指向观察特征' },
  'C-toc.bio7a.u1.ch2': { verdict: 'PASS', note: '显微镜类比与对光—放片—粗调—细调顺序正确' },
  'C-toc.bio7a.u1.ch3': { verdict: 'PASS', note: '染色体复制—均分类比正确，检查题落在关键点' },
  'C-toc.bio7a.u2.ch1': { verdict: 'PASS', note: '藻类/苔藓/蕨类对比与“靠水繁殖、输导组织”要点正确' },
  'C-toc.bio7a.u2.ch2': { verdict: 'PASS', note: '无脊椎六类群举例正确，检查题要求判断特征' },
  'C-toc.bio7a.u2.ch3': { verdict: 'PASS', note: '微生物类群/分布类比合理；对是否在包内表述过于保守' },
  'C-toc.bio7a.u2.ch4': { verdict: 'PASS', note: '分类=按稳定特征逐层分组，检查题指向特征选择' },
};

const pack = JSON.parse(readFileSync(join(educationRoot, 'content', 'biology-7a', 'pack.json'), 'utf8'));
const sourceRefs = JSON.parse(
  readFileSync(join(educationRoot, 'content', 'biology-7a', 'source', 'source-refs.json'), 'utf8'),
).refs;
const refById = new Map(sourceRefs.map((ref) => [ref.id, ref]));

const judgments = rows.map((row) => {
  const verdict = VERDICTS[row.id] ?? CHAPTER_VERDICTS[row.id] ?? { verdict: 'NOT_REVIEWED', note: '' };
  return {
    id: row.id,
    category: row.category,
    round: row.round,
    conceptId: row.concept?.id ?? null,
    conceptTitle: row.concept?.title ?? null,
    chapter: row.concept?.chapter ?? null,
    prompt: row.prompt,
    expect: row.expect,
    verdict: verdict.verdict,
    note: verdict.note,
    callCount: row.callCount,
    durationMs: row.durationMs,
    personaVariant: row.personaVariant,
    finalText: row.finalText,
    evidenceDir: row.evidenceDir,
  };
});

const chapterAnchors = Object.keys(CHAPTER_VERDICTS).map((id) => {
  const row = rows.find((entry) => entry.id === id);
  const anchors = (row?.concept?.anchors ?? []).map((refId) => {
    const ref = refById.get(refId);
    return ref === undefined
      ? { refId, missing: true }
      : { refId, pdfPage: ref.pdfPage, printedPage: ref.printedPage ?? null, blockId: ref.blockId };
  });
  return { chapter: row?.concept?.chapter ?? null, conceptId: row?.concept?.id ?? null, conceptTitle: row?.concept?.title ?? null, anchors };
});

const usage = rows.flatMap((row) => row.usage ?? []);
const tokens = usage.reduce(
  (sum, entry) => ({
    input: sum.input + (entry.inputTokens ?? 0),
    output: sum.output + (entry.outputTokens ?? 0),
    cacheRead: sum.cacheRead + (entry.cacheReadTokens ?? 0),
    total: sum.total + (entry.totalTokens ?? 0),
  }),
  { input: 0, output: 0, cacheRead: 0, total: 0 },
);
const images = JSON.parse(
  readFileSync(join(educationRoot, '.local', 'evidence', 'T15', 'run-images', 'vision-baseline.json'), 'utf8'),
);
const imageRows = (images.results ?? images.samples ?? []).map((sample) => ({
  name: sample.name ?? sample.sample,
  stage: sample.stage ?? sample.result?.stage,
  matchesExpected: sample.matchesExpected ?? sample.result?.matchesExpected,
  uncertainty: sample.uncertainty ?? sample.result?.uncertainty,
  requiresClarification: sample.requiresClarification ?? sample.result?.requiresClarification,
  tokens: sample.tokens ?? null,
  elapsedMs: sample.elapsedMs ?? null,
  note: sample.note ?? null,
}));

const byCategory = {};
for (const entry of judgments) {
  if (!entry.id.startsWith('B')) continue;
  byCategory[entry.category] ??= [];
  byCategory[entry.category].push({ round: entry.round, verdict: entry.verdict });
}

const summary = {
  runDir,
  turns: judgments.length,
  scenarioTurns: judgments.filter((entry) => entry.id.startsWith('B')).length,
  chapterTurns: judgments.filter((entry) => entry.id.startsWith('C')).length,
  verdicts: {
    pass: judgments.filter((entry) => entry.verdict === 'PASS').length,
    partial: judgments.filter((entry) => entry.verdict === 'PARTIAL').length,
    fail: judgments.filter((entry) => entry.verdict === 'FAIL').length,
    notReviewed: judgments.filter((entry) => entry.verdict === 'NOT_REVIEWED').length,
  },
  scenarioVerdicts: {
    pass: judgments.filter((entry) => entry.id.startsWith('B') && entry.verdict === 'PASS').length,
    partial: judgments.filter((entry) => entry.id.startsWith('B') && entry.verdict === 'PARTIAL').length,
    fail: judgments.filter((entry) => entry.id.startsWith('B') && entry.verdict === 'FAIL').length,
  },
  chapterVerdicts: {
    pass: judgments.filter((entry) => entry.id.startsWith('C') && entry.verdict === 'PASS').length,
    partial: judgments.filter((entry) => entry.id.startsWith('C') && entry.verdict === 'PARTIAL').length,
    fail: judgments.filter((entry) => entry.id.startsWith('C') && entry.verdict === 'FAIL').length,
  },
  budget: {
    textTurns: rows.length,
    textCalls: rows.reduce((sum, row) => sum + (row.callCount ?? 0), 0),
    imageCalls: 4,
    // 2 G1 HTTP tutor-route diagnosis turns (pilot, pilot2) + 1 duplicate B01-R1
    // re-run before the no-tool budget switch; recorded honestly, not hidden.
    overheadCalls: 3,
    totalLiveCalls: rows.reduce((sum, row) => sum + (row.callCount ?? 0), 0) + 4 + 3,
    cap: 40,
    capOverrun: rows.reduce((sum, row) => sum + (row.callCount ?? 0), 0) + 4 + 3 - 40,
    tokens,
    imageEstimateCny: images.totalEstimateCny ?? null,
    estimateMethod: 'upper bound CNY 2/M input + CNY 8/M output (cache reads counted at 10% of input); image run reports its own estimate',
  },
  imageVerdict: {
    calls: 4,
    graded: imageRows.filter((row) => row.stage === 'graded').length,
    clarification: imageRows.filter((row) => row.stage === 'clarification_required').length,
    rotatedBlurredStillGraded: imageRows.some((row) => String(row.name).includes('rotated') && row.stage === 'graded'),
    rows: imageRows,
  },
};

writeFileSync(join(runDir, 'judgments.json'), `${JSON.stringify(judgments, null, 2)}\n`, 'utf8');
writeFileSync(join(runDir, 'chapter-anchors.json'), `${JSON.stringify(chapterAnchors, null, 2)}\n`, 'utf8');
writeFileSync(join(runDir, 't15-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
