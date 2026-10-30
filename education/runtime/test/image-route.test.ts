/**
 * F7 regression: the product image route must *grade*, not only gate.
 *
 * These tests use the committed synthetic fixtures plus a fake vision client, so
 * they prove the wiring (quality short-circuit → zero model calls; gate pass →
 * real `evaluateImageAnswer` → GradeResult + gated evidence) without any real
 * model call or key.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { VisionClient, VisionCallResult, VisionRequest } from '@edu/visuals';
import type { ServiceResult } from '@edu/domain';
import { composeEducationRuntime, G1Service, type EducationRuntimeComposition } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const imagesRoot = path.join(educationRoot, 'packages', 'visuals', 'test', 'fixtures', 'images');

const ACTIVITY = 'activity.bio7a.u1ch2s4.cell-nucleus.basic';
const NUCLEUS_CONCEPT = 'concept.bio7a.u1ch2s4.cell-nucleus';

const roots: string[] = [];

function dataRoot(): string {
  const root = path.join(os.tmpdir(), `edu-f7-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(name: string): { base64: string; width: number; height: number } {
  const bytes = readFileSync(path.join(imagesRoot, name));
  return {
    base64: bytes.toString('base64'),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

class FakeVision implements VisionClient {
  calls = 0;
  readonly requests: VisionRequest[] = [];
  constructor(private readonly text: string) {}
  readonly capabilities = { provider: 'fake', model: 'fake-vision', text: true, image: true };
  async call(request: VisionRequest): Promise<{ ok: true; value: VisionCallResult }> {
    this.calls += 1;
    this.requests.push(request);
    return {
      ok: true,
      value: {
        text: this.text,
        model: 'fake-vision',
        modelRunId: `fake.run.${String(this.calls)}`,
        latencyMs: 1,
        usage: { inputTokens: 10, outputTokens: 20 },
      },
    };
  }
}

function modelJson(matches: boolean | null, text: string, uncertainty = 0.1): string {
  return JSON.stringify({
    readable: text.length > 0,
    recognizedText: text,
    matchesExpected: matches,
    reason: matches === true ? '与参考答案一致' : matches === false ? '与参考答案不一致' : '无法判断',
    uncertainty,
    regions: text.length > 0 ? [{ text, x: 10, y: 10, width: 40, height: 20, confidence: 0.9 }] : [],
  });
}

async function open(imageAvailable: boolean, client: VisionClient | null) {
  const result = await composeEducationRuntime({
    workspaceRoot: educationRoot,
    dataRoot: dataRoot(),
    env: {} as NodeJS.ProcessEnv,
  });
  if (!result.ok) throw new Error(`composition failed: ${JSON.stringify(result.error)}`);
  const g1 = new G1Service(result.data, educationRoot, {
    visionClient: () => client,
    imageAvailable: () => imageAvailable,
  });
  return { composition: result.data, g1 };
}

function dataOf(result: ServiceResult<Record<string, unknown>>): Record<string, unknown> {
  if (!result.ok) throw new Error(`route failed: ${JSON.stringify(result.error)}`);
  return result.data;
}

async function journalTypes(composition: EducationRuntimeComposition): Promise<string[]> {
  const slice = await composition.storage.readFrom(
    { requestId: 'test.journal.read', learnerId: 'learner.local.default', now: '2026-10-30T00:00:00Z' },
    0,
    1000,
  );
  if (!slice.ok) throw new Error(`journal read failed: ${JSON.stringify(slice.error)}`);
  return slice.data.commits.map((commit) => commit.type);
}

describe('F7 product image route grades through @edu/visuals', () => {
  it('a clear correct image is graded and yields a gated evidence candidate', async () => {
    const client = new FakeVision(modelJson(true, '细胞核'));
    const { composition, g1 } = await open(true, client);
    try {
      const image = fixture('01-clear-correct.png');
      const data = dataOf(
        await g1.imageQuality('test.f7.grade', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      expect(client.calls).toBe(1);
      expect(data['stage']).toBe('graded');
      expect(data['modelCalled']).toBe(true);
      expect(data['expectedAnswer']).toBe('细胞核');
      const grade = data['grade'] as { criteria: { met: string }[]; graderVersion: string } | null;
      expect(grade).not.toBeNull();
      expect(grade?.criteria.every((criterion) => criterion.met === 'yes')).toBe(true);
      expect(String(grade?.graderVersion)).toContain('vision-image-eval-v1');
      const gate = data['gate'] as { refused: boolean; accepted: unknown[] } | null;
      expect(gate).not.toBeNull();
      expect(gate?.refused).toBe(false);
      expect(gate?.accepted.length).toBe(1);
      expect((data['evidenceCandidates'] as unknown[]).length).toBe(1);
    } finally {
      composition.close();
    }
  });

  it('a clear wrong image is graded as not matching', async () => {
    const client = new FakeVision(modelJson(false, '细胞膜'));
    const { composition, g1 } = await open(true, client);
    try {
      const image = fixture('02-clear-wrong.png');
      const data = dataOf(
        await g1.imageQuality('test.f7.wrong', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      expect(data['stage']).toBe('graded');
      expect((data['recognition'] as { matchesExpected: boolean | null }).matchesExpected).toBe(false);
      const grade = data['grade'] as { criteria: { met: string }[] } | null;
      expect(grade?.criteria.every((criterion) => criterion.met === 'no')).toBe(true);
    } finally {
      composition.close();
    }
  });

  it('the blurry/rotated fixture short-circuits before any model call', async () => {
    const client = new FakeVision(modelJson(true, '细胞核'));
    const { composition, g1 } = await open(true, client);
    try {
      const image = fixture('03-rotated-blurred.png');
      const data = dataOf(
        await g1.imageQuality('test.f7.gate', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      expect(client.calls).toBe(0);
      expect(data['stage']).toBe('clarification_required');
      expect(data['modelCalled']).toBe(false);
      expect(data['requiresClarification']).toBe(true);
      expect((data['evidenceCandidates'] as unknown[]).length).toBe(0);
    } finally {
      composition.close();
    }
  });

  it('a blank image asks for clarification instead of a verdict', async () => {
    const client = new FakeVision(modelJson(null, ''));
    const { composition, g1 } = await open(true, client);
    try {
      const image = fixture('04-blank.png');
      const data = dataOf(
        await g1.imageQuality('test.f7.blank', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      expect(client.calls).toBe(1);
      expect(data['stage']).toBe('clarification_required');
      expect(data['grade']).toBeNull();
      expect(data['requiresClarification']).toBe(true);
    } finally {
      composition.close();
    }
  });

  it('without a key the route degrades to the text path with zero model calls', async () => {
    const { composition, g1 } = await open(false, null);
    try {
      const image = fixture('01-clear-correct.png');
      const data = dataOf(
        await g1.imageQuality('test.f7.nokey', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      expect(data['stage']).toBe('degraded_text');
      expect(data['modelCalled']).toBe(false);
      expect(data['requiresClarification']).toBe(true);
    } finally {
      composition.close();
    }
  });

  it('study exposes imageFlow only when a vision route is available', async () => {
    const withRoute = await open(true, new FakeVision(modelJson(true, '细胞核')));
    try {
      const study = dataOf(await withRoute.g1.study(NUCLEUS_CONCEPT));
      expect(study['imageFlow']).not.toBeNull();
    } finally {
      withRoute.composition.close();
    }
    const withoutRoute = await open(false, null);
    try {
      const study = dataOf(await withoutRoute.g1.study(NUCLEUS_CONCEPT));
      expect(study['imageFlow']).toBeNull();
    } finally {
      withoutRoute.composition.close();
    }
  });

  it('persists a graded image answer through attempt.submitted + assessment.committed', async () => {
    const client = new FakeVision(modelJson(true, '细胞核'));
    const { composition, g1 } = await open(true, client);
    try {
      const image = fixture('01-clear-correct.png');
      const data = dataOf(
        await g1.imageQuality('test.f8.persist', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      const outcome = data['attemptOutcome'] as {
        attemptId: string;
        persisted: boolean;
        duplicate: boolean;
        grade: unknown;
        feedbackPending: boolean;
      };
      expect(outcome).not.toBeNull();
      expect(outcome.persisted).toBe(true);
      expect(outcome.duplicate).toBe(false);
      expect(outcome.grade).not.toBeNull();
      expect(outcome.feedbackPending).toBe(false);
      const persistence = data['persistence'] as { assessmentCommitted: boolean; sessionId: string };
      expect(persistence.assessmentCommitted).toBe(true);
      expect(typeof persistence.sessionId).toBe('string');
      const types = await journalTypes(composition);
      expect(types.filter((type) => type === 'attempt.submitted')).toHaveLength(1);
      expect(types.filter((type) => type === 'assessment.committed')).toHaveLength(1);
    } finally {
      composition.close();
    }
  });

  it('does not record the same image twice (idempotency key)', async () => {
    const client = new FakeVision(modelJson(true, '细胞核'));
    const { composition, g1 } = await open(true, client);
    try {
      const image = fixture('01-clear-correct.png');
      const first = dataOf(
        await g1.imageQuality('test.f8.duplicate.1', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      const firstOutcome = first['attemptOutcome'] as { attemptId: string };
      const firstPersistence = first['persistence'] as { sessionId: string };
      const second = dataOf(
        await g1.imageQuality('test.f8.duplicate.2', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
          sessionId: firstPersistence.sessionId,
        }),
      );
      const secondOutcome = second['attemptOutcome'] as {
        attemptId: string;
        duplicate: boolean;
        grade: unknown;
      };
      expect(client.calls).toBe(1);
      expect(secondOutcome.attemptId).toBe(firstOutcome.attemptId);
      expect(secondOutcome.duplicate).toBe(true);
      expect(secondOutcome.grade).not.toBeNull();
      const types = await journalTypes(composition);
      expect(types.filter((type) => type === 'attempt.submitted')).toHaveLength(1);
      expect(types.filter((type) => type === 'assessment.committed')).toHaveLength(1);
    } finally {
      composition.close();
    }
  });

  it('keeps a quality-gate clarification as a pending attempt without a grade', async () => {
    const client = new FakeVision(modelJson(true, '细胞核'));
    const { composition, g1 } = await open(true, client);
    try {
      const image = fixture('03-rotated-blurred.png');
      const data = dataOf(
        await g1.imageQuality('test.f8.pending', {
          base64: image.base64,
          mime: 'image/png',
          width: image.width,
          height: image.height,
          activityId: ACTIVITY,
        }),
      );
      expect(data['stage']).toBe('clarification_required');
      const outcome = data['attemptOutcome'] as {
        attemptId: string;
        persisted: boolean;
        grade: { requiresClarification: boolean };
        feedbackPending: boolean;
      };
      expect(outcome).not.toBeNull();
      expect(outcome.persisted).toBe(true);
      expect(outcome.grade.requiresClarification).toBe(true);
      expect(outcome.feedbackPending).toBe(true);
      const persistence = data['persistence'] as { assessmentCommitted: boolean };
      expect(persistence.assessmentCommitted).toBe(false);
      expect(client.calls).toBe(0);
      const types = await journalTypes(composition);
      expect(types.filter((type) => type === 'attempt.submitted')).toHaveLength(1);
      expect(types.filter((type) => type === 'assessment.committed')).toHaveLength(0);
    } finally {
      composition.close();
    }
  });
});
