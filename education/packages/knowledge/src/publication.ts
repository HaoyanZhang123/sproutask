/**
 * Content publication rules (05 §4, §9; A07/A28 contributions).
 *
 * Three separation levels are never collapsed:
 * - `candidate` content is only usable in explicit candidate trust mode, has no
 *   strong claims and never counts towards full volume coverage.
 * - `machine_checked` is an AI/system review step; it may not become
 *   `curator_checked` or `published` without a human curator.
 * - `published` is immutable per (id, version): a second publish of the same
 *   version is refused, and a new version must change the content hash.
 *
 * Publication is also where scope honesty lives: `scope=partial` may publish
 * inside its declared scope (first section milestone) but can never claim
 * full volume readiness; only `full_volume` + `coverageStatus=complete` may.
 */

import {
  validateContentPack,
  validateContentPackUpdate,
  type ActorKind,
  type ContentPack,
  type PackStatus,
  type ReviewLedgerEntry,
  type ReviewState,
  type Timestamp,
} from '@edu/domain';
import {
  failBuild,
  failValue,
  issuesFromDomain,
  knowledgeError,
  knowledgeIssue,
  okBuild,
  okValue,
  type BuildResult,
  type KnowledgeIssue,
  type KnowledgeResult,
} from './knowledge-errors.js';
import { checkCoverageManifest, type CoverageAudit } from './coverage.js';
import { contentHashMatches } from './content-hash.js';

export type PackPublicationLabel =
  | 'draft'
  | 'candidate'
  | 'rejected'
  | 'published_partial'
  | 'published_full_volume';

export interface PublicationGate {
  readonly packId: string;
  readonly version: string;
  readonly status: PackStatus;
  readonly scope: ContentPack['scope'];
  readonly coverageStatus: ContentPack['coverageStatus'];
  readonly label: PackPublicationLabel;
  /** Candidate content is only usable when the user explicitly opts in. */
  readonly candidateUsableExplicitly: boolean;
  /** Strong understanding claims are allowed for published content only. */
  readonly strongClaimsAllowed: boolean;
  /** First section milestone: published content inside its declared scope. */
  readonly g1Eligible: boolean;
  /** Full volume milestone: published + full_volume + complete coverage. */
  readonly fullVolumeReady: boolean;
  readonly reasons: readonly string[];
}

export function evaluatePublication(pack: ContentPack): PublicationGate {
  const reasons: string[] = [];
  const isPublished = pack.status === 'published';
  const isFullVolumeClaim = pack.scope === 'full_volume' && pack.coverageStatus === 'complete';
  let label: PackPublicationLabel;
  if (pack.status === 'published') {
    label = isFullVolumeClaim ? 'published_full_volume' : 'published_partial';
  } else if (pack.status === 'candidate') {
    label = 'candidate';
  } else {
    label = pack.status;
  }
  if (!isPublished) {
    reasons.push(`status ${pack.status} content is not published and cannot back formal learning`);
  }
  if (pack.status === 'candidate') {
    reasons.push('candidate content is usable only in explicit candidate trust mode with strong claims disabled');
  }
  if (isPublished && pack.scope === 'partial') {
    reasons.push('partial scope unlocks first section acceptance only; the full volume milestone stays unmet');
  }
  if (isPublished && pack.scope === 'full_volume' && pack.coverageStatus !== 'complete') {
    reasons.push('a full volume pack requires coverageStatus=complete');
  }
  return {
    packId: pack.id,
    version: pack.version,
    status: pack.status,
    scope: pack.scope,
    coverageStatus: pack.coverageStatus,
    label,
    candidateUsableExplicitly: pack.status === 'candidate',
    strongClaimsAllowed: isPublished,
    g1Eligible: isPublished,
    fullVolumeReady: isPublished && isFullVolumeClaim,
    reasons,
  };
}

export interface PublicationValidation {
  readonly ok: boolean;
  readonly gate: PublicationGate;
  readonly coverage: CoverageAudit;
  readonly issues: readonly KnowledgeIssue[];
}

