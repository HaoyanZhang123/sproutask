/**
 * Test harness: every learner test runs against a real @edu/storage journal in
 * an isolated temp directory. There is no in-memory storage fake.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  ActivityAttempt,
  Clock,
  CompatibilityMap,
  ConceptMapping,
  Evidence,
  IdGenerator,
  RequestContext,
  SelfReport,
  ServiceResult,
  Session,
} from '@edu/domain';
import { StorageService } from '@edu/storage';
import { LearnerService } from '../src/learner-service.js';
import { createReviewPolicy, type ReviewPolicy } from '../src/policy.js';

export const LEARNER_ID = 'learner-t06';
export const COURSE_EDITION_ID = 'edition-biology-7a-2024';
export const PACK_VERSION = 'pack-bio-7a-2026.1';
export const PACK_VERSION_V2 = 'pack-bio-7a-2026.2';
export const CONCEPT_CELL = 'concept-cell-unit';
export const CONCEPT_ORGAN = 'concept-organ-system';
export const CONCEPT_TISSUE = 'concept-tissue';
export const CONCEPT_ENERGY = 'concept-energy-flow';

export interface TestClock extends Clock {
  set(timestamp: string): void;
  advance(ms: number): void;
}

export interface TestIds extends IdGenerator {
  count(): number;
}

export function testClock(start: string): TestClock {
  let current = start;
  return {
    now: () => current,
    set: (timestamp: string) => {
      current = timestamp;
    },
    advance: (ms: number) => {
      current = new Date(Date.parse(current) + ms).toISOString().replace('.000Z', 'Z');
    },
  };
}

export function testIds(): TestIds {
  let counter = 0;
  return {
    next(prefix: string) {
      counter += 1;
      return `${prefix}-t06-${counter}`;
    },
    count() {
      return counter;
    },
  };
}

export interface HarnessOptions {
  readonly policy?: ReviewPolicy;
  readonly learnerId?: string;
  readonly start?: string;
}

export class LearnerHarness {
  readonly clock: TestClock;
  readonly ids: TestIds;
  storage!: StorageService;
  learner!: LearnerService;
  private readonly policy: ReviewPolicy;
  private readonly learnerId: string;

  private constructor(
    readonly root: string,
    clock: TestClock,
    ids: TestIds,
    policy: ReviewPolicy,
    learnerId: string,
  ) {
    this.clock = clock;
    this.ids = ids;
    this.policy = policy;
    this.learnerId = learnerId;
  }

  static async create(options: HarnessOptions = {}): Promise<LearnerHarness> {
    const root = mkdtempSync(path.join(os.tmpdir(), 'edu-t06-'));
    const clock = testClock(options.start ?? '2026-10-29T00:00:00Z');
    const ids = testIds();
    const policy = options.policy ?? createReviewPolicy({ timeZone: 'Asia/Shanghai' });
    const harness = new LearnerHarness(
      root,
      clock,
      ids,
      policy,
      options.learnerId ?? LEARNER_ID,
    );
    await harness.open();
    return harness;
  }

  private async open(): Promise<void> {
    const storage = await StorageService.open({ root: this.root, clock: this.clock, ids: this.ids });
    if (!storage.ok) throw new Error(`storage open failed: ${storage.error.code} ${storage.error.message}`);
    this.storage = storage.data;
    const learner = await LearnerService.open({
      storage: this.storage,
      clock: this.clock,
      ids: this.ids,
      learnerId: this.learnerId,
      policy: this.policy,
    });
    if (!learner.ok) throw new Error(`learner open failed: ${learner.error.code} ${learner.error.message}`);
    this.learner = learner.data;
  }

  /** Close and reopen both services on the same real journal (replay check). */
  async reopen(): Promise<void> {
    this.storage.close();
    await this.open();
  }

  journalPath(): string {
    return path.join(this.root, 'journal', 'events.jsonl');
  }

  journalLines(): string[] {
    return readFileSync(this.journalPath(), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
  }

  journalCommands(): Array<Record<string, unknown>> {
    return this.journalLines().map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  cleanup(): void {
    try {
      this.storage.close();
    } catch {
      // already closed
    }
    rmSync(this.root, { recursive: true, force: true });
  }
}

let requestCounter = 0;

export function requestContext(
  harness: LearnerHarness,
  requestId?: string,
  now?: string,
): RequestContext {
  requestCounter += 1;
  return {
    requestId: requestId ?? `req-${requestCounter}`,
    learnerId: LEARNER_ID,
    now: now ?? harness.clock.now(),
  };
}

export function expectOk<T>(result: ServiceResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  }
  return result.data;
}

