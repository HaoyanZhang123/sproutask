/**
 * T15 evaluation driver: 12 teaching-behaviour categories × 2 rounds, 7 chapter
 * samples, and one source-anchor turn, all through the real DSH headless binding
 * of the education composition (see t15-lib.mjs for why headless).
 *
 * Usage:
 *   node education/tests/education/run-t15.mjs <runDir> [--max-calls N]
 *        [--limit N] [--no-tools] [--no-anchor] [--seed <results.jsonl>]
 *
 * The credential is read by the library and injected into the child environment
 * only; this driver never prints or stores it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { educationRoot, readSkillInstruction, runT15Turn, setupT15Home } from './t15-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(process.argv[2] ?? join(educationRoot, '.local', 'evidence', 'T15', `run-${Date.now()}`));
const valueOf = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};
const maxCalls = Number(valueOf('--max-calls') ?? 34);
const limit = Number(valueOf('--limit') ?? Number.POSITIVE_INFINITY);
const noTools = process.argv.includes('--no-tools');
const noAnchor = process.argv.includes('--no-anchor');
const onlyRound = Number(valueOf('--round') ?? 0);
const seedFile = valueOf('--seed');
mkdirSync(runDir, { recursive: true });

const pack = JSON.parse(readFileSync(join(educationRoot, 'content', 'biology-7a', 'pack.json'), 'utf8'));
const concepts = pack.concepts;
const byChapter = new Map();
for (const concept of concepts) {
  for (const placement of concept.placements ?? []) {
    const match = /^(toc\.bio7a\.u\d+\.ch\d+)/.exec(String(placement));
    if (match === null) continue;
    byChapter.set(match[1], [...(byChapter.get(match[1]) ?? []), concept]);
  }
}
const chapters = [...byChapter.keys()].sort();
const conceptByKeyword = (keyword) =>
  concepts.find((concept) => String(concept.title).includes(keyword)) ??
  concepts.find((concept) => JSON.stringify(concept).includes(keyword)) ??
  null;
const pick = (chapter, keyword) => {
  const list = byChapter.get(chapter) ?? [];
  return list.find((concept) => String(concept.title).includes(keyword)) ?? list[0] ?? concepts[0];
};
const describe = (concept) => ({
  id: concept?.id ?? null,
  title: concept?.title ?? null,
  chapter:
    (concept?.placements ?? [])
      .map((placement) => /^(toc\.bio7a\.u\d+\.ch\d+)/.exec(String(placement))?.[1])
      .find(Boolean) ?? null,
  anchors: (concept?.sourceRefs ?? []).slice(0, 3),
  objective: (concept?.learningObjectives ?? [])[0] ?? null,
  misconceptions: (concept?.misconceptions ?? []).slice(0, 3),
});

const observation = conceptByKeyword('观察') ?? pick('toc.bio7a.u1.ch1');
const plantCell = conceptByKeyword('植物细胞') ?? pick('toc.bio7a.u1.ch2', '植物');
const cellDivision = conceptByKeyword('分裂') ?? pick('toc.bio7a.u1.ch3', '分裂');
const algae = conceptByKeyword('藻类') ?? pick('toc.bio7a.u2.ch1');
const invertebrate = conceptByKeyword('无脊椎') ?? pick('toc.bio7a.u2.ch2');
const bacteria = conceptByKeyword('细菌') ?? pick('toc.bio7a.u2.ch3');
const taxonomy = conceptByKeyword('分类') ?? pick('toc.bio7a.u2.ch4');

const SCENARIOS = [
  {
    id: 'B01',
    category: '正确解释',
    concepts: [observation, plantCell],
    round1: '我觉得观察就是有目的、有计划地仔细看，还要记录和思考，不是随便看一眼。',
    round2: '植物细胞有细胞壁、细胞膜、细胞质和细胞核，细胞壁起支持和保护作用。',
    expect: '确认学生正确部分并补充/深化，不否定正确理解，不机械反问',
  },
  {
    id: 'B02',
    category: '核心误解',
    concepts: [plantCell, observation],
    round1: '细胞都特别小，所以只要眼睛够好就能直接看清细胞核，不用显微镜。',
    round2: '观察就是看见什么记什么，不需要目的，也不需要思考。',
    expect: '明确指出误解并给出正确区分，不把误解当结论',
  },
  {
    id: 'B03',
    category: '只背术语',
    concepts: [observation, bacteria],
    round1: '观察就是观察，反正书上是这么写的。',
    round2: '细菌就是细菌啊，老师你就告诉我考试怎么写。',
    expect: '要求用自己的话解释关键特征，给出可检查的理解路径',
  },
  {
    id: 'B04',
    category: '连续答不出',
    concepts: [cellDivision, algae],
    round1: '老师我问了两次都没答上来，现在还是不知道细胞分裂到底发生了什么。',
    round2: '我前面两次都没答出来，藻类、苔藓、蕨类我完全分不清。',
    expect: '降低难度、换表征、给分步示范或直接解释，不重复同一问法',
  },
  {
    id: 'B05',
    category: '请求完整解释',
    concepts: [cellDivision, invertebrate],
    round1: '请完整解释一下细胞分裂的过程和结果。',
    round2: '请把无脊椎动物分成哪几类、各有什么特点完整讲一遍。',
    expect: '直接给出完整解释，标注 disclosure，说明后续作答不算独立证据',
  },
  {
    id: 'B06',
    category: '只要答案',
    concepts: [plantCell, taxonomy],
    round1: '别问我问题，直接告诉我植物细胞有哪些结构。',
    round2: '直接给答案：生物分类的等级从大到小是什么？不要反问。',
    expect: '直接给答案并 disclosure，不用问题拖延',
  },
  {
    id: 'B07',
    category: '受挫',
    concepts: [observation, bacteria],
    round1: '我太笨了，怎么学都学不会，不想学了。',
    round2: '我一直答错，感觉很挫败，生物是不是不适合我？',
    expect: '先共情与降低压力，给一个小步骤，不贴标签不虚构评分',
  },
  {
    id: 'B08',
    category: '无前置',
    concepts: [cellDivision, taxonomy],
    round1: '我还没学细胞的结构，直接给我讲细胞分裂吧。',
    round2: '我还没学前面几章，直接讲生物分类的方法可以吗？',
    expect: '指出前置缺口并给最小必要铺垫，不阻断学习',
  },
  {
    id: 'B09',
    category: '已看答案再答',
    concepts: [plantCell, observation],
    round1: '我已经看了答案，植物细胞有细胞壁、细胞膜、细胞质、细胞核，我答对了吧？',
    round2: '答案我看了，观察要有目的有计划，这次算我掌握了吗？',
    expect: '确认答案但不把看答案后作答当独立掌握证据，说明 assisted',
  },
  {
    id: 'B10',
    category: '教材与学生说法冲突',
    concepts: [observation, algae],
    round1: '课本上说观察要有目的，可补习班老师说观察就是随便看看，谁对？',
    round2: '教材说藻类没有根茎叶的分化，但我记得藻类有根，到底哪个对？',
    expect: '以可解析教材依据为准说明冲突，不编造页码或原句',
  },
  {
    id: 'B11',
    category: '模糊图片',
    concepts: [plantCell, invertebrate],
    round1: '我拍了一张显微镜下的照片，但特别模糊，你能看出这是植物细胞还是动物细胞吗？',
    round2: '我上传的图看不清，你能直接判我写对了吗？',
    expect: '不猜图、不判错，要求重拍/旋转/改用文字描述',
  },
  {
    id: 'B12',
    category: '跨章迁移',
    concepts: [observation, taxonomy],
    round1: '观察这种学习方法，和后面学细胞结构有什么关系？',
    round2: '前面学的细胞结构，能帮我理解后面生物分类吗？',
    expect: '建立跨章节联系并说明依据，不硬造关系',
  },
];

function scenarioRecord(scenario, round) {
  const concept = scenario.concepts[round - 1] ?? scenario.concepts[0];
  return {
    id: `${scenario.id}-R${round}`,
    category: scenario.category,
    round,
    concept: describe(concept),
    prompt: round === 1 ? scenario.round1 : scenario.round2,
    expect: scenario.expect,
  };
}

const turns = [];
for (const round of [1, 2]) for (const scenario of SCENARIOS) turns.push(scenarioRecord(scenario, round));

const chapterTurns = chapters.map((chapter) => {
  const concept = byChapter.get(chapter)?.[0] ?? concepts[0];
  return {
    id: `C-${chapter}`,
    category: '章节抽样',
    round: 1,
    concept: describe(concept),
    prompt: `请用生活中的例子讲解「${concept.title}」，讲完问我一个能检查我是否理解的小问题。`,
    expect: '讲解科学正确、有生活例子、结尾有一个检查理解的问题',
  };
});

const anchorTurn = {
  id: 'A-source',
  category: '来源锚点',
  round: 1,
  concept: describe(plantCell),
  prompt: '请告诉我「植物细胞」这一节在教材的第几页（PDF 页和印刷页都要），并说明依据。',
  expect: '调用教育工具解析来源；给出可解析的页锚点或明确说暂无来源，不编造页码',
};

const seeded =
  seedFile === null
    ? []
    : readFileSync(seedFile, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
const skipIds = new Set(seeded.map((entry) => entry.id));
const basePlan = onlyRound > 0 ? turns.filter((turn) => turn.round === onlyRound) : [...turns, ...chapterTurns, ...(noAnchor ? [] : [anchorTurn])];
const planned = basePlan.filter((turn) => !skipIds.has(turn.id)).slice(0, limit);

const skillChars = readSkillInstruction().length;
const setup = setupT15Home(join(runDir, 'home'), { withTools: !noTools });
writeFileSync(
  join(runDir, 'setup.json'),
  `${JSON.stringify({ ...setup, skillChars, withTools: !noTools, seededTurns: seeded.length }, null, 2)}\n`,
  'utf8',
);
writeFileSync(
  join(runDir, 'plan.json'),
  `${JSON.stringify({ maxCalls, plannedTurns: planned.length, skippedBySeed: [...skipIds], skillChars, withTools: !noTools }, null, 2)}\n`,
  'utf8',
);

let calls = seeded.reduce((sum, entry) => sum + (entry.callCount ?? 0), 0);
const results = [...seeded];
for (const turn of planned) {
  if (calls >= maxCalls) {
    results.push({ ...turn, status: 'skipped-budget', callCount: 0 });
    continue;
  }
  const out = join(runDir, 'turns', turn.id);
  const index = results.length + 1;
  process.stdout.write(`[${index}] ${turn.id} ${turn.category} … `);
  const run = runT15Turn({ home: join(runDir, 'home'), work: join(runDir, 'work'), out, prompt: turn.prompt });
  calls += run.callCount;
  const record = {
    ...turn,
    personaVariant: noTools ? 'v2-no-tools' : 'v1-tools-allowed',
    status: run.exitCode === 0 && run.finalText.length > 0 ? 'ok' : 'failed',
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    callCount: run.callCount,
    usage: run.usageRecords,
    finalText: run.finalText,
    stderrTail: run.stderrTail,
    evidenceDir: out,
  };
  results.push(record);
  writeFileSync(join(runDir, 'results.jsonl'), `${results.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
  process.stdout.write(`${record.status} calls=${run.callCount} ${Math.round(run.durationMs / 1000)}s\n`);
}

const summary = {
  runDir,
  skillChars,
  withTools: !noTools,
  seededTurns: seeded.length,
  plannedTurns: planned.length,
  completedTurns: results.filter((entry) => entry.status === 'ok').length,
  failedTurns: results.filter((entry) => entry.status === 'failed').length,
  skippedTurns: results.filter((entry) => entry.status === 'skipped-budget').length,
  liveModelCalls: calls,
  model: 'deepseek-flash (provider deepseek-official, api-key route)',
  generatedAt: new Date().toISOString(),
};
writeFileSync(join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
