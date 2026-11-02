import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@edu/domain';
import {
  PublishRegistry,
  evaluatePublication,
  validatePublication,
  validateReviewTransition,
} from '../src/publication.js';
import { checkCoverageManifest } from '../src/coverage.js';
import { computeContentHash } from '../src/content-hash.js';
import { clone, readPackFixture, withCuratorRelease } from './helpers/fixtures.js';

function withHash(pack: ContentPack): ContentPack {
  return { ...pack, contentHash: computeContentHash(pack) };
}

const PUBLISHED_AT = '2026-10-02T09:00:00Z';

describe('publication separation and scope honesty (A07/A28)', () => {
  const partial = readPackFixture('valid-partial.json');
  const full = readPackFixture('valid-full.json');
  const candidate = readPackFixture('valid-candidate.json');

  it('keeps candidate content out of formal claims', () => {
    const gate = evaluatePublication(candidate);
    expect(gate.label).toBe('candidate');
    expect(gate.strongClaimsAllowed).toBe(false);
    expect(gate.candidateUsableExplicitly).toBe(true);
    expect(gate.fullVolumeReady).toBe(false);
    const validation = validatePublication(candidate);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues.map((issue) => issue.code)).toContain('REVIEW_STATE_INVALID');
    }

    const promotedConcept = clone(candidate);
    const concepts = promotedConcept.concepts.map((concept) => ({ ...concept }));
    (concepts[0] as { reviewState: string }).reviewState = 'published';
    const inconsistent = withHash({ ...promotedConcept, concepts } as ContentPack);
    const claimCheck = validatePublication(inconsistent);
    expect(claimCheck.ok).toBe(false);
    expect(claimCheck.issues.map((issue) => issue.code)).toContain('CANDIDATE_STRONG_CLAIM');
  });

  it('lets a published partial pack unlock the first section milestone only', () => {
    const gate = evaluatePublication(partial);
    expect(gate.label).toBe('published_partial');
    expect(gate.g1Eligible).toBe(true);
    expect(gate.strongClaimsAllowed).toBe(true);
    expect(gate.fullVolumeReady).toBe(false);
    expect(gate.reasons.join(' ')).toContain('partial');
    expect(validatePublication(partial).ok).toBe(true);
  });

  it('requires full_volume + complete before claiming full volume readiness', () => {
    const gate = evaluatePublication(full);
    expect(gate.label).toBe('published_full_volume');
    expect(gate.fullVolumeReady).toBe(true);
    expect(validatePublication(full).ok).toBe(true);

    const partialClaimingComplete = readPackFixture('invalid-partial-complete.json');
    const partialGate = evaluatePublication(partialClaimingComplete);
    expect(partialGate.fullVolumeReady).toBe(false);
    const partialCheck = validatePublication(partialClaimingComplete);
    expect(partialCheck.ok).toBe(false);
    expect(partialCheck.issues.map((issue) => issue.code)).toContain('PACK_SCOPE_INVALID');

    const fullWithoutCoverage = readPackFixture('invalid-full-partial.json');
    const fullGate = evaluatePublication(fullWithoutCoverage);
    expect(fullGate.fullVolumeReady).toBe(false);
    const fullCheck = validatePublication(fullWithoutCoverage);
    expect(fullCheck.ok).toBe(false);
    expect(fullCheck.issues.map((issue) => issue.code)).toContain('FULL_VOLUME_CLAIM_INVALID');
  });

  it('refuses draft and rejected packs at the publication gate', () => {
    for (const status of ['draft', 'rejected'] as const) {
      const pack = withHash({ ...clone(partial), status } as ContentPack);
      const validation = validatePublication(pack);
      expect(validation.ok).toBe(false);
      const registry = new PublishRegistry();
      const published = registry.publish(withCuratorRelease(pack), {
        publishedAt: PUBLISHED_AT,
        actorKind: 'human_curator',
        scopeChecklistSatisfied: true,
      });
      expect(published.ok).toBe(false);
      if (!published.ok) expect(published.error.code).toBe('PACK_INVALID');
    }
  });

  it('publishes once per version and keeps published content immutable', () => {
    const registry = new PublishRegistry();
    const first = registry.publish(withCuratorRelease(clone(full)), {
      publishedAt: PUBLISHED_AT,
      actorKind: 'human_curator',
      scopeChecklistSatisfied: true,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.revision).toBe(1);
    expect(registry.revision).toBe(1);

    const again = registry.publish(withCuratorRelease(clone(full)), {
      publishedAt: PUBLISHED_AT,
      actorKind: 'human_curator',
      scopeChecklistSatisfied: true,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('PACK_ALREADY_PUBLISHED');
      expect(again.error.serviceCode).toBe('CONFLICT');
    }

    const mutable = clone(full);
    const stored = registry.get(full.id, full.version);
    expect(stored).not.toBeNull();
    const originalTitle = stored?.pack.concepts[0]?.title ?? '';
    (mutable.concepts[0] as { title: string }).title = 'mutated after publish';
    expect(registry.get(full.id, full.version)?.pack.concepts[0]?.title).toBe(originalTitle);
    expect(Object.isFrozen(stored?.pack)).toBe(true);
  });

  it('refuses a tampered content hash before publishing', () => {
    const tampered = clone(full);
    (tampered.concepts[0] as { title: string }).title = 'tampered content';
    const registry = new PublishRegistry();
    const published = registry.publish(withCuratorRelease(tampered), {
      publishedAt: PUBLISHED_AT,
      actorKind: 'human_curator',
      scopeChecklistSatisfied: true,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.error.code).toBe('PACK_CONTENT_HASH_MISMATCH');
  });

  it('keeps candidate, machine review and human publication transitions distinct', () => {
    const ai = 'ai_static_reviewer' as const;
    const human = 'human_curator' as const;

    expect(validateReviewTransition({ from: null, to: 'candidate', actorKind: ai }).ok).toBe(true);
    expect(
      validateReviewTransition({ from: 'candidate', to: 'machine_checked', actorKind: ai }).ok,
    ).toBe(true);

    const aiCurator = validateReviewTransition({
      from: 'machine_checked',
      to: 'curator_checked',
      actorKind: ai,
    });
    expect(aiCurator.ok).toBe(false);
    if (!aiCurator.ok) expect(aiCurator.issues.map((issue) => issue.code)).toContain('REVIEW_STATE_INVALID');

    expect(
      validateReviewTransition({
        from: 'machine_checked',
        to: 'curator_checked',
        actorKind: human,
      }).ok,
    ).toBe(true);

    const skipCurator = validateReviewTransition({
      from: 'candidate',
      to: 'published',
      actorKind: human,
      scopeChecklistSatisfied: true,
    });
    expect(skipCurator.ok).toBe(false);
    if (!skipCurator.ok) {
      expect(skipCurator.issues.map((issue) => issue.code)).toContain('REVIEW_TRANSITION_INVALID');
    }

    const missingChecklist = validateReviewTransition({
      from: 'curator_checked',
      to: 'published',
      actorKind: human,
    });
    expect(missingChecklist.ok).toBe(false);
    if (!missingChecklist.ok) {
      expect(missingChecklist.issues.map((issue) => issue.code)).toContain('REVIEW_STATE_INVALID');
    }

    expect(
      validateReviewTransition({
        from: 'curator_checked',
        to: 'published',
        actorKind: human,
        scopeChecklistSatisfied: true,
      }).ok,
    ).toBe(true);

    const rejectWithoutReason = validateReviewTransition({
      from: 'published',
      to: 'rejected',
      actorKind: human,
    });
    expect(rejectWithoutReason.ok).toBe(false);
    expect(
      validateReviewTransition({
        from: 'published',
        to: 'rejected',
        actorKind: human,
        note: 'source mismatch found during review',
      }).ok,
    ).toBe(true);
  });
});

describe('coverage manifest audit', () => {
  const full = readPackFixture('valid-full.json');

  it('accepts a coherent complete ledger', () => {
    const audit = checkCoverageManifest(full);
    expect(audit.ok).toBe(true);
    expect(audit.targetSections).toBe(3);
    expect(audit.sectionEntries).toBe(3);
    expect(audit.coveredSections).toBe(3);
    expect(audit.distinctConceptIds).toBe(3);
    expect(audit.issues).toEqual([]);
  });

  it('rejects totals that disagree with the per chapter entries', () => {
    for (const mutate of [
      (pack: ContentPack) => {
        (pack.coverageManifest.totals as { targetSections: number }).targetSections = 4;
      },
      (pack: ContentPack) => {
        (pack.coverageManifest.totals as { coveredSections: number }).coveredSections = 2;
      },
      (pack: ContentPack) => {
        (pack.coverageManifest.totals as { conceptCount: number }).conceptCount = 9;
      },
    ]) {
      const pack = clone(full);
      mutate(pack);
      const audit = checkCoverageManifest(pack);
      expect(audit.ok).toBe(false);
      expect(audit.issues.map((issue) => issue.code)).toContain('COVERAGE_TOTALS_MISMATCH');
    }
  });

  it('requires one section entry per declared target', () => {
    const pack = clone(full);
    (pack.coverageManifest as { sections: ContentPack['coverageManifest']['sections'] }).sections = pack.coverageManifest.sections.slice(0, 2);
    const audit = checkCoverageManifest(pack);
    expect(audit.ok).toBe(false);
    expect(audit.issues.map((issue) => issue.code)).toContain('COVERAGE_TARGET_MISSING_SECTION');
  });

  it('requires every exclusion to carry a reason and stay unique', () => {
    const blankReason = clone(full);
    (blankReason.coverageManifest as { exclusions: unknown }).exclusions = [
      { item: 'fixture images', reason: '   ', sourceRefs: [] },
    ];
    const blankAudit = checkCoverageManifest(blankReason);
    expect(blankAudit.ok).toBe(false);
    expect(blankAudit.issues.map((issue) => issue.code)).toContain('COVERAGE_EXCLUSION_REASON_MISSING');

    const duplicate = clone(full);
    (duplicate.coverageManifest as { exclusions: unknown }).exclusions = [
      { item: 'fixture images', reason: 'out of scope', sourceRefs: [] },
      { item: 'fixture images', reason: 'listed twice', sourceRefs: [] },
    ];
    const duplicateAudit = checkCoverageManifest(duplicate);
    expect(duplicateAudit.ok).toBe(false);
    expect(duplicateAudit.issues.map((issue) => issue.code)).toContain('COVERAGE_EXCLUSION_DUPLICATE');
  });
});
