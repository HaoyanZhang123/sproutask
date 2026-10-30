/**
 * T15 supplementary-budget verification — A20 real image samples.
 *
 * Phase 1 (--probe-only, 0 model calls): measure the independent quality signal
 * (packages/visuals analyzeImageQuality) on the four committed fixtures, so the
 * expected short-circuit behaviour is known *before* spending any call.
 *
 * Phase 2 (default): run the real image pipeline (evaluateImageAnswer) on the
 * same four fixtures with the real `deepseek-flash` vision route. The pipeline
 * runs the quality gate first, so a blurry/tilted/blank sample must come back
 * with `modelCalled=false` — the run reports, per sample, whether the model was
 * actually called and how long it took.
 *
 * The API key is read from a local file into process memory only; it is never
 * printed and never written to evidence. The run self-scans its own evidence.
 *
 * Usage:
 *   node --import ./education/packages/visuals/bin/ts-js-resolve.mjs \
 *     education/tests/education/b20-image.mjs --out <dir> [--probe-only] [--max-calls 4]
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const { analyzeImageQuality, IMAGE_QUALITY_THRESHOLD_VERSION } = await import(
  '../../packages/visuals/src/image/quality-probe.js'
);
const { evaluateImageAnswer } = await import('../../packages/visuals/src/image/pipeline.js');
const { createDeepSeekVisionClient } = await import('../../packages/visuals/src/image/deepseek-vision.js');
const { IDENTITY_TRANSFORM } = await import('../../packages/visuals/src/image/types.js');

const FIXTURES = [
  { name: '01-clear-correct', file: '01-clear-correct.png', expectation: 'graded_matches_true' },
  { name: '02-clear-wrong', file: '02-clear-wrong.png', expectation: 'graded_matches_false' },
  { name: '03-rotated-blurred', file: '03-rotated-blurred.png', expectation: 'gate_short_circuit' },
  { name: '04-blank', file: '04-blank.png', expectation: 'clarification' },
];

function pngSize(bytes) {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function activityFor() {
  const rubric = {
    schemaVersion: 1,
    id: 'rubric.vision-budget',
    version: '1',
    courseEditionId: 'course.biology-7a',
    conceptIds: ['concept.cell'],
    criteria: [
      {
        criterionId: 'criterion.vision.identify-nucleus',
        description: '能把图中箭头指向的结构正确识别为细胞核',
        acceptableEvidence: ['回答为细胞核'],
        commonMisconceptions: ['回答为细胞膜'],
        counterExamples: [],
        transferItems: [],
        feedbackSourceRefs: ['source.p26'],
      },
    ],
    reviewState: 'machine_checked',
  };
  const activity = {
    schemaVersion: 1,
    id: 'activity.vision-budget',
    version: '1',
    courseEditionId: 'course.biology-7a',
    conceptIds: ['concept.cell'],
    type: 'image_review',
    stem: '图中箭头指向的细胞结构叫什么？',
    sourceRefs: ['source.p26'],
    renderSpec: null,
    answerSchema: { kind: 'text', maxLength: 200 },
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    answerDisclosurePolicy: 'after_independent_attempt',
  };
  return { activity, rubric };
}

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      'probe-only': { type: 'boolean', default: false },
      'key-file': { type: 'string', default: path.join(REPO, '.local', 'secrets', 'deepseek.key') },
      'max-calls': { type: 'string', default: '4' },
      model: { type: 'string', default: 'deepseek-flash' },
    },
    allowPositionals: false,
  });
  const runDir = path.resolve(String(values.out));
  await mkdir(path.join(runDir, 'a20-raw'), { recursive: true });
  const imageDir = path.join(REPO, 'packages', 'visuals', 'test', 'fixtures', 'images');
  const log = [];
  const say = (line) => {
    log.push(`${new Date().toISOString()} ${line}`);
    console.log(line);
  };

  const samples = [];
  for (const spec of FIXTURES) {
    const file = path.join(imageDir, spec.file);
    const bytes = new Uint8Array(await readFile(file));
    const size = pngSize(bytes);
    const base64 = Buffer.from(bytes).toString('base64');
    const qualitySignal = analyzeImageQuality({ base64, mime: 'image/png', width: size.width, height: size.height });
    samples.push({
      ...spec,
      file,
      bytes,
      size,
      base64,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      qualitySignal,
    });
    say(
      `probe ${spec.name} ${size.width}x${size.height} status=${qualitySignal.status} ` +
        `forced=${qualitySignal.forcedClarification} lapVar=${qualitySignal.metrics?.laplacianVariance} ` +
        `skew=${qualitySignal.metrics?.skewDegrees} peak=${qualitySignal.metrics?.orientationPeakShare} ` +
        `intVar=${qualitySignal.metrics?.intensityVariance} edge=${qualitySignal.metrics?.edgeDensity}`,
    );
  }

  const probe = {
    schemaVersion: 1,
    kind: 't15-budget-a20-quality-probe',
    generatedAt: new Date().toISOString(),
    modelCalls: 0,
    thresholdVersion: IMAGE_QUALITY_THRESHOLD_VERSION,
    fixturesDir: imageDir,
    samples: samples.map((sample) => ({
      name: sample.name,
      file: sample.file,
      sha256: sample.sha256,
      width: sample.size.width,
      height: sample.size.height,
      status: sample.qualitySignal.status,
      forcedClarification: sample.qualitySignal.forcedClarification,
      reasons: sample.qualitySignal.reasons,
      metrics: sample.qualitySignal.metrics,
      thresholds: sample.qualitySignal.thresholds,
      expectation: sample.expectation,
    })),
  };
  await writeFile(path.join(runDir, 'a20-probe.json'), `${JSON.stringify(probe, null, 2)}\n`, 'utf8');

  if (values['probe-only'] === true) {
    await writeFile(path.join(runDir, 'a20-image.log'), `${log.join('\n')}\n`, 'utf8');
    console.log(JSON.stringify({ probeOnly: true, modelCalls: 0 }));
    return;
  }

  const keyPath = path.resolve(String(values['key-file']));
  if (!existsSync(keyPath)) {
    say('key file not found; model phase skipped');
    await writeFile(path.join(runDir, 'a20-image.log'), `${log.join('\n')}\n`, 'utf8');
    process.exit(2);
  }
  const apiKey = (await readFile(keyPath, 'utf8')).trim();
  if (apiKey.length === 0) {
    say('key file empty');
    process.exit(2);
  }
  say(`key loaded (length=${apiKey.length}, value never printed)`);

  const { activity, rubric } = activityFor();
  const client = createDeepSeekVisionClient({
    apiKey,
    model: String(values.model),
    endpoint: 'https://api.deepseek.com',
    maxTokens: 2500,
    timeoutMs: 120000,
  });
  const maxCalls = Number.parseInt(String(values['max-calls']), 10);
  say(`model=${client.capabilities.model} maxCalls=${maxCalls}`);

  const results = [];
  let calls = 0;
  for (const sample of samples) {
    if (calls >= maxCalls) {
      say(`call cap reached before ${sample.name}`);
      break;
    }
    const started = Date.now();
    const evaluation = await evaluateImageAnswer({
      asset: {
        assetId: `asset.t15budget.${sample.name}`,
        sha256: sample.sha256,
        mime: 'image/png',
        width: sample.size.width,
        height: sample.size.height,
        byteSize: sample.bytes.length,
      },
      transform: IDENTITY_TRANSFORM,
      requestImage: {
        base64: sample.base64,
        mime: 'image/png',
        width: sample.size.width,
        height: sample.size.height,
      },
      activity,
      rubric,
      attempt: {
        id: `attempt.t15budget.${sample.name}`,
        activityId: activity.id,
        activityVersion: activity.version,
        answerText: null,
        answerAssetId: `asset.t15budget.${sample.name}`,
        inputType: 'image',
        helpUsed: [],
      },
      expectedAnswer: '细胞核',
      client,
      resolveSourceRef: (ref) => ref === 'source.p26',
    });
    const elapsedMs = Date.now() - started;
    if (!evaluation.ok) {
      say(`sample=${sample.name} error=${evaluation.error.code} elapsedMs=${elapsedMs}`);
      results.push({
        name: sample.name,
        expectation: sample.expectation,
        qualityStatus: sample.qualitySignal.status,
        forcedClarification: sample.qualitySignal.forcedClarification,
        stage: null,
        errorCode: evaluation.error.code,
        modelCalled: calls > 0,
        gateShortCircuited: false,
        elapsedMs,
        modelLatencyMs: null,
        matchesExpected: null,
        uncertainty: null,
        requiresClarification: false,
        clarificationReasons: [],
        criteriaMet: [],
        recognizedText: null,
        usage: null,
        estimateCny: null,
      });
      continue;
    }
    const value = evaluation.value;
    const modelCalled = value.modelRunId !== null;
    if (modelCalled) calls += 1;
    const inputTokens = value.usage?.inputTokens ?? null;
    const outputTokens = value.usage?.outputTokens ?? null;
    const estimateCny =
      inputTokens === null || outputTokens === null
        ? null
        : Number((((inputTokens * 2) + (outputTokens * 8)) / 1_000_000).toFixed(6));
    const record = {
      name: sample.name,
      expectation: sample.expectation,
      qualityStatus: sample.qualitySignal.status,
      qualityReasons: sample.qualitySignal.reasons,
      forcedClarification: value.qualitySignal?.forcedClarification ?? null,
      stage: value.stage,
      modelCalled,
      gateShortCircuited: !modelCalled && value.qualitySignal?.forcedClarification === true,
      elapsedMs,
      modelLatencyMs: value.latencyMs,
      matchesExpected: value.recognition?.matchesExpected ?? null,
      uncertainty: value.recognition?.uncertainty ?? null,
      requiresClarification: value.clarification !== null,
      clarificationReasons: value.clarification?.reasons ?? [],
      criteriaMet: value.grade?.criteria.map((criterion) => criterion.met) ?? [],
      recognizedText: value.recognition?.text ?? null,
      usage: value.usage,
      estimateCny,
    };
    results.push(record);
    await writeFile(
      path.join(runDir, 'a20-raw', `${sample.name}.json`),
      `${JSON.stringify(value, null, 2)}\n`,
      'utf8',
    );
    say(
      `sample=${sample.name} stage=${record.stage} modelCalled=${modelCalled} elapsedMs=${elapsedMs} ` +
        `matches=${String(record.matchesExpected)} clarify=${record.requiresClarification} ` +
        `tokens=${inputTokens ?? '-'}/${outputTokens ?? '-'}`,
    );
  }

  const totalEstimateCny = Number(
    results.reduce((sum, entry) => sum + (entry.estimateCny ?? 0), 0).toFixed(6),
  );
  const summary = {
    schemaVersion: 1,
    kind: 't15-budget-a20-image',
    generatedAt: new Date().toISOString(),
    callCount: calls,
    maxCalls,
    model: client.capabilities.model,
    endpoint: 'https://api.deepseek.com',
    protocol: 'product image pipeline (evaluateImageAnswer) + independent quality gate',
    samplesAreSynthetic: true,
    fixturesDir: imageDir,
    thresholdVersion: IMAGE_QUALITY_THRESHOLD_VERSION,
    results,
    totalEstimateCny,
    notes: [
      'Fixtures are the committed program-synthesized samples in packages/visuals/test/fixtures/images; not real student handwriting.',
      'modelCalled is derived from modelRunId (null means the quality gate short-circuited before any model request).',
    ],
  };
  await writeFile(path.join(runDir, 'a20-image.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(path.join(runDir, 'a20-image.log'), `${log.join('\n')}\n`, 'utf8');

  let leaks = 0;
  for (const entry of await readdir(runDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const content = await readFile(path.join(runDir, entry.name), 'utf8').catch(() => '');
    if (content.includes(apiKey)) leaks += 1;
  }
  await writeFile(
    path.join(runDir, 'a20-secret-scan.json'),
    `${JSON.stringify({ scanned: 'top-level files of this run dir', leaks, note: 'key value is never stored' }, null, 2)}\n`,
    'utf8',
  );
  say(`calls=${calls} leaks=${leaks} estimateCny=${totalEstimateCny}`);
  if (leaks > 0) process.exit(3);
}

await main();
