import { describe, expect, it } from 'vitest';
import type { ConceptMapping } from '@edu/domain';
import {
  CONCEPT_CELL,
  CONCEPT_ENERGY,
  CONCEPT_ORGAN,
  CONCEPT_TISSUE,
  COURSE_EDITION_ID,
  LEARNER_ID,
  LearnerHarness,
  PACK_VERSION,
  PACK_VERSION_V2,
  conceptMapping,
  expectError,
  expectOk,
  makeAttempt,
  makeCompatibilityMap,
  makeEvidence,
  makeSession,
  requestContext,
} from './helpers.js';

let flow = 0;

function nextRequest(prefix: string): string {
  flow += 1;
  return `${prefix}-${flow}`;
}

function key(conceptId: string, packVersion = PACK_VERSION) {
  return {
    learnerId: LEARNER_ID,
    courseEditionId: COURSE_EDITION_ID,
    packVersion,
    conceptId,
  };
}

async function startLearn(
  harness: LearnerHarness,
  conceptId: string,
  startedAt = '2026-10-29T01:00:00Z',
) {
  const session = makeSession({ conceptId, startedAt });
  expectOk(
    await harness.learner.startSession(
      requestContext(harness, nextRequest('session'), startedAt),
      session,
    ),
  );
  return session;
}

async function addEvidence(
  harness: LearnerHarness,
  sessionId: string,
  conceptId: string,
  kind: 'explain' | 'transfer',
): Promise<void> {
  const attempt = makeAttempt({
    sessionId,
    conceptIds: [conceptId],
    submittedAt: harness.clock.now(),
  });
  expectOk(
    await harness.learner.submitAttempt(requestContext(harness, nextRequest('attempt')), attempt),
  );
  const evidence = makeEvidence({ attemptId: attempt.id, conceptId, kind, createdAt: harness.clock.now() });
  expectOk(
    await harness.learner.recordGradedAttempt(requestContext(harness, nextRequest('grade')), {
      attemptId: attempt.id,
      evidence: [evidence],
      rubricVersion: 'rubric-bio-7a-v1',
      evaluatorVersion: 'grader-rule-v1',
    }),
  );
}

async function supportedAndCompletedConcept(
  harness: LearnerHarness,
  conceptId: string,
  completedAt = '2026-10-29T02:00:00Z',
): Promise<void> {
  const session = await startLearn(harness, conceptId);
  await addEvidence(harness, session.id, conceptId, 'explain');
  await addEvidence(harness, session.id, conceptId, 'transfer');
  const progress = expectOk(
    await harness.learner.get(requestContext(harness, nextRequest('progress')), key(conceptId)),
  );
  expect(progress.understanding.state).toBe('supported');
  expectOk(
    await harness.learner.completeLearning(requestContext(harness, nextRequest('complete')), {
      sessionId: session.id,
      conceptId,
      completedAt,
    }),
  );
}

async function applyMap(
  harness: LearnerHarness,
  mapId: string,
  mappings: readonly ConceptMapping[],
  requestId = nextRequest('compat'),
) {
  return harness.learner.applyCompatibilityMap(
    requestContext(harness, requestId),
    makeCompatibilityMap({ id: mapId, mappings }),
  );
}