/** Full publication gate: frozen pack rules + T04 scope honesty + coverage. */
export function validatePublication(pack: ContentPack): PublicationValidation {
  const issues: KnowledgeIssue[] = [];
  const validated = validateContentPack(pack);
  if (!validated.ok) issues.push(...issuesFromDomain(validated.issues));
  const coverage = checkCoverageManifest(pack);
  issues.push(...coverage.issues);

  if (pack.status !== 'published') {
    issues.push(
      knowledgeIssue(
        'REVIEW_STATE_INVALID',
        '$.status',
        'only a published pack can pass the publication gate',
      ),
    );
  }
  if (pack.status === 'published') {
    if (pack.scope === 'partial' && pack.coverageStatus === 'complete') {
      issues.push(
        knowledgeIssue(
          'PACK_SCOPE_INVALID',
          '$.coverageStatus',
          'a published partial pack must keep coverageStatus=partial',
        ),
      );
    }
    if (pack.scope === 'full_volume' && pack.coverageStatus !== 'complete') {
      issues.push(
        knowledgeIssue(
          'FULL_VOLUME_CLAIM_INVALID',
          '$.coverageStatus',
          'full volume marking requires scope=full_volume and coverageStatus=complete',
        ),
      );
    }
  }
  return {
    ok: issues.length === 0,
    gate: evaluatePublication(pack),
    coverage,
    issues,
  };
}

export interface ReviewTransitionRequest {
  readonly from: ReviewState | null;
  readonly to: ReviewState;
  readonly actorKind: ActorKind;
  /** Must be true when promoting to published (declared scope checklist). */
  readonly scopeChecklistSatisfied?: boolean;
  /** Required when rejecting content. */
  readonly note?: string;
}

export interface ReviewTransitionResult {
  readonly from: ReviewState | null;
  readonly to: ReviewState;
  readonly actorKind: ActorKind;
  readonly requiresHumanCurator: boolean;
}

const ALLOWED_TRANSITIONS: Record<ReviewState | 'none', readonly ReviewState[]> = {
  none: ['candidate'],
  candidate: ['machine_checked', 'rejected'],
  machine_checked: ['curator_checked', 'published', 'rejected'],
  curator_checked: ['published', 'rejected'],
  published: ['rejected'],
  rejected: ['candidate'],
};

/**
 * Review state machine. AI can move content to `machine_checked`; only a human
 * curator may declare `curator_checked` or `published`, and publication needs
 * the explicit scope checklist flag instead of an implied "ok".
 */
export function validateReviewTransition(
  request: ReviewTransitionRequest,
): BuildResult<ReviewTransitionResult> {
  const issues: KnowledgeIssue[] = [];
  const allowed = ALLOWED_TRANSITIONS[request.from ?? 'none'];
  if (!allowed.includes(request.to)) {
    issues.push(
      knowledgeIssue(
        'REVIEW_TRANSITION_INVALID',
        '$.to',
        `transition ${request.from ?? 'none'} -> ${request.to} is not allowed`,
      ),
    );
  }
  if (request.to === 'curator_checked' && request.actorKind !== 'human_curator') {
    issues.push(
      knowledgeIssue(
        'REVIEW_STATE_INVALID',
        '$.actorKind',
        'curator_checked requires a human curator; AI review must stay machine_checked',
      ),
    );
  }
  if (request.to === 'published') {
    if (request.actorKind !== 'human_curator') {
      issues.push(
        knowledgeIssue(
          'REVIEW_STATE_INVALID',
          '$.actorKind',
          'publishing content requires a human curator decision',
        ),
      );
    }
    if (request.scopeChecklistSatisfied !== true) {
      issues.push(
        knowledgeIssue(
          'REVIEW_STATE_INVALID',
          '$.scopeChecklistSatisfied',
          'publishing requires the declared scope content acceptance checklist to pass',
        ),
      );
    }
  }
  if (request.to === 'rejected' && (request.note ?? '').trim().length === 0) {
    issues.push(
      knowledgeIssue('REVIEW_STATE_INVALID', '$.note', 'rejecting content requires a recorded reason'),
    );
  }
  if (issues.length > 0) return failBuild(issues);
  return okBuild({
    from: request.from,
    to: request.to,
    actorKind: request.actorKind,
    requiresHumanCurator: request.to === 'curator_checked' || request.to === 'published',
  });
}

/**
 * H-03 publish gate: only a human curator may release content.
 *
 * Rules enforced here (the registry calls this before writing anything):
 * - no AI/system actor may ever sign `curator_checked` or `published`;
 * - the pack needs a `curator_checked -> published` ledger transition signed by
 *   a `human_curator` (a `machine_checked -> published` shortcut is refused);
 * - every concept/relation/rubric that claims a reviewed state needs its own
 *   human curator record, so flipping `reviewState` in JSON is not enough.
 */