export function expectError<T>(result: ServiceResult<T>): { code: string; message: string } {
  if (result.ok) throw new Error('expected an error result');
  return result.error;
}

let sessionCounter = 0;
let attemptCounter = 0;
let evidenceCounter = 0;
let reportCounter = 0;

export interface SessionOverrides {
  readonly id?: string;
  readonly learnerId?: string;
  readonly courseEditionId?: string;
  readonly packVersion?: string;
  readonly trustMode?: Session['trustMode'];
  readonly conceptId?: string;
  readonly mode?: Session['mode'];
  readonly status?: Session['status'];
  readonly startedAt?: string;
  readonly endedAt?: string | null;
  readonly dshSessionId?: string | null;
}

export function makeSession(overrides: SessionOverrides = {}): Session {
  sessionCounter += 1;
  const status = overrides.status ?? 'active';
  const startedAt = overrides.startedAt ?? '2026-10-29T01:00:00Z';
  return {
    schemaVersion: 1,
    id: overrides.id ?? `session-${sessionCounter}`,
    learnerId: overrides.learnerId ?? LEARNER_ID,
    courseEditionId: overrides.courseEditionId ?? COURSE_EDITION_ID,
    packVersion: overrides.packVersion ?? PACK_VERSION,
    trustMode: overrides.trustMode ?? 'published',
    conceptId: overrides.conceptId ?? CONCEPT_CELL,
    mode: overrides.mode ?? 'learn',
    status,
    startedAt,
    endedAt:
      overrides.endedAt !== undefined
        ? overrides.endedAt
        : status === 'active'
          ? null
          : '2026-10-29T01:30:00Z',
    resumeCursor: { activityId: null, cursor: null },
    dshSessionId: overrides.dshSessionId ?? null,
  };
}

export interface AttemptOverrides {
  readonly id?: string;
  readonly requestId?: string;
  readonly learnerId?: string;
  readonly sessionId?: string;
  readonly courseEditionId?: string;
  readonly packVersion?: string;
  readonly activityId?: string;
  readonly activityVersion?: string;
  readonly conceptIds?: readonly string[];
  readonly inputType?: ActivityAttempt['inputType'];
  readonly answerText?: string | null;
  readonly submittedAt?: string;
  readonly helpUsed?: ActivityAttempt['helpUsed'];
}

export function makeAttempt(overrides: AttemptOverrides = {}): ActivityAttempt {
  attemptCounter += 1;
  return {
    schemaVersion: 1,
    id: overrides.id ?? `attempt-${attemptCounter}`,
    requestId: overrides.requestId ?? `attempt-req-${attemptCounter}`,
    learnerId: overrides.learnerId ?? LEARNER_ID,
    sessionId: overrides.sessionId ?? 'session-unknown',
    courseEditionId: overrides.courseEditionId ?? COURSE_EDITION_ID,
    packVersion: overrides.packVersion ?? PACK_VERSION,
    activityId: overrides.activityId ?? 'activity-cell-explain',
    activityVersion: overrides.activityVersion ?? 'activity-v1',
    conceptIds: overrides.conceptIds ?? [CONCEPT_CELL],
    inputType: overrides.inputType ?? 'text',
    answerAssetId: null,
    answerText: overrides.answerText ?? 'A cell is the basic unit of life.',
    submittedAt: overrides.submittedAt ?? '2026-10-29T01:05:00Z',
    helpUsed: overrides.helpUsed ?? [],
    evidenceIds: [],
  };
}

export interface EvidenceOverrides {
  readonly id?: string;
  readonly attemptId?: string;
  readonly learnerId?: string;
  readonly courseEditionId?: string;
  readonly packVersion?: string;
  readonly conceptId?: string;
  readonly kind?: Evidence['kind'];
  readonly observation?: string;
  readonly criterionResults?: Evidence['criterionResults'];
  readonly assistance?: Evidence['assistance'];
  readonly assessmentOrigin?: Evidence['assessmentOrigin'];
  readonly modelRunId?: string | null;
  readonly uncertainty?: number | null;
  readonly validity?: Evidence['validity'];
  readonly createdAt?: string;
}

