/**
 * Unit invariants that are easier to prove directly than through fixtures:
 * tree/relation shape, publication immutability, evidence rules, review
 * semantics and subject extensibility.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyImportProgress,
  applySelfReport,
  assessmentCommitKey,
  checkEvidenceAgainstAttempt,
  checkTocTree,
  checkRelations,
  deriveUnderstandingState,
  isReviewDue,
  projectReview,
  transitionAttemptCommit,
  validateActivityAttempt,
  validateAttemptCommitState,
  validateConceptProgress,
  validateContentPack,
  validateContentPackUpdate,
  validateCourseEdition,
  validateEvidence,
  validateImportJob,
  validateProgressForTrust,
  validateSession,
  validateAssessmentForSession,
  type ActivityAttempt,
  type AttemptCommitState,
  type ConceptProgress,
  type ContentPack,
  type CourseEdition,
  type Evidence,
  type ImportJob,
  type Session,
  type UnderstandingEvidenceInput,
  type ValidationResult,
} from '../../src/index.js';

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures');

function load<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(fixturesRoot, file), 'utf8')) as T;
}

function mustOk<T>(result: ValidationResult<T>, label: string): T {
  if (!result.ok) {
    throw new Error(`${label} failed: ${JSON.stringify(result.issues)}`);
  }
  return result.value;
}

const validPack = mustOk<ContentPack>(validateContentPack(load('packs/valid-partial.json')), 'pack');

function evidenceInput(overrides: Partial<UnderstandingEvidenceInput> = {}): UnderstandingEvidenceInput {
  return {
    kind: 'explain',
    assistance: 'unassisted',
    assessmentOrigin: 'rule',
    uncertainty: null,
    validity: 'current',
    criterionResults: [{ result: 'met' }],
    attemptId: 'attempt.1',
    activityId: 'activity.1',
    coreMisconception: false,
    answerDisclosed: false,
    ...overrides,
  };
}

describe('toc and relation invariants', () => {
  it('accepts the valid two chapter / three section fixture pack', () => {
    const tree = mustOk(checkTocTree(validPack.toc, validPack.courseEditionId), 'toc');
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0]?.type).toBe('volume');
    expect(tree.depthOf.get('toc.ch2.s1')).toBe(2);
  });

  it('rejects sibling order collisions and multiple roots', () => {
    const nodes = validPack.toc.map((node) => ({ ...node }));
    const secondRoot = nodes.find((node) => node.id === 'toc.ch2');
    if (secondRoot !== undefined) secondRoot.parentId = null;
    const tree = checkTocTree(nodes, validPack.courseEditionId);
    expect(tree.ok).toBe(false);
    if (!tree.ok) {
      const codes = tree.issues.map((issue) => issue.code);
      expect(codes).toContain('TOC_MULTIPLE_ROOTS');
    }
  });

  it('keeps related endpoints sorted and prerequisite edges acyclic', () => {
    const conceptIds = new Set(validPack.concepts.map((concept) => concept.id));
    const index = mustOk(checkRelations(validPack.relations, conceptIds, validPack.courseEditionId), 'relations');
    expect(index.prerequisiteAdjacency.get('concept.cell')).toContain('concept.cell-structure');
  });

  it('rejects a reversed related edge', () => {
    const related = validPack.relations.find((relation) => relation.type === 'related');
    expect(related).toBeDefined();
    if (related === undefined) return;
    const reversed = {
      ...related,
      id: 'relation.reversed',
      fromConceptId: related.toConceptId,
      toConceptId: related.fromConceptId,
    };
    const result = checkRelations(
      [...validPack.relations, reversed],
      new Set(validPack.concepts.map((concept) => concept.id)),
      validPack.courseEditionId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('RELATION_ENDPOINT_ORDER');
    }
  });
});

describe('content pack publication rules', () => {
  it('rejects in place rewriting of an existing pack version', () => {
    const rewritten: ContentPack = { ...validPack, contentHash: 'd'.repeat(64) };
    const result = validateContentPackUpdate(validPack, rewritten);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain('PACK_IMMUTABLE');
  });

  it('rejects a new version with an unchanged content hash', () => {
    const next: ContentPack = { ...validPack, version: '1.0.1' };
    const result = validateContentPackUpdate(validPack, next);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain('PACK_IMMUTABLE');
  });

  it('accepts a new version with a new content hash', () => {
    const next: ContentPack = {
      ...validPack,
      version: '1.0.1',
      contentHash: 'd'.repeat(64),
    };
    expect(validateContentPackUpdate(validPack, next).ok).toBe(true);
  });

  it('keeps a partial pack from claiming complete coverage', () => {
    const bad: ContentPack = { ...validPack, coverageStatus: 'complete' };
    const result = validateContentPack(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('PACK_SCOPE_INVALID');
    }
  });
});

describe('understanding and review semantics', () => {
  it('assisted-only evidence never upgrades understanding', () => {
    const derivation = deriveUnderstandingState({
      conceptId: 'concept.cell',
      rubricVersion: '1',
      trustMode: 'published',
      completedActivities: 1,
      evidences: [evidenceInput({ assistance: 'assisted' })],
    });
    expect(derivation.state).toBe('unassessed');
  });

  it('explanation alone is developing, explanation + transfer in two attempts is supported', () => {
    const developing = deriveUnderstandingState({
      conceptId: 'concept.cell',
      rubricVersion: '1',
      trustMode: 'published',
      completedActivities: 2,
      evidences: [evidenceInput()],
    });
    expect(developing.state).toBe('developing');

    const supported = deriveUnderstandingState({
      conceptId: 'concept.cell',
      rubricVersion: '1',
      trustMode: 'published',
      completedActivities: 2,
      evidences: [
        evidenceInput({ kind: 'explain', attemptId: 'attempt.1' }),
        evidenceInput({ kind: 'transfer', attemptId: 'attempt.2' }),
      ],
    });
    expect(supported.state).toBe('supported');
  });

  it('same attempt cannot count as two activities', () => {
    const derivation = deriveUnderstandingState({
      conceptId: 'concept.cell',
      rubricVersion: '1',
      trustMode: 'published',
      completedActivities: 2,
      evidences: [
        evidenceInput({ kind: 'explain', attemptId: 'attempt.1' }),
        evidenceInput({ kind: 'transfer', attemptId: 'attempt.1' }),
      ],
    });
    expect(derivation.state).toBe('developing');
  });

  it('counter evidence falls back to needs_support', () => {
    const derivation = deriveUnderstandingState({
      conceptId: 'concept.cell',
      rubricVersion: '1',
      trustMode: 'published',
      completedActivities: 2,
      evidences: [
        evidenceInput({ attemptId: 'attempt.1' }),
        evidenceInput({
          kind: 'transfer',
          attemptId: 'attempt.2',
          criterionResults: [{ result: 'not_met' }],
        }),
      ],
    });
    expect(derivation.state).toBe('needs_support');
  });

  it('low confidence model evidence stays pending and does not upgrade', () => {
    const derivation = deriveUnderstandingState({
      conceptId: 'concept.cell',
      rubricVersion: '1',
      trustMode: 'published',
      completedActivities: 1,
      evidences: [
        evidenceInput({ assessmentOrigin: 'model', uncertainty: 0.9, attemptId: 'attempt.1' }),
      ],
    });
    expect(derivation.state).toBe('unassessed');
    expect(derivation.pendingEvidenceCount).toBe(1);
  });

  it('candidate trust mode keeps formal understanding unassessed', () => {
    const derivation = deriveUnderstandingState({
      conceptId: 'concept.cell',
      rubricVersion: '1',
      trustMode: 'candidate',
      completedActivities: 2,
      evidences: [
        evidenceInput({ attemptId: 'attempt.1' }),
        evidenceInput({ kind: 'transfer', attemptId: 'attempt.2' }),
      ],
    });
    expect(derivation.state).toBe('unassessed');
  });

  it('reviewed and due can both be true', () => {
    const progress = mustOk<ConceptProgress>(
      validateConceptProgress(load('progress/reviewed-and-due.json')),
      'progress',
    );
    const projection = projectReview(progress.review, '2026-10-29T09:00:00Z');
    expect(projection.everReviewed).toBe(true);
    expect(projection.isDue).toBe(true);
    expect(isReviewDue(progress.review, '2026-10-27T09:00:00Z')).toBe(false);
    expect(isReviewDue(progress.review, '2026-10-28T09:00:00Z')).toBe(true);
  });

  it('self report never rewrites understanding', () => {
    const progress = mustOk<ConceptProgress>(
      validateConceptProgress(load('progress/no-evidence.json')),
      'progress',
    );
    const report = load<Parameters<typeof applySelfReport>[1]>('self-reports/cell.json');
    const result = applySelfReport(progress, report);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.learningClaimIgnored).toBe(true);
      expect(result.value.diagnosticSuggested).toBe(true);
      expect(result.value.progress.understanding.state).toBe('unassessed');
      expect(result.value.progress.revision).toBe(progress.revision);
    }
  });
});

describe('forged evidence and version bindings', () => {
  it('rejects evidence whose assistance contradicts the attempt help usage', () => {
    const attempt = mustOk<ActivityAttempt>(
      validateActivityAttempt(load('attempts/unassisted.json')),
      'attempt',
    );
    const forged: Evidence = {
      ...mustOk<Evidence>(validateEvidence(load('evidence/unassisted.json')), 'evidence'),
      assistance: 'assisted',
    };
    const result = checkEvidenceAgainstAttempt(forged, attempt);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('INVALID_REFERENCE');
    }
  });

  it('rejects evidence for a concept outside the submitted activity', () => {
    const attempt = mustOk<ActivityAttempt>(
      validateActivityAttempt(load('attempts/unassisted.json')),
      'attempt',
    );
    const evidence = mustOk<Evidence>(validateEvidence(load('evidence/unassisted.json')), 'evidence');
    const result = checkEvidenceAgainstAttempt(
      { ...evidence, conceptId: 'concept.cell-division' },
      attempt,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a candidate session assessment that claims supported', () => {
    const session: Session = {
      ...mustOk<Session>(validateSession(load('sessions/active.json')), 'session'),
      trustMode: 'candidate',
    };
    const assessment = load<Record<string, unknown>>('assessments/supported-valid.json');
    const result = validateAssessmentForSession(
      (assessment as { assessment: unknown }).assessment,
      session,
    );
    expect(result.ok).toBe(false);
  });

  it('candidate progress cannot display formal understanding', () => {
    const progress = mustOk<ConceptProgress>(
      validateConceptProgress(load('progress/reviewed-and-due.json')),
      'progress',
    );
    expect(progress.understanding.state).toBe('supported');
    const result = validateProgressForTrust(progress, 'candidate');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('CANDIDATE_STRONG_CLAIM');
    }
  });
});

describe('import job transitions', () => {
  it('rejects a stage downgrade', () => {
    const job = mustOk<ImportJob>(validateImportJob(load('import/await-review.json')), 'job');
    const result = applyImportProgress(job, {
      stage: 'extract',
      completedUnits: 42,
      updatedAt: '2026-10-29T09:01:00Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('IMPORT_TRANSITION_INVALID');
    }
  });

  it('does not allow completed progress to move backwards', () => {
    const job = mustOk<ImportJob>(validateImportJob(load('import/await-review.json')), 'job');
    const result = applyImportProgress(job, {
      completedUnits: 1,
      updatedAt: '2026-10-29T09:01:00Z',
    });
    expect(result.ok).toBe(false);
  });
});

describe('two phase attempt / assessment commit', () => {
  const saved: AttemptCommitState = mustOk<AttemptCommitState>(
    validateAttemptCommitState({
      schemaVersion: 1,
      attemptId: 'attempt.cell.explain',
      phase: 'attempt_saved',
      feedbackState: 'pending',
      revision: 1,
      lastRequestId: 'request.attempt.submit',
      updatedAt: '2026-10-29T08:10:00Z',
    }),
    'attempt_saved',
  );

  it('saves the raw answer before any assessment', () => {
    expect(saved.feedbackState).toBe('pending');
    const committed = mustOk<AttemptCommitState>(
      validateAttemptCommitState({
        ...saved,
        phase: 'assessment_committed',
        feedbackState: 'saved',
        revision: 2,
        lastRequestId: 'request.assessment.commit',
        updatedAt: '2026-10-29T08:20:00Z',
      }),
      'assessment_committed',
    );
    expect(transitionAttemptCommit(saved, committed).ok).toBe(true);
  });

  it('rejects a late assessment after cancellation', () => {
    const cancelled = mustOk<AttemptCommitState>(
      validateAttemptCommitState({
        ...saved,
        phase: 'assessment_cancelled',
        feedbackState: 'cancelled',
        revision: 2,
        lastRequestId: 'request.assessment.cancel',
      }),
      'cancelled',
    );
    const late = mustOk<AttemptCommitState>(
      validateAttemptCommitState({
        ...saved,
        phase: 'assessment_committed',
        feedbackState: 'saved',
        revision: 3,
        lastRequestId: 'request.assessment.late',
      }),
      'late',
    );
    const result = transitionAttemptCommit(cancelled, late);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('ATTEMPT_COMMIT_INVALID');
    }
  });

  it('keeps a committed assessment terminal', () => {
    const committed = mustOk<AttemptCommitState>(
      validateAttemptCommitState({
        ...saved,
        phase: 'assessment_committed',
        feedbackState: 'saved',
        revision: 2,
        lastRequestId: 'request.assessment.commit',
      }),
      'committed',
    );
    const downgraded = mustOk<AttemptCommitState>(
      validateAttemptCommitState({
        ...saved,
        phase: 'assessment_failed',
        feedbackState: 'failed',
        revision: 3,
        lastRequestId: 'request.assessment.retry',
      }),
      'failed',
    );
    expect(transitionAttemptCommit(committed, downgraded).ok).toBe(false);
  });

  it('dedupes assessment commits on attemptId + graderVersion + revision', () => {
    const first = assessmentCommitKey('attempt.cell.explain', 'grader-v1', 2);
    expect(first).toBe('attempt.cell.explain|grader-v1|2');
    expect(assessmentCommitKey('attempt.cell.explain', 'grader-v1', 3)).not.toBe(first);
    expect(assessmentCommitKey('attempt.cell.explain', 'grader-v2', 2)).not.toBe(first);
  });
});

describe('extension and strictness', () => {
  it('accepts a new subject without changing a domain enum', () => {
    const biology = mustOk<CourseEdition>(
      validateCourseEdition(load('entities/course-edition.json')),
      'course edition',
    );
    const physics: CourseEdition = {
      ...biology,
      id: 'course.physics-8a',
      subject: 'physics',
      grade: 8,
    };
    expect(validateCourseEdition(physics).ok).toBe(true);
  });

  it('rejects a verified course edition without cover evidence', () => {
    const biology = mustOk<CourseEdition>(
      validateCourseEdition(load('entities/course-edition.json')),
      'course edition',
    );
    const result = validateCourseEdition({
      ...biology,
      sourceIdentity: { verifiedFrom: 'none', notes: 'filename only', sha256: null },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('COURSE_IDENTITY_UNVERIFIED');
    }
  });

  it('rejects unknown fields at the boundary', () => {
    const session = load<Record<string, unknown>>('sessions/active.json');
    const result = validateSession({ ...session, injected: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_FIELD');
    }
  });
});