export interface PublishReviewChain {
  readonly packEntry: ReviewLedgerEntry;
  readonly transition: ReviewTransitionResult;
  readonly signedEntityIds: readonly string[];
}

const REVIEWED_ENTITY_STATES: ReadonlySet<ReviewState> = new Set<ReviewState>([
  'curator_checked',
  'published',
]);

function reviewedEntities(pack: ContentPack): readonly {
  readonly id: string;
  readonly kind: 'concept' | 'relation' | 'rubric';
  readonly reviewState: ReviewState;
}[] {
  const entities: { id: string; kind: 'concept' | 'relation' | 'rubric'; reviewState: ReviewState }[] = [];
  for (const concept of pack.concepts) {
    if (REVIEWED_ENTITY_STATES.has(concept.reviewState)) {
      entities.push({ id: concept.id, kind: 'concept', reviewState: concept.reviewState });
    }
  }
  for (const relation of pack.relations) {
    if (REVIEWED_ENTITY_STATES.has(relation.reviewState)) {
      entities.push({ id: relation.id, kind: 'relation', reviewState: relation.reviewState });
    }
  }
  for (const rubric of pack.rubrics) {
    if (REVIEWED_ENTITY_STATES.has(rubric.reviewState)) {
      entities.push({ id: rubric.id, kind: 'rubric', reviewState: rubric.reviewState });
    }
  }
  return entities;
}

/** Validates the human curator review chain of a pack that claims to be published. */
export function validatePublishReviewChain(pack: ContentPack): BuildResult<PublishReviewChain> {
  const issues: KnowledgeIssue[] = [];
  const aiSigned = pack.reviewLedger.filter(
    (entry) =>
      (entry.to === 'curator_checked' || entry.to === 'published') &&
      entry.actorKind !== 'human_curator',
  );
  if (aiSigned.length > 0) {
    issues.push(
      knowledgeIssue(
        'PUBLISH_REQUIRES_CURATOR',
        '$.reviewLedger',
        `AI/system review entries cannot claim curator_checked or published (found ${aiSigned.length})`,
      ),
    );
  }

  const packEntries = pack.reviewLedger.filter(
    (entry) =>
      entry.entityKind === 'content_pack' && entry.entityId === pack.id && entry.to === 'published',
  );
  const packEntry = packEntries[packEntries.length - 1];
  let transition: ReviewTransitionResult | null = null;
  if (packEntry === undefined) {
    issues.push(
      knowledgeIssue(
        'PUBLISH_REQUIRES_CURATOR',
        '$.reviewLedger',
        'publishing requires a content_pack review ledger entry to published',
      ),
    );
  } else {
    if (packEntry.actorKind !== 'human_curator') {
      issues.push(
        knowledgeIssue(
          'PUBLISH_REQUIRES_CURATOR',
          '$.reviewLedger',
          'publishing requires actorKind=human_curator on the pack transition',
        ),
      );
    }
    if (packEntry.from !== 'curator_checked') {
      issues.push(
        knowledgeIssue(
          'PUBLISH_REQUIRES_CURATOR',
          '$.reviewLedger',
          'publishing requires a curator_checked -> published transition (from=curator_checked)',
        ),
      );
    }
    const checked = validateReviewTransition({
      from: packEntry.from,
      to: 'published',
      actorKind: packEntry.actorKind,
      scopeChecklistSatisfied: true,
      note: packEntry.notes ?? undefined,
    });
    if (!checked.ok) issues.push(...checked.issues);
    else transition = checked.value;
  }

  const signedEntityIds: string[] = [];
  for (const entity of reviewedEntities(pack)) {
    const humanRecords = pack.reviewLedger.filter(
      (entry) =>
        entry.entityId === entity.id &&
        entry.actorKind === 'human_curator' &&
        (entry.to === 'published' || entry.to === 'curator_checked'),
    );
    if (humanRecords.length === 0) {
      issues.push(
        knowledgeIssue(
          'PUBLISH_REQUIRES_CURATOR',
          `$.reviewLedger.${entity.id}`,
          `${entity.kind} ${entity.id} claims ${entity.reviewState} without a human curator record`,
        ),
      );
    } else {
      signedEntityIds.push(entity.id);
    }
  }

  if (issues.length > 0 || transition === null) {
    return failBuild(
      issues.length > 0
        ? issues
        : [
            knowledgeIssue(
              'PUBLISH_REQUIRES_CURATOR',
              '$.reviewLedger',
              'missing a legal curator_checked -> published transition',
            ),
          ],
    );
  }
  return okBuild({ packEntry, transition, signedEntityIds });
}

