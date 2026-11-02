import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  openStorage,
  requestContext,
  tmpRoot,
  validAttemptBundle,
  evidenceFixture,
} from './helpers.js';

let root: string;

beforeEach(() => {
  root = tmpRoot('attempts');
});

afterEach(() => {
  cleanup(root);
});

function journalPayloads(): Record<string, unknown>[] {
  const file = path.join(root, 'journal', 'events.jsonl');
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function submitAll(
  storage: Awaited<ReturnType<typeof openStorage>>,
  attempts: readonly import('@edu/domain').ActivityAttempt[],
): Promise<void> {
  for (const attempt of attempts) {
    const submitted = await storage.attempts.submitAttempt(
      requestContext(`req.submit.${attempt.id}`),
      attempt,
    );
    if (!submitted.ok) {
      throw new Error(`submit failed: ${JSON.stringify(submitted.error)}`);
    }
  }
}

describe('two phase attempt / assessment commit', () => {
  it('saves the raw answer first with pending feedback, then commits evidence atomically', async () => {
    const bundle = validAttemptBundle();
    const attempt = bundle.attempts[0];
    const storage = await openStorage(root);
    try {
      if (attempt === undefined) throw new Error('fixture attempt missing');
      await submitAll(storage, bundle.attempts);
      const pending = await storage.attempts.getState(requestContext('req.state'), attempt.id);
      expect(pending.ok).toBe(true);
      if (pending.ok) {
        expect(pending.data.phase).toBe('attempt_saved');
        expect(pending.data.feedbackState).toBe('pending');
      }

      const committed = await storage.attempts.commitAssessment(
        requestContext('req.assessment.commit'),
        {
          assessment: bundle.assessment,
          evidence: bundle.evidences,
          effects: [{ kind: 'progress.changed', targetId: 'concept.cell', revision: 1 }],
          graderVersion: 'grader-v1',
        },
      );
      expect(committed.ok).toBe(true);
      if (committed.ok) expect(committed.data.seq).toBe(3);

      const state = await storage.attempts.getState(requestContext('req.state.2'), attempt.id);
      expect(state.ok).toBe(true);
      if (state.ok) {
        expect(state.data.phase).toBe('assessment_committed');
        expect(state.data.feedbackState).toBe('saved');
        expect(state.data.revision).toBe(bundle.assessment.revision);
      }

      const lines = journalPayloads();
      expect(lines).toHaveLength(3);
      const payload = lines[2]?.payload as Record<string, unknown>;
      expect(payload['dedupeKey']).toBe(
        `${attempt.id}|grader-v1|${bundle.assessment.revision}`,
      );
      expect(Array.isArray(payload['evidence'])).toBe(true);
      const effects = lines[2]?.['effects'] as { kind: string }[];
      expect(effects.map((effect) => effect.kind)).toEqual([
        'progress.changed',
        'assessment.committed',
      ]);
      expect(effects).toContainEqual({
        kind: 'assessment.committed',
        targetId: bundle.assessment.id,
        revision: bundle.assessment.revision,
      });
    } finally {
      storage.close();
    }
  });

  it('deduplicates a reused requestId without writing a second journal line', async () => {
    const bundle = validAttemptBundle();
    const attempt = bundle.attempts[0];
    if (attempt === undefined) throw new Error('fixture attempt missing');
    const storage = await openStorage(root);
    try {
      await submitAll(storage, bundle.attempts);
      const ctx = requestContext('req.commit');
      const first = await storage.attempts.commitAssessment(ctx, {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
      const retry = await storage.attempts.commitAssessment(ctx, {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
      expect(first.ok && retry.ok).toBe(true);
      if (first.ok && retry.ok) {
        expect(retry.data.duplicate).toBe(true);
        expect(retry.data.seq).toBe(first.data.seq);
      }
      expect(journalPayloads()).toHaveLength(3);
    } finally {
      storage.close();
    }
  });

  it('deduplicates assessment commits on attemptId + graderVersion + revision', async () => {
    const bundle = validAttemptBundle();
    const attempt = bundle.attempts[0];
    if (attempt === undefined) throw new Error('fixture attempt missing');
    const storage = await openStorage(root);
    try {
      await submitAll(storage, bundle.attempts);
      const first = await storage.attempts.commitAssessment(requestContext('req.commit.1'), {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
      const sameKey = await storage.attempts.commitAssessment(requestContext('req.commit.2'), {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
      expect(first.ok && sameKey.ok).toBe(true);
      if (first.ok && sameKey.ok) {
        expect(sameKey.data.duplicate).toBe(true);
        expect(sameKey.data.dedupeKey).toBe(first.data.dedupeKey);
      }
      expect(journalPayloads()).toHaveLength(3);

      const differentRevision = await storage.attempts.commitAssessment(
        requestContext('req.commit.3'),
        {
          assessment: { ...bundle.assessment, revision: bundle.assessment.revision + 1 },
          evidence: bundle.evidences,
          graderVersion: 'grader-v1',
        },
      );
      expect(differentRevision.ok).toBe(false);
      if (!differentRevision.ok) expect(differentRevision.error.code).toBe('CONFLICT');
    } finally {
      storage.close();
    }
  });

  it('never publishes a late assessment after cancellation and does not judge wrong', async () => {
    const bundle = validAttemptBundle();
    const attempt = bundle.attempts[0];
    if (attempt === undefined) throw new Error('fixture attempt missing');
    const storage = await openStorage(root);
    try {
      await submitAll(storage, bundle.attempts);
      const cancelled = await storage.attempts.cancelAssessment(requestContext('req.cancel'), {
        attemptId: attempt.id,
        graderVersion: 'grader-v1',
        revision: 1,
        reason: 'student cancelled',
      });
      expect(cancelled.ok).toBe(true);
      const late = await storage.attempts.commitAssessment(requestContext('req.late'), {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
      expect(late.ok).toBe(false);
      if (!late.ok) expect(late.error.code).toBe('CONTRACT_REJECTED');
      const state = await storage.attempts.getState(requestContext('req.state'), attempt.id);
      expect(state.ok).toBe(true);
      if (state.ok) {
        expect(state.data.phase).toBe('assessment_cancelled');
        expect(state.data.feedbackState).toBe('cancelled');
      }
      expect(storage.replay(attempt.learnerId).assessments).toHaveLength(0);
      expect(journalPayloads()).toHaveLength(3);
    } finally {
      storage.close();
    }
  });

  it('allows retrying grading after a failure, but not after a commit', async () => {
    const bundle = validAttemptBundle();
    const attempt = bundle.attempts[0];
    if (attempt === undefined) throw new Error('fixture attempt missing');
    const storage = await openStorage(root);
    try {
      await submitAll(storage, bundle.attempts);
      const failed = await storage.attempts.failAssessment(requestContext('req.fail'), {
        attemptId: attempt.id,
        graderVersion: 'grader-v1',
        revision: 1,
        reason: 'model timeout',
      });
      expect(failed.ok).toBe(true);
      const retry = await storage.attempts.commitAssessment(requestContext('req.retry'), {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
      expect(retry.ok).toBe(true);

      const failAfterCommit = await storage.attempts.failAssessment(
        requestContext('req.fail.after'),
        {
          attemptId: attempt.id,
          graderVersion: 'grader-v1',
          revision: 2,
          reason: 'late failure',
        },
      );
      expect(failAfterCommit.ok).toBe(false);
      if (!failAfterCommit.ok) expect(failAfterCommit.error.code).toBe('CONFLICT');
    } finally {
      storage.close();
    }
  });

  it('requires the attempt to be saved before grading and evidence to match', async () => {
    const bundle = validAttemptBundle();
    const attempt = bundle.attempts[0];
    if (attempt === undefined) throw new Error('fixture attempt missing');
    const storage = await openStorage(root);
    try {
      const beforeSubmit = await storage.attempts.commitAssessment(requestContext('req.early'), {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
      expect(beforeSubmit.ok).toBe(false);
      if (!beforeSubmit.ok) expect(beforeSubmit.error.code).toBe('INVALID_INPUT');

      await storage.attempts.submitAttempt(requestContext('req.submit'), attempt);
      const mismatched = await storage.attempts.commitAssessment(requestContext('req.mismatch'), {
        assessment: bundle.assessment,
        evidence: [evidenceFixture()],
        graderVersion: 'grader-v1',
      });
      expect(mismatched.ok).toBe(false);
      if (!mismatched.ok) expect(mismatched.error.code).toBe('INVALID_INPUT');
      expect(storage.replay(attempt.learnerId).assessments).toHaveLength(0);
    } finally {
      storage.close();
    }
  });

  it('refuses a second answer for the same attempt and keeps state across reopen', async () => {
    const bundle = validAttemptBundle();
    const attempt = bundle.attempts[0];
    if (attempt === undefined) throw new Error('fixture attempt missing');
    const storage = await openStorage(root);
    try {
      await submitAll(storage, bundle.attempts);
      const duplicateAnswer = await storage.attempts.submitAttempt(
        requestContext('req.submit.again'),
        attempt,
      );
      expect(duplicateAnswer.ok).toBe(false);
      if (!duplicateAnswer.ok) expect(duplicateAnswer.error.code).toBe('CONFLICT');

      await storage.attempts.commitAssessment(requestContext('req.commit'), {
        assessment: bundle.assessment,
        evidence: bundle.evidences,
        graderVersion: 'grader-v1',
      });
    } finally {
      storage.close();
    }
    const reopened = await openStorage(root);
    try {
      const state = await reopened.attempts.getState(requestContext('req.state'), attempt.id);
      expect(state.ok).toBe(true);
      if (state.ok) expect(state.data.phase).toBe('assessment_committed');
      const replay = reopened.replay(attempt.learnerId);
      expect(replay.evidence).toHaveLength(2);
      expect(replay.assessments).toHaveLength(1);
    } finally {
      reopened.close();
    }
  });
});