export function makeEvidence(overrides: EvidenceOverrides = {}): Evidence {
  evidenceCounter += 1;
  return {
    schemaVersion: 1,
    id: overrides.id ?? `evidence-${evidenceCounter}`,
    attemptId: overrides.attemptId ?? 'attempt-unknown',
    learnerId: overrides.learnerId ?? LEARNER_ID,
    courseEditionId: overrides.courseEditionId ?? COURSE_EDITION_ID,
    packVersion: overrides.packVersion ?? PACK_VERSION,
    conceptId: overrides.conceptId ?? CONCEPT_CELL,
    kind: overrides.kind ?? 'explain',
    observation: overrides.observation ?? 'Student explains that cells are the basic unit.',
    criterionResults:
      overrides.criterionResults ?? [
        { criterionId: 'criterion-explain', result: 'met', note: null },
      ],
    assistance: overrides.assistance ?? 'unassisted',
    sourceRefs: [],
    assessmentOrigin: overrides.assessmentOrigin ?? 'rule',
    modelRunId: overrides.modelRunId ?? null,
    uncertainty: overrides.uncertainty ?? null,
    validity: overrides.validity ?? 'current',
    createdAt: overrides.createdAt ?? '2026-10-29T01:06:00Z',
  };
}

export function makeSelfReport(
  overrides: Partial<SelfReport> & { id?: string; conceptId?: string; claimedState?: SelfReport['claimedState'] } = {},
): SelfReport {
  reportCounter += 1;
  return {
    schemaVersion: 1,
    id: overrides.id ?? `report-${reportCounter}`,
    learnerId: overrides.learnerId ?? LEARNER_ID,
    courseEditionId: overrides.courseEditionId ?? COURSE_EDITION_ID,
    packVersion: overrides.packVersion ?? PACK_VERSION,
    conceptId: overrides.conceptId ?? CONCEPT_CELL,
    claimedState: overrides.claimedState ?? 'can_explain',
    createdAt: overrides.createdAt ?? '2026-10-29T01:07:00Z',
  };
}

export interface MappingOverrides {
  readonly fromConceptId?: string | null;
  readonly toConceptIds?: readonly string[];
  readonly kind?: ConceptMapping['kind'];
  readonly evidenceEffect?: ConceptMapping['evidenceEffect'];
  readonly verified?: boolean;
  readonly rationale?: string;
}

export function conceptMapping(overrides: MappingOverrides = {}): ConceptMapping {
  const verified = overrides.verified ?? true;
  return {
    fromConceptId:
      overrides.fromConceptId !== undefined ? overrides.fromConceptId : CONCEPT_CELL,
    toConceptIds: overrides.toConceptIds ?? [CONCEPT_CELL],
    kind: overrides.kind ?? 'unchanged',
    rationale: overrides.rationale ?? 'Source and learning objectives unchanged for this test map.',
    review: {
      verified,
      actorKind: verified ? 'human_curator' : null,
      checkedAt: verified ? '2026-11-01T00:00:00Z' : null,
      notes: verified ? 'reviewed in T06 synthetic compatibility test' : null,
    },
    evidenceEffect: overrides.evidenceEffect ?? 'inherit',
  };
}

export function makeCompatibilityMap(options: {
  readonly id?: string;
  readonly mappings: readonly ConceptMapping[];
  readonly from?: string;
  readonly to?: string;
  readonly fromContentHash?: string;
  readonly toContentHash?: string;
}): CompatibilityMap {
  return {
    schemaVersion: 1,
    id: options.id ?? `compat-map-${options.to ?? PACK_VERSION_V2}`,
    courseEditionId: COURSE_EDITION_ID,
    fromPackVersion: options.from ?? PACK_VERSION,
    toPackVersion: options.to ?? PACK_VERSION_V2,
    fromContentHash: options.fromContentHash ?? 'a'.repeat(64),
    toContentHash: options.toContentHash ?? 'b'.repeat(64),
    mappings: [...options.mappings],
    createdAt: '2026-11-01T00:00:00Z',
  };
}
