import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@edu/domain';
import {
  PublishRegistry,
  validatePublishReviewChain,
  validateReviewTransition,
} from '../src/publication.js';
import { clone, readPackFixture, withCuratorRelease } from './helpers/fixtures.js';

const PUBLISHED_AT = '2026-10-02T09:00:00Z';
const HUMAN_REQUEST = {
  publishedAt: PUBLISHED_AT,
  actorKind: 'human_curator' as const,
  scopeChecklistSatisfied: true,
};

describe('H-03: publishing requires a human curator review chain', () => {
  const full = readPackFixture('valid-full.json');

  it('publishes a pack released through curator_checked -> published by a human', () => {
    const pack = withCuratorRelease(clone(full));
    const chain = validatePublishReviewChain(pack);
    expect(chain.ok).toBe(true);
    if (!chain.ok) return;
    expect(chain.value.transition.from).toBe('curator_checked');
    expect(chain.value.transition.to).toBe('published');
    expect(chain.value.transition.actorKind).toBe('human_curator');
    expect(chain.value.signedEntityIds.length).toBeGreaterThan(0);

    const registry = new PublishRegistry();
    const published = registry.publish(pack, HUMAN_REQUEST);
    expect(published.ok).toBe(true);
    if (published.ok) {
      expect(published.value.pack.id).toBe(full.id);
      expect(published.value.revision).toBe(1);
    }
  });

  it('rejects an AI actorKind publication request', () => {
    const registry = new PublishRegistry();
    const result = registry.publish(withCuratorRelease(clone(full)), {
      ...HUMAN_REQUEST,
      actorKind: 'ai_static_reviewer',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PUBLISH_REQUIRES_CURATOR');
      expect(result.error.serviceCode).toBe('CONTRACT_REJECTED');
      expect(result.error.message).toContain('machine_checked');
    }
    expect(registry.list()).toHaveLength(0);
  });

  it('rejects a pack whose pack-level published entry is signed by AI', () => {
    const pack = withCuratorRelease(clone(full), { packActorKind: 'ai_static_reviewer' });
    const chain = validatePublishReviewChain(pack);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.issues.map((issue) => issue.code)).toContain('PUBLISH_REQUIRES_CURATOR');
    }
    const result = new PublishRegistry().publish(pack, HUMAN_REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PUBLISH_REQUIRES_CURATOR');
  });

  it('rejects AI-signed curator_checked entries even when the pack transition is human', () => {
    const pack = withCuratorRelease(clone(full));
    const aiCuratorEntry: ContentPack['reviewLedger'][number] = {
      schemaVersion: 1,
      id: 'ledger.rework.ai-curator',
      entityKind: 'content_pack',
      entityId: pack.id,
      from: 'machine_checked',
      to: 'curator_checked',
      actorKind: 'ai_static_reviewer',
      actorLabel: 'AI static reviewer',
      checkedAt: '2026-10-02T09:05:00Z',
      scope: 'AI attempt to self-curate',
      notes: null,
      evidenceRefs: [],
    };
    const tampered: ContentPack = { ...pack, reviewLedger: [...pack.reviewLedger, aiCuratorEntry] };
    const chain = validatePublishReviewChain(tampered);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.issues.map((issue) => issue.code)).toContain('PUBLISH_REQUIRES_CURATOR');
    }
    const result = new PublishRegistry().publish(tampered, HUMAN_REQUEST);
    expect(result.ok).toBe(false);
  });

  it('rejects a pack without any published transition record', () => {
    const pack = withCuratorRelease(clone(full), { packTo: 'machine_checked' });
    const chain = validatePublishReviewChain(pack);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.issues.map((issue) => issue.code)).toContain('PUBLISH_REQUIRES_CURATOR');
    }
    const result = new PublishRegistry().publish(pack, HUMAN_REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PUBLISH_REQUIRES_CURATOR');
  });

  it('rejects a machine_checked -> published shortcut without curator_checked', () => {
    const pack = withCuratorRelease(clone(full), { packFrom: 'machine_checked' });
    const chain = validatePublishReviewChain(pack);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.issues.map((issue) => issue.message).join(' ')).toContain('curator_checked');
    }
  });

  it('rejects a pack whose reviewed entities lack human records', () => {
    const pack = withCuratorRelease(clone(full), { includeEntityEntries: false });
    const chain = validatePublishReviewChain(pack);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      const curatorIssues = chain.issues.filter((issue) => issue.code === 'PUBLISH_REQUIRES_CURATOR');
      expect(curatorIssues.length).toBe(full.concepts.length + full.relations.length + full.rubrics.length);
    }
  });

  it('rejects AI-signed entity records even if the pack entry is human', () => {
    const pack = withCuratorRelease(clone(full), { entityActorKind: 'ai_static_reviewer' });
    const chain = validatePublishReviewChain(pack);
    expect(chain.ok).toBe(false);
  });

  it('requires the declared scope checklist to be explicitly satisfied', () => {
    const result = new PublishRegistry().publish(withCuratorRelease(clone(full)), {
      ...HUMAN_REQUEST,
      scopeChecklistSatisfied: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REVIEW_TRANSITION_INVALID');
  });

  it('rejects scope/coverage inconsistencies before any publication', () => {
    const cases = [
      ['invalid-partial-complete.json', 'PACK_SCOPE_INVALID'],
      ['invalid-full-partial.json', 'FULL_VOLUME_CLAIM_INVALID'],
    ] as const;
    for (const [fixture, issueCode] of cases) {
      const result = new PublishRegistry().publish(readPackFixture(fixture), HUMAN_REQUEST);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PACK_INVALID');
        expect((result.error.issues ?? []).map((issue) => issue.code)).toContain(issueCode);
      }
    }
  });

  it('keeps validateReviewTransition refusing to publish without human + checklist', () => {
    const ai = validateReviewTransition({
      from: 'curator_checked',
      to: 'published',
      actorKind: 'ai_static_reviewer',
      scopeChecklistSatisfied: true,
    });
    expect(ai.ok).toBe(false);
    const missingChecklist = validateReviewTransition({
      from: 'curator_checked',
      to: 'published',
      actorKind: 'human_curator',
    });
    expect(missingChecklist.ok).toBe(false);
    const ok = validateReviewTransition({
      from: 'curator_checked',
      to: 'published',
      actorKind: 'human_curator',
      scopeChecklistSatisfied: true,
    });
    expect(ok.ok).toBe(true);
  });
});