export interface PublishedPackRecord {
  /** Deep frozen copy; callers can never mutate published content in place. */
  readonly pack: ContentPack;
  readonly publishedAt: Timestamp;
  readonly revision: number;
  readonly contentHash: string;
}

export interface PublishRequest {
  /** Injected time (no wall clock in the service layer). */
  readonly publishedAt: Timestamp;
  /**
   * Who performs the publication decision. Only `human_curator` may publish;
   * AI/system review may only reach `machine_checked` (H-03).
   */
  readonly actorKind: ActorKind;
  /** The declared scope acceptance checklist must be explicitly satisfied. */
  readonly scopeChecklistSatisfied: boolean;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    const record = value as unknown as Record<string, unknown>;
    for (const key of Object.keys(record)) deepFreeze(record[key]);
    Object.freeze(value);
  }
  return value;
}

/**
 * Append only publication registry. Storage owner (T02) can back this with the
 * journal later; T04 owns the rules, not the persistence.
 */
export class PublishRegistry {
  private readonly records: PublishedPackRecord[] = [];
  private counter = 0;

  get revision(): number {
    return this.counter;
  }

  list(): readonly PublishedPackRecord[] {
    return this.records;
  }

  latest(packId: string): PublishedPackRecord | null {
    let found: PublishedPackRecord | null = null;
    for (const record of this.records) {
      if (record.pack.id === packId) found = record;
    }
    return found;
  }

  get(packId: string, version: string): PublishedPackRecord | null {
    return (
      this.records.find((record) => record.pack.id === packId && record.pack.version === version) ?? null
    );
  }

  publish(pack: ContentPack, request: PublishRequest): KnowledgeResult<PublishedPackRecord> {
    const validation = validatePublication(pack);
    if (!validation.ok) {
      return failValue(
        knowledgeError('PACK_INVALID', 'pack does not satisfy the publication gate', {
          issues: validation.issues,
        }),
      );
    }
    if (!contentHashMatches(pack)) {
      return failValue(
        knowledgeError(
          'PACK_CONTENT_HASH_MISMATCH',
          'declared contentHash does not match the canonical content; recompute before publishing',
          { path: '$.contentHash' },
        ),
      );
    }
    const reviewChain = validatePublishReviewChain(pack);
    if (!reviewChain.ok) {
      return failValue(
        knowledgeError(
          'PUBLISH_REQUIRES_CURATOR',
          'publishing requires a human curator review chain; AI review cannot publish content',
          { issues: reviewChain.issues },
        ),
      );
    }
    if (request.actorKind !== 'human_curator') {
      return failValue(
        knowledgeError(
          'PUBLISH_REQUIRES_CURATOR',
          'publishing requires actorKind=human_curator; AI review may only reach machine_checked',
          { path: '$.actorKind' },
        ),
      );
    }
    if (request.scopeChecklistSatisfied !== true) {
      return failValue(
        knowledgeError(
          'REVIEW_TRANSITION_INVALID',
          'publishing requires the declared scope acceptance checklist to be satisfied',
          { path: '$.scopeChecklistSatisfied' },
        ),
      );
    }
    if (this.get(pack.id, pack.version) !== null) {
      return failValue(
        knowledgeError(
          'PACK_ALREADY_PUBLISHED',
          `${pack.id}@${pack.version} is already published; publish a new version instead`,
          { path: '$.version' },
        ),
      );
    }
    const previous = this.latest(pack.id);
    if (previous !== null) {
      const update = validateContentPackUpdate(previous.pack, pack);
      if (!update.ok) {
        return failValue(
          knowledgeError('PACK_IMMUTABLE', 'published pack content may not be rewritten in place', {
            issues: issuesFromDomain(update.issues),
          }),
        );
      }
    }
    const frozen = deepFreeze(structuredClone(pack));
    this.counter += 1;
    const record: PublishedPackRecord = {
      pack: frozen,
      publishedAt: request.publishedAt,
      revision: this.counter,
      contentHash: pack.contentHash,
    };
    this.records.push(record);
    return okValue(record);
  }
}
