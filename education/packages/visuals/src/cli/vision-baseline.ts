/**
 * T11 real-image-model evidence CLI.
 *
 * Purpose: run the *package* image pipeline (not a one-off script) against the
 * real DeepSeek image route with four fixed, program-synthesized samples:
 *   1. clear + correct answer
 *   2. clear + clearly wrong answer
 *   3. rotated + blurred answer
 *   4. blank (no answer)
 *
 * The images are generated locally with System.Drawing (Windows component, no
 * extra dependency) and are NOT real student handwriting. The API key is read
 * from a local file and only lives in this process memory; it is never printed,
 * logged or written to evidence (the run also scans its own evidence for it).
 *
 * Usage:
 *   node --import ./bin/ts-js-resolve.mjs src/cli/vision-baseline.ts \
 *     --key-file ../../.local/secrets/deepseek.key --out ../../.local/evidence/T11/run-1
 *
 *   add --dry-run to only generate the images (no model call).
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import type { Activity, Rubric } from '@edu/domain';

import { createDeepSeekVisionClient } from '../image/deepseek-vision.js';
import { evaluateImageAnswer, type ImageEvaluation } from '../image/pipeline.js';
import { IDENTITY_TRANSFORM, type ImageAssetHandle } from '../image/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_SCRIPT = path.join(HERE, 'images', 'make-images.ps1');
const CALL_CAP = 20;

interface ImageSpec {
  readonly name: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly rotate: number;
  readonly blur: number;
  readonly note: string;
  readonly items: readonly Record<string, unknown>[];
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i += 1) if (bytes[i] !== signature[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function imageSpecs(dir: string): ImageSpec[] {
  const question = '题目：图中箭头指向的细胞结构叫什么？';
  const cell = { kind: 'ellipse', x: 200, y: 110, width: 500, height: 340, stroke: '#333333', thickness: 4, fill: '#ffffff' };
  const nucleus = { kind: 'ellipse', x: 370, y: 220, width: 160, height: 120, stroke: '#333333', thickness: 4, fill: '#f2f6fb' };
  const arrow = { kind: 'line', x1: 760, y1: 430, x2: 500, y2: 290, stroke: '#444444', thickness: 3 };
  const questionItem = { kind: 'text', text: question, x: 40, y: 30, size: 34, font: 'Microsoft YaHei', color: '#111111' };
  const answerCorrect = { kind: 'text', text: '答：细胞核', x: 260, y: 500, size: 46, font: 'KaiTi', color: '#1a3d7c' };
  const answerWrong = { kind: 'text', text: '答：细胞膜', x: 260, y: 500, size: 46, font: 'KaiTi', color: '#1a3d7c' };
  const base = { width: 900, height: 600, rotate: 0, blur: 0 };
  return [
    {
      ...base,
      name: '01-clear-correct',
      path: path.join(dir, '01-clear-correct.png'),
      note: 'synthetic clear page, printed question + handwritten-style correct answer (no rotation/blur)',
      items: [questionItem, cell, nucleus, arrow, answerCorrect],
    },
    {
      ...base,
      name: '02-clear-wrong',
      path: path.join(dir, '02-clear-wrong.png'),
      note: 'synthetic clear page with a clearly wrong handwritten-style answer',
      items: [questionItem, cell, nucleus, arrow, answerWrong],
    },
    {
      ...base,
      name: '03-rotated-blurred',
      path: path.join(dir, '03-rotated-blurred.png'),
      rotate: 14,
      blur: 6,
      note: 'synthetic rotated (14 deg) and blurred (6x downscale) page with a correct answer',
      items: [questionItem, cell, nucleus, arrow, answerCorrect],
    },
    {
      ...base,
      name: '04-blank',
      path: path.join(dir, '04-blank.png'),
      note: 'synthetic page with the printed question only; no student answer',
      items: [questionItem, cell, nucleus, arrow],
    },
  ];
}

function runPowerShell(script: string, specPath: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      process.env['SystemRoot'] !== undefined
        ? path.join(process.env['SystemRoot'], 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
        : 'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-SpecPath', specPath],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (error) => resolve({ code: null, stdout, stderr: `${stderr}\n${error.message}` }));
  });
}

function activityFor(): { activity: Activity; rubric: Rubric } {
  const rubric: Rubric = {
    schemaVersion: 1,
    id: 'rubric.vision-baseline',
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
  const activity: Activity = {
    schemaVersion: 1,
    id: 'activity.vision-baseline',
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

function isoNow(): string {
  return new Date().toISOString();
}

interface SampleResult {
  readonly name: string;
  readonly note: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageSha256: string;
  readonly transform: typeof IDENTITY_TRANSFORM;
  readonly stage: string | null;
  readonly errorCode: string | null;
  readonly model: string | null;
  readonly modelRunId: string | null;
  readonly latencyMs: number;
  readonly usage: { readonly inputTokens: number | null; readonly outputTokens: number | null } | null;
  readonly recognizedText: string | null;
  readonly matchesExpected: boolean | null;
  readonly uncertainty: number | null;
  readonly criteriaMet: readonly string[];
  readonly requiresClarification: boolean;
  readonly clarificationReasons: readonly string[];
  readonly injectionSuspected: boolean;
  readonly evidenceAccepted: number;
  readonly estimateCny: number | null;
}

function summarize(name: string, note: string, asset: ImageAssetHandle, evaluation: ImageEvaluation): SampleResult {
  const inputTokens = evaluation.usage?.inputTokens ?? null;
  const outputTokens = evaluation.usage?.outputTokens ?? null;
  const estimateCny =
    inputTokens === null || outputTokens === null
      ? null
      : Number((((inputTokens * 2) + (outputTokens * 8)) / 1_000_000).toFixed(6));
  return {
    name,
    note,
    imageWidth: asset.width,
    imageHeight: asset.height,
    imageSha256: asset.sha256,
    transform: IDENTITY_TRANSFORM,
    stage: evaluation.stage,
    errorCode: null,
    model: evaluation.model,
    modelRunId: evaluation.modelRunId,
    latencyMs: evaluation.latencyMs,
    usage: evaluation.usage,
    recognizedText: evaluation.recognition?.text ?? null,
    matchesExpected: evaluation.recognition?.matchesExpected ?? null,
    uncertainty: evaluation.recognition?.uncertainty ?? null,
    criteriaMet: evaluation.grade?.criteria.map((criterion) => criterion.met) ?? [],
    requiresClarification: evaluation.clarification !== null,
    clarificationReasons: evaluation.clarification?.reasons ?? [],
    injectionSuspected: evaluation.injection?.suspected ?? false,
    evidenceAccepted: evaluation.gate?.accepted.length ?? 0,
    estimateCny,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      'key-file': { type: 'string', default: path.join('education', '.local', 'secrets', 'deepseek.key') },
      model: { type: 'string', default: 'deepseek-flash' },
      endpoint: { type: 'string', default: 'https://api.deepseek.com' },
      'max-calls': { type: 'string', default: String(CALL_CAP) },
      'dry-run': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '');
  const runDir = path.resolve(values.out ?? path.join('education', '.local', 'evidence', 'T11', `run-${stamp}`));
  const imageDir = path.join(runDir, 'images');
  await mkdir(imageDir, { recursive: true });
  const logLines: string[] = [];
  const log = (line: string): void => {
    const entry = `${isoNow()} ${line}`;
    logLines.push(entry);
    console.log(entry);
  };

  const specs = imageSpecs(imageDir);
  const specPath = path.join(runDir, 'images-spec.json');
  await writeFile(specPath, JSON.stringify({ images: specs }, null, 2), 'utf8');
  const generated = await runPowerShell(IMAGE_SCRIPT, specPath);
  log(`generate-images exit=${generated.code ?? 'null'} lines=${generated.stdout.trim().split(/\r?\n/).length}`);
  if (generated.code !== 0) {
    log(`generate-images stderr=${generated.stderr.trim().slice(0, 400)}`);
    await writeFile(path.join(runDir, 'vision-baseline.log'), `${logLines.join('\n')}\n`, 'utf8');
    process.exit(1);
  }

  const missing = specs.filter((spec) => !existsSync(spec.path));
  if (missing.length > 0) {
    log(`missing images: ${missing.map((spec) => spec.name).join(', ')}`);
    process.exit(1);
  }

  if (values['dry-run'] === true) {
    log('dry-run: images generated, no model call');
    await writeFile(path.join(runDir, 'vision-baseline.log'), `${logLines.join('\n')}\n`, 'utf8');
    return;
  }

  const keyPath = path.resolve(String(values['key-file']));
  if (!existsSync(keyPath)) {
    log(`key file not found (image calls not attempted)`);
    await writeFile(path.join(runDir, 'vision-baseline.log'), `${logLines.join('\n')}\n`, 'utf8');
    process.exit(2);
  }
  const apiKey = (await readFile(keyPath, 'utf8')).trim();
  if (apiKey.length === 0) {
    log('key file is empty');
    process.exit(2);
  }
  log(`key loaded (length=${apiKey.length}, value never printed)`);

  const { activity, rubric } = activityFor();
  const client = createDeepSeekVisionClient({
    apiKey,
    model: String(values.model),
    endpoint: String(values.endpoint),
    maxTokens: 2500,
    timeoutMs: 120_000,
  });
  const maxCalls = Math.min(CALL_CAP, Number.parseInt(String(values['max-calls']), 10));
  log(`model=${client.capabilities.model} endpoint=${String(values.endpoint)} maxCalls=${maxCalls}`);

  const results: SampleResult[] = [];
  let calls = 0;
  for (const spec of specs) {
    if (calls >= maxCalls) {
      log(`call cap reached at ${spec.name}`);
      break;
    }
    const bytes = new Uint8Array(await readFile(spec.path));
    const size = pngSize(bytes);
    if (size === null) {
      log(`skip ${spec.name}: not a PNG`);
      continue;
    }
    const asset: ImageAssetHandle = {
      assetId: `asset.t11.${spec.name}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      mime: 'image/png',
      width: size.width,
      height: size.height,
      byteSize: bytes.length,
    };
    calls += 1;
    const started = Date.now();
    const evaluation = await evaluateImageAnswer({
      asset,
      transform: IDENTITY_TRANSFORM,
      requestImage: {
        base64: Buffer.from(bytes).toString('base64'),
        mime: 'image/png',
        width: size.width,
        height: size.height,
      },
      activity,
      rubric,
      attempt: {
        id: `attempt.vision.${spec.name}`,
        activityId: activity.id,
        activityVersion: activity.version,
        answerText: null,
        answerAssetId: asset.assetId,
        inputType: 'image',
        helpUsed: [],
      },
      expectedAnswer: '细胞核',
      client,
      resolveSourceRef: (ref) => ref === 'source.p26',
    });
    if (!evaluation.ok) {
      log(`sample=${spec.name} call=${calls} error=${evaluation.error.code} elapsedMs=${Date.now() - started}`);
      results.push({
        name: spec.name,
        note: spec.note,
        imageWidth: asset.width,
        imageHeight: asset.height,
        imageSha256: asset.sha256,
        transform: IDENTITY_TRANSFORM,
        stage: null,
        errorCode: evaluation.error.code,
        model: client.capabilities.model,
        modelRunId: null,
        latencyMs: Date.now() - started,
        usage: null,
        recognizedText: null,
        matchesExpected: null,
        uncertainty: null,
        criteriaMet: [],
        requiresClarification: false,
        clarificationReasons: [],
        injectionSuspected: false,
        evidenceAccepted: 0,
        estimateCny: null,
      });
      continue;
    }
    const summary = summarize(spec.name, spec.note, asset, evaluation.value);
    results.push(summary);
    log(
      `sample=${spec.name} call=${calls} stage=${summary.stage} modelRun=${summary.modelRunId ?? '-'} ` +
        `elapsedMs=${summary.latencyMs} chars=${summary.recognizedText?.length ?? 0} ` +
        `matches=${String(summary.matchesExpected)} clarity=${summary.requiresClarification} ` +
        `tokens=${summary.usage?.inputTokens ?? '-'}/${summary.usage?.outputTokens ?? '-'}`,
    );
  }

  const summary = {
    schemaVersion: 1,
    task: 'T11',
    generatedAt: isoNow(),
    callCount: calls,
    callCap: CALL_CAP,
    model: client.capabilities.model,
    endpoint: String(values.endpoint),
    promptVersion: 'image-eval-v1',
    samplesAreSynthetic: true,
    notes: [
      'Images are program-synthesized with System.Drawing; they are NOT real student handwriting.',
      'Rotation/blur are baked into the pixels, so the recorded transform provenance is identity.',
      'The API key is never written to evidence; the run scans its own evidence for the key.',
    ],
    results,
    totalEstimateCny: Number(
      results.reduce((sum, entry) => sum + (entry.estimateCny ?? 0), 0).toFixed(6),
    ),
  };
  await writeFile(path.join(runDir, 'vision-baseline.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(path.join(runDir, 'vision-baseline.log'), `${logLines.join('\n')}\n`, 'utf8');

  // Self-scan: the key must not appear in any evidence file of this run.
  let leaks = 0;
  for (const entry of await readdir(runDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const content = await readFile(path.join(runDir, entry.name), 'utf8').catch(() => '');
    if (content.includes(apiKey)) leaks += 1;
  }
  await writeFile(
    path.join(runDir, 'secret-scan.json'),
    `${JSON.stringify({ scannedFiles: 'top-level evidence files', leaks, note: 'key value is not stored in this file' }, null, 2)}\n`,
    'utf8',
  );
  log(`calls=${calls} leaks=${leaks} estimateCny=${summary.totalEstimateCny}`);
  if (leaks > 0) process.exit(3);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