describe('content version compatibility (renamed, split, merged, rubric change, unverified)', () => {
  it('carries only learning history through a verified rename; understanding is unassessed', async () => {
    const harness = await LearnerHarness.create();
    try {
      await supportedAndCompletedConcept(harness, CONCEPT_CELL);
      const applied = expectOk(
        await applyMap(harness, 'compat-rename', [
          conceptMapping({
            kind: 'renamed',
            fromConceptId: CONCEPT_CELL,
            toConceptIds: ['concept-cell-renamed'],
          }),
        ]),
      );
      expect(applied.newConceptIds).toEqual(['concept-cell-renamed']);
      expect(applied.inheritedConceptIds).toEqual(['concept-cell-renamed']);

      const renamed = expectOk(
        await harness.learner.get(
          requestContext(harness, 'renamed-progress'),
          key('concept-cell-renamed', 'pack-bio-7a-2026.2'),
        ),
      );
      expect(renamed.learning.state).toBe('completed');
      expect(renamed.learning.lastCompletedAt).toBe('2026-10-29T02:00:00Z');
      expect(renamed.understanding.state).toBe('unassessed');
      expect(renamed.understanding.assessmentId).toBeNull();
      expect(renamed.review.lastCompletedAt).toBeNull();
      expect(renamed.review.dueAt).toBeNull();

      const newExplanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'renamed-explain'), {
          conceptId: 'concept-cell-renamed',
          packVersion: 'pack-bio-7a-2026.2',
        }),
      );
      expect(newExplanation.historyInherited).toBe(true);
      expect(newExplanation.state).toBe('unassessed');
      expect(newExplanation.history).toEqual([]);

      // Old history remains readable and is not promoted into the new pack.
      const oldExplanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'old-explain'), {
          conceptId: CONCEPT_CELL,
          packVersion: PACK_VERSION,
        }),
      );
      expect(oldExplanation.state).toBe('supported');
      expect(oldExplanation.evidence.every((item) => item.validity === 'current')).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  it('splits one concept into several new concepts, each with learning history but no judgement', async () => {
    const harness = await LearnerHarness.create();
    try {
      const session = await startLearn(harness, CONCEPT_TISSUE);
      expectOk(
        await harness.learner.endSession(requestContext(harness, 'split-end'), {
          sessionId: session.id,
          status: 'abandoned',
          endedAt: '2026-10-29T01:30:00Z',
        }),
      );
      expectOk(
        await applyMap(harness, 'compat-split', [
          conceptMapping({
            kind: 'split',
            fromConceptId: CONCEPT_TISSUE,
            toConceptIds: ['concept-tissue-a', 'concept-tissue-b'],
          }),
        ]),
      );
      for (const conceptId of ['concept-tissue-a', 'concept-tissue-b']) {
        const progress = expectOk(
          await harness.learner.get(
            requestContext(harness, `split-${conceptId}`),
            key(conceptId, PACK_VERSION_V2),
          ),
        );
        expect(progress.learning.state).toBe('in_progress');
        expect(progress.learning.startedAt).toBe('2026-10-29T01:00:00Z');
        expect(progress.understanding.state).toBe('unassessed');
      }
    } finally {
      harness.cleanup();
    }
  });

  it('merges two old concepts into one new concept without double counting learning', async () => {
    const harness = await LearnerHarness.create();
    try {
      await supportedAndCompletedConcept(harness, CONCEPT_ORGAN, '2026-10-29T02:00:00Z');
      await supportedAndCompletedConcept(harness, CONCEPT_ENERGY, '2026-10-29T03:00:00Z');
      const applied = expectOk(
        await applyMap(harness, 'compat-merge', [
          conceptMapping({
            kind: 'merged',
            fromConceptId: CONCEPT_ORGAN,
            toConceptIds: ['concept-merged'],
          }),
          conceptMapping({
            kind: 'merged',
            fromConceptId: CONCEPT_ENERGY,
            toConceptIds: ['concept-merged'],
          }),
        ]),
      );
      expect(applied.newConceptIds).toEqual(['concept-merged']);
      const merged = expectOk(
        await harness.learner.get(
          requestContext(harness, 'merged-progress'),
          key('concept-merged', PACK_VERSION_V2),
        ),
      );
      expect(merged.learning.state).toBe('completed');
      expect(merged.learning.lastCompletedAt).toBe('2026-10-29T03:00:00Z');
      expect(merged.understanding.state).toBe('unassessed');
      const list = expectOk(
        await harness.learner.list(requestContext(harness, 'merged-list'), {
          learnerId: LEARNER_ID,
          courseEditionId: COURSE_EDITION_ID,
          packVersion: PACK_VERSION_V2,
        }),
      );
      expect(list.filter((progress) => progress.conceptId === 'concept-merged')).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  it('flags rubric changes as needs_recheck and never copies supported', async () => {
    const harness = await LearnerHarness.create();
    try {
      await supportedAndCompletedConcept(harness, CONCEPT_CELL);
      expectOk(
        await applyMap(harness, 'compat-rubric', [
          conceptMapping({
            kind: 'rubric_changed',
            fromConceptId: CONCEPT_CELL,
            toConceptIds: ['concept-cell-rubric-v2'],
            evidenceEffect: 'recheck',
          }),
        ]),
      );
      const changed = expectOk(
        await harness.learner.get(
          requestContext(harness, 'rubric-progress'),
          key('concept-cell-rubric-v2', PACK_VERSION_V2),
        ),
      );
      expect(changed.learning.state).toBe('not_started');
      expect(changed.understanding.state).toBe('unassessed');
      expect(changed.understanding.validity).toBe('needs_recheck');

      const oldExplanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'rubric-old-explain'), {
          conceptId: CONCEPT_CELL,
          packVersion: PACK_VERSION,
        }),
      );
      expect(oldExplanation.state).toBe('supported');
      expect(oldExplanation.stale).toBe(true);
      expect(oldExplanation.requiresRecheck).toBe(true);
      expect(oldExplanation.evidence[0]?.validity).toBe('needs_recheck');
      const entry = harness.learner.projectionEntries.find(
        (item) =>
          item.progress.conceptId === CONCEPT_CELL &&
          item.progress.packVersion === PACK_VERSION,
      );
      expect(entry?.assessments.every((item) => item.validity === 'needs_recheck')).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  it('treats an unverified mapping as no inheritance and marks old evidence stale', async () => {
    const harness = await LearnerHarness.create();
    try {
      await supportedAndCompletedConcept(harness, CONCEPT_CELL);
      expectOk(
        await applyMap(harness, 'compat-unverified', [
          conceptMapping({
            kind: 'unchanged',
            fromConceptId: CONCEPT_CELL,
            toConceptIds: ['concept-cell-unverified'],
            verified: false,
            evidenceEffect: 'stale',
          }),
        ]),
      );
      const unverified = expectOk(
        await harness.learner.get(
          requestContext(harness, 'unverified-progress'),
          key('concept-cell-unverified', PACK_VERSION_V2),
        ),
      );
      expect(unverified.learning.state).toBe('not_started');
      expect(unverified.learning.lastCompletedAt).toBeNull();
      expect(unverified.understanding.state).toBe('unassessed');
      expect(unverified.understanding.validity).toBe('needs_recheck');

      const oldExplanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'unverified-old-explain'), {
          conceptId: CONCEPT_CELL,
          packVersion: PACK_VERSION,
        }),
      );
      expect(oldExplanation.evidence[0]?.validity).toBe('stale');
    } finally {
      harness.cleanup();
    }
  });

  it('carries learning but marks source revisions stale, and skips removed/added concepts', async () => {
    const harness = await LearnerHarness.create();
    try {
      await supportedAndCompletedConcept(harness, CONCEPT_CELL);
      expectOk(
        await applyMap(harness, 'compat-source', [
          conceptMapping({
            kind: 'source_revised',
            fromConceptId: CONCEPT_CELL,
            toConceptIds: ['concept-cell-source-v2'],
            evidenceEffect: 'stale',
          }),
        ]),
      );
      const revised = expectOk(
        await harness.learner.get(
          requestContext(harness, 'source-progress'),
          key('concept-cell-source-v2', PACK_VERSION_V2),
        ),
      );
      expect(revised.learning.state).toBe('completed');
      expect(revised.understanding.state).toBe('unassessed');
      expect(revised.understanding.validity).toBe('needs_recheck');

      const removedAdded = expectOk(
        await applyMap(harness, 'compat-removed-added', [
          conceptMapping({ kind: 'removed', fromConceptId: CONCEPT_ORGAN, toConceptIds: [] }),
          conceptMapping({ kind: 'added', fromConceptId: null, toConceptIds: ['concept-new'] }),
        ]),
      );
      expect(removedAdded.newConceptIds).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  it('is idempotent for one requestId and rejects reapplying the same map with a new request', async () => {
    const harness = await LearnerHarness.create();
    try {
      await supportedAndCompletedConcept(harness, CONCEPT_CELL);
      const mappings = [
        conceptMapping({
          kind: 'renamed',
          fromConceptId: CONCEPT_CELL,
          toConceptIds: ['concept-cell-renamed'],
        }),
      ];
      const first = expectOk(
        await applyMap(harness, 'compat-idempotent', mappings, 'compat-request-1'),
      );
      const linesAfterFirst = harness.journalLines().length;
      const duplicate = expectOk(
        await applyMap(harness, 'compat-idempotent', mappings, 'compat-request-1'),
      );
      expect(duplicate.duplicate).toBe(true);
      expect(harness.journalLines()).toHaveLength(linesAfterFirst);
      expect(
        harness.journalCommands().filter((command) => command['type'] === 'compatibility.applied'),
      ).toHaveLength(1);
      expect(harness.learner.appliedCompatibility).toHaveLength(1);
      expect(first.duplicate).toBe(false);

      const secondRequest = expectError(
        await applyMap(harness, 'compat-idempotent', mappings, 'compat-request-2'),
      );
      expect(secondRequest.code).toBe('CONFLICT');
    } finally {
      harness.cleanup();
    }
  });
});
