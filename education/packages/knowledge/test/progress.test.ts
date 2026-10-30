import { describe, expect, it } from 'vitest';
import { validateConceptProgress, type RequestContext } from '@edu/domain';
import {
  assertPublishedState,
  progressLookup,
  projectConceptState,
  projectGraphStates,
  readPackProgress,
  strongClaimSummary,
  type CandidateConceptState,
  type ProjectionStoreReader,
  type PublishedConceptState,
} from '../src/progress-projection.js';
import { buildSupportedProgress } from './helpers/fixtures.js';

function countSupported(states: readonly PublishedConceptState[]): number {
  return states.filter((state) => state.understanding.state === 'supported').length;
}

function compileTimeOnlyGuards(candidateStates: readonly CandidateConceptState[]): void {
  // @ts-expect-error candidate projection is not assignable to a published state
  countSupported(candidateStates);
  // @ts-expect-error candidate understanding is the literal 'unassessed'
  const supported: 'supported' = candidateStates[0].understanding.state;
  void supported;
}

const ctx: RequestContext = {
  requestId: 'request.progress.read',
  learnerId: 'learner.local',
  now: '2026-10-29T09:00:00Z',
};

describe('state projection consumes the frozen types only', () => {
  const progress = buildSupportedProgress();

  it('accepts the frozen ConceptProgress shape', () => {
    expect(validateConceptProgress(progress).ok).toBe(true);
  });

  it('projects published progress with strong claims enabled', () => {
    const state = projectConceptState('concept.cell', progress, 'published');
    expect(state.trustMode).toBe('published');
    expect(state.strongClaimsAllowed).toBe(true);
    expect(state.understanding.state).toBe('supported');
    expect(state.hasIndependentEvidence).toBe(true);
    expect(state.revision).toBe(3);
    const checked = assertPublishedState(state);
    expect(checked.ok).toBe(true);
  });

  it('forces candidate projections to unassessed and rejects strong claims', () => {
    const candidate = projectConceptState('concept.cell', progress, 'candidate');
    expect(candidate.trustMode).toBe('candidate');
    expect(candidate.strongClaimsAllowed).toBe(false);
    expect(candidate.understanding.state).toBe('unassessed');
    expect(candidate.understanding.reason).toBe('candidate_trust_mode');
    expect(candidate.hasIndependentEvidence).toBe(false);
    const checked = assertPublishedState(candidate);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.code).toBe('CONCEPT_STATE_NOT_PUBLISHED');
  });

  it('projects graph states per trust mode and aggregates published states only', () => {
    const lookup = progressLookup([progress]);
    const published = projectGraphStates(
      ['concept.cell', 'concept.cell-structure'],
      lookup,
      'published',
    );
    expect(published).toHaveLength(2);
    expect(strongClaimSummary(published)).toMatchObject({ supported: 1, total: 2, dueForReview: 1 });

    const candidate = projectGraphStates(
      ['concept.cell', 'concept.cell-structure'],
      lookup,
      'candidate',
    );
    expect(candidate.every((state) => state.understanding.state === 'unassessed')).toBe(true);
    // The compile time guard is a real function; calling it proves the
    // Type-level assertions above are checked by `tsc`.
    compileTimeOnlyGuards(candidate);
    expect(countSupported(published)).toBe(1);
  });

  it('reads progress through the learner projection port without implementing storage', async () => {
    const fakeReader: ProjectionStoreReader = {
      list: async () => ({ ok: true as const, data: [progress], revision: 1 }),
    };
    const result = await readPackProgress(fakeReader, ctx, {
      learnerId: 'learner.local',
      courseEditionId: 'course.biology-7a',
      packVersion: '1.0.0',
      conceptIds: ['concept.cell'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[0]?.conceptId).toBe('concept.cell');

    const failing: ProjectionStoreReader = {
      list: async () => ({
        ok: false as const,
        error: { code: 'NOT_FOUND', message: 'no projection', retryable: false },
      }),
    };
    const missing = await readPackProgress(failing, ctx, {
      learnerId: 'learner.local',
      courseEditionId: 'course.biology-7a',
      packVersion: '1.0.0',
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('returns neutral defaults when no progress exists yet', () => {
    const state = projectConceptState('concept.cell', null, 'published');
    expect(state.learning.state).toBe('not_started');
    expect(state.understanding.state).toBe('unassessed');
    expect(state.review.policyVersion).toBe('review-policy-v1');
    expect(state.hasIndependentEvidence).toBe(false);
    expect(state.revision).toBe(0);
  });
});
