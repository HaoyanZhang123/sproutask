/**
 * Contract test: every manifest case must produce the declared outcome.
 *
 * These are the fixtures T02–T12 consume. Do not fork them; extend the
 * manifest and generator instead.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyImportProgress,
  attemptAssistance,
  canonicalContentJson,
  checkSessionOutputFreshness,
  classifyJournalText,
  projectProgressUnderCompatibility,
  projectReview,
  validateActivityAttempt,
  validateAssessmentForSession,
  validateAssessmentWithEvidence,
  validateBookInstance,
  validateCompatibilityMap,
  validateConceptProgress,
  validateContentPack,
  validateCourseEdition,
  validateEvidence,
  validateFigure,
  validateGradeResult,
  validateImportJob,
  validateLearner,
  validateRealtimeEnvelope,
  validateSelfReport,
  validateSession,
  validateSnapshot,
  validateSourceBlock,
  validateSourceRef,
  type ConceptProgress,
  type ContentPack,
  type ValidationResult,
} from '../../src/index.js';

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures');

interface FixtureCase {
  readonly id: string;
  readonly kind: string;
  readonly file: string;
  readonly expect: {
    readonly ok?: boolean;
    readonly errorCodes?: readonly string[];
    readonly matches?: boolean;
    readonly assistance?: string;
    readonly state?: string;
    readonly everReviewed?: boolean;
    readonly isDue?: boolean;
    readonly now?: string;
    readonly projectionReason?: string;
    readonly carryLearningHistory?: boolean;
    readonly staleEvidence?: boolean;
    readonly tailPartial?: boolean;
    readonly duplicateRequestIds?: readonly string[];
    readonly corruptLines?: readonly number[];
    readonly requiresClarification?: boolean;
  };
}

const manifest = JSON.parse(
  readFileSync(path.join(fixturesRoot, 'manifest.json'), 'utf8'),
) as { readonly cases: readonly FixtureCase[] };

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesRoot, file), 'utf8'));
}

function readText(file: string): string {
  return readFileSync(path.join(fixturesRoot, file), 'utf8');
}

function assertExpected(
  caseId: string,
  result: ValidationResult<unknown>,
  expected: FixtureCase['expect'],
): void {
  if (expected.ok === true) {
    expect(result.ok, `${caseId} should pass: ${JSON.stringify(result.ok ? [] : result.issues)}`).toBe(
      true,
    );
    return;
  }
  if (expected.ok === false) {
    expect(result.ok, `${caseId} should be rejected`).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((issue) => issue.code);
      for (const code of expected.errorCodes ?? []) {
        expect(codes, `${caseId} expected issue ${code}, got ${codes.join(',')}`).toContain(code);
      }
    }
  }
}

const entityValidators: Record<string, (input: unknown) => ValidationResult<unknown>> = {
  courseEdition: validateCourseEdition,
  bookInstance: validateBookInstance,
  sourceRef: validateSourceRef,
  sourceBlock: validateSourceBlock,
  figure: validateFigure,
  learner: validateLearner,
  session: validateSession,
  attempt: validateActivityAttempt,
  evidence: validateEvidence,
  progress: validateConceptProgress,
  selfReport: validateSelfReport,
  importJob: validateImportJob,
  grade: validateGradeResult,
  snapshot: validateSnapshot,
};

describe('05 §8 fixture contract', () => {
  it('manifest covers the required entity groups and journals', () => {
    const kinds = new Set(manifest.cases.map((entry) => entry.kind));
    for (const required of [
      'contentPack',
      'contentHash',
      'session',
      'attempt',
      'evidence',
      'assessmentBundle',
      'progress',
      'journalText',
    ]) {
      expect(kinds, `manifest is missing kind ${required}`).toContain(required);
    }
    expect(manifest.cases.length).toBeGreaterThanOrEqual(50);
  });

  for (const entry of manifest.cases) {
    it(`${entry.id} (${entry.kind})`, () => {
      const payload = entry.kind === 'journalText' ? null : readJson(entry.file);

      if (entry.kind === 'contentPack') {
        const result = validateContentPack(payload);
        assertExpected(entry.id, result, entry.expect);
        return;
      }

      if (entry.kind === 'contentHash') {
        const pack = payload as ContentPack;
        const recomputed = createHash('sha256')
          .update(canonicalContentJson(pack), 'utf8')
          .digest('hex');
        expect(recomputed === pack.contentHash, `${entry.id} content hash mismatch`).toBe(
          entry.expect.matches,
        );
        return;
      }

      if (entry.kind === 'journalText') {
        const classification = classifyJournalText(readText(entry.file));
        expect(classification.ok, `${entry.id} expected ok=${String(entry.expect.ok)}`).toBe(
          entry.expect.ok,
        );
        if (entry.expect.tailPartial !== undefined) {
          expect(classification.tailPartial).toBe(entry.expect.tailPartial);
        }
        if (entry.expect.duplicateRequestIds !== undefined) {
          expect(classification.duplicateRequestIds).toEqual(entry.expect.duplicateRequestIds);
        }
        if (entry.expect.corruptLines !== undefined) {
          expect(classification.corruptLines.map((line) => line.line)).toEqual(
            entry.expect.corruptLines,
          );
        }
        return;
      }

      if (entry.kind === 'assessmentBundle') {
        const bundle = payload as {
          assessment: unknown;
          evidences: Parameters<typeof validateAssessmentWithEvidence>[1]['evidences'];
          attempts: Parameters<typeof validateAssessmentWithEvidence>[1]['attempts'];
        };
        const result = validateAssessmentWithEvidence(bundle.assessment, {
          evidences: bundle.evidences,
          attempts: bundle.attempts,
        });
        assertExpected(entry.id, result, entry.expect);
        return;
      }

      if (entry.kind === 'assessmentForSession') {
        const bundle = payload as { assessment: unknown; session: Parameters<typeof validateAssessmentForSession>[1] };
        const result = validateAssessmentForSession(bundle.assessment, bundle.session);
        assertExpected(entry.id, result, entry.expect);
        return;
      }

      if (entry.kind === 'importTransition') {
        const bundle = payload as {
          job: Parameters<typeof applyImportProgress>[0];
          update: Parameters<typeof applyImportProgress>[1];
        };
        const result = applyImportProgress(bundle.job, bundle.update);
        assertExpected(entry.id, result, entry.expect);
        return;
      }

      if (entry.kind === 'compatibility') {
        const bundle = payload as { map: Parameters<typeof projectProgressUnderCompatibility>[0] };
        const map = validateCompatibilityMap(bundle.map);
        assertExpected(entry.id, map, entry.expect);
        if (map.ok) {
          const projection = projectProgressUnderCompatibility(map.value.mappings[0]);
          expect(projection.understandingState).toBe('unassessed');
          expect(projection.reason).toBe(entry.expect.projectionReason);
          expect(projection.carryLearningHistory).toBe(entry.expect.carryLearningHistory);
          expect(projection.staleEvidence).toBe(entry.expect.staleEvidence);
        }
        return;
      }

      if (entry.kind === 'sessionOutput') {
        const bundle = payload as {
          envelope: unknown;
          expected: Parameters<typeof checkSessionOutputFreshness>[1];
        };
        const envelope = validateRealtimeEnvelope(bundle.envelope);
        expect(envelope.ok, `sessionOutput envelope should be structurally valid`).toBe(true);
        if (envelope.ok) {
          assertExpected(
            entry.id,
            checkSessionOutputFreshness(envelope.value, bundle.expected),
            entry.expect,
          );
        }
        return;
      }

      if (entry.kind === 'assessment') {
        // structural assessment case: no evidence pool
        const structural = validateAssessmentWithEvidence(payload, { evidences: [] });
        assertExpected(entry.id, structural, entry.expect);
        return;
      }

      const validator = entityValidators[entry.kind];
      expect(validator, `no validator for fixture kind ${entry.kind}`).toBeDefined();
      if (validator === undefined) return;
      const result = validator(payload);
      assertExpected(entry.id, result, entry.expect);
      if (entry.kind === 'attempt' && result.ok && entry.expect.assistance !== undefined) {
        expect(attemptAssistance(result.value as Parameters<typeof attemptAssistance>[0])).toBe(
          entry.expect.assistance,
        );
      }
      if (entry.kind === 'progress' && result.ok) {
        const progress = result.value as ConceptProgress;
        if (entry.expect.isDue !== undefined) {
          const projection = projectReview(
            progress.review,
            entry.expect.now ?? '2026-10-29T09:00:00Z',
          );
          expect(projection.isDue).toBe(entry.expect.isDue);
          expect(projection.everReviewed).toBe(entry.expect.everReviewed);
        }
        if (entry.expect.state !== undefined) {
          expect(progress.understanding.state).toBe(entry.expect.state);
        }
      }
      if (entry.kind === 'grade' && result.ok) {
        expect((result.value as { requiresClarification: boolean }).requiresClarification).toBe(
          entry.expect.requiresClarification,
        );
      }
    });
  }
});
