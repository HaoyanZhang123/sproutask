/**
 * Pure learner projection reducer.
 *
 * The journal is authoritative (05 §7): every projection below is produced by
 * folding journal commands, never by UI writes. The same reducer is used for
 * live updates and for a fresh replay, which is what makes "live projection ==
 * replayed projection" testable field by field.
 */

import type {
  ActivityAttempt,
  Assessment,
  CompatibilityMap,
  ConceptProgress,
  Evidence,
  EvidenceEffect,
  Id,
  JournalCommand,
  ReviewOutcome,
  SelfReport,
  Session,
  Timestamp,
  TrustMode,
  Validity,
} from '@edu/domain';
import {
  isOpaqueId,
  isValidRfc3339Utc,
  progressKey,
  validateActivityAttempt,
  validateAssessment,
  validateCompatibilityMap,
  validateConceptProgress,
  validateEvidence,
  validateSelfReport,
  validateSession,
} from '@edu/domain';

export const REVIEW_POLICY_NOTE =
  'product heuristic only; evidence is explainable, not a validated memory or mastery model';

export const LEARNER_COMMAND_TYPES = {
  sessionStarted: 'session.started',
  sessionEnded: 'session.ended',
  learningCompleted: 'learning.completed',
  reviewCompleted: 'review.completed',
  reviewDeferred: 'review.deferred',
  evidenceRecorded: 'evidence.recorded',
  evidenceStaled: 'evidence.staled',
  selfReportRecorded: 'self_report.recorded',
  scopeDeclared: 'scope.declared',
  diagnosticCompleted: 'diagnostic.completed',
  compatibilityApplied: 'compatibility.applied',
  attemptSubmitted: 'attempt.submitted',
  assessmentCommitted: 'assessment.committed',
  assessmentFailed: 'assessment.failed',
  assessmentCancelled: 'assessment.cancelled',
} as const;

export interface SessionStartedPayload {
  readonly session: Session;
}

export interface SessionEndedPayload {
  readonly sessionId: Id;
  readonly status: 'completed' | 'abandoned';
  readonly endedAt: Timestamp;
}

export interface LearningCompletedPayload {
  readonly sessionId: Id;
  readonly conceptId: Id;
  readonly completedAt: Timestamp;
  readonly dueAt: Timestamp;
  readonly policyVersion: string;
  readonly trustMode?: TrustMode;
}

export interface ReviewCompletedPayload {
  readonly sessionId: Id;
  readonly conceptId: Id;
  readonly outcome: ReviewOutcome;
  readonly completedAt: Timestamp;
  readonly early: boolean;
  readonly previousDueAt: Timestamp | null;
  readonly dueAt: Timestamp;
  readonly policyVersion: string;
}

export interface ReviewDeferredPayload {
  readonly conceptId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly previousDueAt: Timestamp;
  readonly newDueAt: Timestamp;
  readonly deferredAt: Timestamp;
  readonly reason: string;
  readonly policyVersion: string;
}

export interface EvidenceRecordedPayload {
  readonly evidence: readonly Evidence[];
  readonly coreMisconceptionEvidenceIds?: readonly Id[];
  readonly answerDisclosedEvidenceIds?: readonly Id[];
  readonly trustMode?: TrustMode;
}

export interface EvidenceStaledPayload {
  readonly conceptId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly assessmentIds: readonly Id[];
  readonly evidenceIds: readonly Id[];
  readonly staledAt: Timestamp;
  readonly reason: string;
  readonly policyVersion: string;
}

export interface ScopeDeclaredPayload {
  readonly conceptIds: readonly Id[];
  readonly declaredAt: Timestamp;
  readonly source: 'first_use';
}

export interface DiagnosticCompletedPayload {
  readonly sessionId: Id;
  readonly testedConceptIds: readonly Id[];
  readonly skipped: boolean;
  readonly completedAt: Timestamp;
}

export interface CompatibilityEvidenceEffect {
  readonly conceptId: Id;
  readonly packVersion: string;
  readonly effect: EvidenceEffect;
  readonly reason: string;
}

export interface CompatibilityAppliedPayload {
  readonly map: CompatibilityMap;
  readonly newEntries: readonly ConceptProgress[];
  readonly evidenceEffects: readonly CompatibilityEvidenceEffect[];
  readonly inheritedConceptIds: readonly Id[];
  readonly createdAt: Timestamp;
}

export interface EffectiveEvidence {
  readonly evidence: Evidence;
  readonly validity: Validity;
  readonly staledAt: Timestamp | null;
  readonly coreMisconception: boolean;
  readonly answerDisclosed: boolean;
}

export interface EffectiveAssessment {
  readonly assessment: Assessment;
  readonly validity: Validity;
  readonly staledAt: Timestamp | null;
}

export interface ReviewHistoryEntry {
  readonly kind: 'completed' | 'deferred';
  readonly at: Timestamp;
  readonly dueAt: Timestamp;
  readonly previousDueAt: Timestamp | null;
  readonly outcome: ReviewOutcome | null;
  readonly early: boolean;
  readonly reason: string;
}

export interface StaleRecord {
  readonly staledAt: Timestamp;
  readonly reason: string;
  readonly assessmentIds: readonly Id[];
  readonly evidenceIds: readonly Id[];
}

export interface ConceptEntry {
  progress: ConceptProgress;
  assessments: EffectiveAssessment[];
  evidence: EffectiveEvidence[];
  reviewHistory: ReviewHistoryEntry[];
  staleHistory: StaleRecord[];
  deferralDueAt: Timestamp | null;
  historyInherited: boolean;
  trustModeSeen: Set<TrustMode>;
  lastStaledAt: Timestamp | null;
}

export interface ScopeDeclaration {
  readonly conceptIds: readonly Id[];
  readonly declaredAt: Timestamp;
  readonly source: 'first_use';
}

export interface DiagnosticRecord {
  readonly sessionId: Id;
  readonly testedConceptIds: readonly Id[];
  readonly skipped: boolean;
  readonly completedAt: Timestamp;
}

export interface AppliedCompatibility {
  readonly mapId: Id;
  readonly fromPackVersion: string;
  readonly toPackVersion: string;
  readonly toConceptIds: readonly Id[];
  readonly inheritedConceptIds: readonly Id[];
  readonly evidenceEffects: readonly CompatibilityEvidenceEffect[];
  readonly appliedAt: Timestamp;
}

export interface InvalidPayload {
  readonly seq: number;
  readonly message: string;
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function payloadStringArray(payload: Record<string, unknown>, key: string): string[] | null {
  const value = payload[key];
  if (!Array.isArray(value)) return null;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    strings.push(item);
  }
  return strings;
}

function payloadBoolean(payload: Record<string, unknown>, key: string): boolean | null {
  const value = payload[key];
  return typeof value === 'boolean' ? value : null;
}

function isTimestamp(value: string | null): value is Timestamp {
  return value !== null && isValidRfc3339Utc(value);
}

export function createConceptProgress(
  key: {
    readonly learnerId: Id;
    readonly courseEditionId: Id;
    readonly packVersion: string;
    readonly conceptId: Id;
  },
  policyVersion: string,
): ConceptProgress {
  return {
    schemaVersion: 1,
    learnerId: key.learnerId,
    courseEditionId: key.courseEditionId,
    packVersion: key.packVersion,
    conceptId: key.conceptId,
    learning: { state: 'not_started', startedAt: null, lastCompletedAt: null },
    understanding: { state: 'unassessed', assessmentId: null, updatedAt: null, validity: 'current' },
    review: {
      lastCompletedAt: null,
      dueAt: null,
      activeSessionId: null,
      latestOutcome: null,
      policyVersion,
    },
    lastPosition: { sessionId: null, activityId: null, cursor: null, updatedAt: null },
    revision: 0,
  };
}

export class LearnerProjector {
  private readonly entriesByKey = new Map<string, ConceptEntry>();
  private readonly sessionMap = new Map<Id, Session>();
  private readonly attemptMap = new Map<Id, ActivityAttempt>();
  private readonly attemptPhaseMap = new Map<Id, string>();
  private readonly selfReportList: SelfReport[] = [];
  private readonly declarationHistory: ScopeDeclaration[] = [];
  private readonly diagnosticHistory: DiagnosticRecord[] = [];
  private readonly compatibilityHistory: AppliedCompatibility[] = [];
  private readonly invalidList: InvalidPayload[] = [];
  private readonly requestSeqMap = new Map<string, number>();
  private readonly attemptRequestMap = new Map<Id, string>();
  private processedCommands = 0;
  private ignoredCommands = 0;

  constructor(
    readonly learnerId: Id,
    private readonly defaultPolicyVersion: string,
  ) {}

  get invalidPayloads(): readonly InvalidPayload[] {
    return this.invalidList;
  }

  get commitsProcessed(): number {
    return this.processedCommands;
  }

  get ignored(): number {
    return this.ignoredCommands;
  }

  get attempts(): ReadonlyMap<Id, ActivityAttempt> {
    return this.attemptMap;
  }

  get sessions(): ReadonlyMap<Id, Session> {
    return this.sessionMap;
  }

  get selfReports(): readonly SelfReport[] {
    return this.selfReportList;
  }

  get scopeDeclarations(): readonly ScopeDeclaration[] {
    return this.declarationHistory;
  }

  get diagnostics(): readonly DiagnosticRecord[] {
    return this.diagnosticHistory;
  }

  get compatibility(): readonly AppliedCompatibility[] {
    return this.compatibilityHistory;
  }

  entries(): readonly ConceptEntry[] {
    return [...this.entriesByKey.values()];
  }

  getEntry(key: {
    readonly learnerId: Id;
    readonly courseEditionId: Id;
    readonly packVersion: string;
    readonly conceptId: Id;
  }): ConceptEntry | null {
    return this.entriesByKey.get(progressKey(key)) ?? null;
  }

  findLatestEntry(
    conceptId: Id,
    courseEditionId?: Id,
    packVersion?: string,
  ): ConceptEntry | null {
    const matches = this.entries().filter(
      (entry) =>
        entry.progress.conceptId === conceptId &&
        (courseEditionId === undefined || entry.progress.courseEditionId === courseEditionId) &&
        (packVersion === undefined || entry.progress.packVersion === packVersion),
    );
    if (matches.length === 0) return null;
    matches.sort((left, right) => {
      if (left.progress.packVersion !== right.progress.packVersion) {
        return left.progress.packVersion < right.progress.packVersion ? 1 : -1;
      }
      if (left.progress.courseEditionId !== right.progress.courseEditionId) {
        return left.progress.courseEditionId < right.progress.courseEditionId ? 1 : -1;
      }
      return right.progress.revision - left.progress.revision;
    });
    return matches[0] ?? null;
  }

  listEntries(filter: {
    readonly courseEditionId?: Id;
    readonly packVersion?: string;
    readonly conceptIds?: readonly Id[];
  } = {}): readonly ConceptEntry[] {
    const conceptFilter = filter.conceptIds === undefined ? null : new Set(filter.conceptIds);
    const matches = this.entries().filter(
      (entry) =>
        (filter.courseEditionId === undefined ||
          entry.progress.courseEditionId === filter.courseEditionId) &&
        (filter.packVersion === undefined || entry.progress.packVersion === filter.packVersion) &&
        (conceptFilter === null || conceptFilter.has(entry.progress.conceptId)),
    );
    matches.sort((left, right) => {
      const a = left.progress;
      const b = right.progress;
      if (a.courseEditionId !== b.courseEditionId) return a.courseEditionId < b.courseEditionId ? -1 : 1;
      if (a.packVersion !== b.packVersion) return a.packVersion < b.packVersion ? -1 : 1;
      if (a.conceptId !== b.conceptId) return a.conceptId < b.conceptId ? -1 : 1;
      return 0;
    });
    return matches;
  }

  apply(command: JournalCommand): void {
    if (command.learnerId !== this.learnerId) return;
    this.processedCommands += 1;
    this.requestSeqMap.set(command.requestId, command.seq);
    switch (command.type) {
      case LEARNER_COMMAND_TYPES.sessionStarted:
        this.applySessionStarted(command);
        return;
      case LEARNER_COMMAND_TYPES.sessionEnded:
        this.applySessionEnded(command);
        return;
      case LEARNER_COMMAND_TYPES.learningCompleted:
        this.applyLearningCompleted(command);
        return;
      case LEARNER_COMMAND_TYPES.reviewCompleted:
        this.applyReviewCompleted(command);
        return;
      case LEARNER_COMMAND_TYPES.reviewDeferred:
        this.applyReviewDeferred(command);
        return;
      case LEARNER_COMMAND_TYPES.evidenceRecorded:
        this.applyEvidenceRecorded(command);
        return;
      case LEARNER_COMMAND_TYPES.evidenceStaled:
        this.applyEvidenceStaled(command);
        return;
      case LEARNER_COMMAND_TYPES.selfReportRecorded:
        this.applySelfReport(command);
        return;
      case LEARNER_COMMAND_TYPES.scopeDeclared:
        this.applyScopeDeclared(command);
        return;
      case LEARNER_COMMAND_TYPES.diagnosticCompleted:
        this.applyDiagnosticCompleted(command);
        return;
      case LEARNER_COMMAND_TYPES.compatibilityApplied:
        this.applyCompatibility(command);
        return;
      case LEARNER_COMMAND_TYPES.attemptSubmitted:
        this.applyAttemptSubmitted(command);
        return;
      case LEARNER_COMMAND_TYPES.assessmentCommitted:
        this.applyAssessmentCommitted(command);
        return;
      case LEARNER_COMMAND_TYPES.assessmentFailed:
      case LEARNER_COMMAND_TYPES.assessmentCancelled:
        this.applyAssessmentFailure(command);
        return;
      default:
        this.ignoredCommands += 1;
    }
  }

  private invalid(command: JournalCommand, message: string): void {
    this.invalidList.push({ seq: command.seq, message });
  }

  private ensureEntry(
    learnerId: Id,
    courseEditionId: Id,
    packVersion: string,
    conceptId: Id,
  ): ConceptEntry {
    const key = progressKey({ learnerId, courseEditionId, packVersion, conceptId });
    const existing = this.entriesByKey.get(key);
    if (existing !== undefined) return existing;
    const entry: ConceptEntry = {
      progress: createConceptProgress(
        { learnerId, courseEditionId, packVersion, conceptId },
        this.defaultPolicyVersion,
      ),
      assessments: [],
      evidence: [],
      reviewHistory: [],
      staleHistory: [],
      deferralDueAt: null,
      historyInherited: false,
      trustModeSeen: new Set<TrustMode>(),
      lastStaledAt: null,
    };
    this.entriesByKey.set(key, entry);
    return entry;
  }

  private writeProgress(
    entry: ConceptEntry,
    next: ConceptProgress,
    command: JournalCommand,
    label: string,
  ): boolean {
    const candidate: ConceptProgress = { ...next, revision: entry.progress.revision + 1 };
    const validation = validateConceptProgress(candidate);
    if (!validation.ok) {
      this.invalid(
        command,
        `${label}: projected progress invalid: ${validation.issues[0]?.message ?? 'unknown'}`,
      );
      return false;
    }
    entry.progress = validation.value;
    return true;
  }

  private entryForSessionConcept(
    session: Session,
    command: JournalCommand,
  ): ConceptEntry | null {
    if (!isOpaqueId(session.conceptId) || !isOpaqueId(session.courseEditionId)) return null;
    if (typeof session.packVersion !== 'string' || session.packVersion.length === 0) return null;
    return this.ensureEntry(
      session.learnerId,
      session.courseEditionId,
      session.packVersion,
      session.conceptId,
    );
  }

  private applySessionStarted(command: JournalCommand): void {
    const validation = validateSession(command.payload['session']);
    if (!validation.ok) {
      this.invalid(command, `session.started payload invalid: ${validation.issues[0]?.message ?? 'unknown'}`);
      return;
    }
    const session = validation.value;
    if (session.status !== 'active') {
      this.invalid(command, 'session.started requires an active session');
      return;
    }
    if (this.sessionMap.has(session.id)) {
      this.invalid(command, `session ${session.id} already started`);
      return;
    }
    this.sessionMap.set(session.id, session);
    if (session.mode === 'diagnostic') {
      // A short diagnostic must not mark a concept as learned or reviewed.
      return;
    }
    const entry = this.entryForSessionConcept(session, command);
    if (entry === null) {
      this.invalid(command, 'session.started has an invalid concept/pack binding');
      return;
    }
    entry.trustModeSeen.add(session.trustMode);
    const next: ConceptProgress = {
      ...entry.progress,
      learning:
        session.mode === 'learn' && entry.progress.learning.state === 'not_started'
          ? {
              state: 'in_progress',
              startedAt: session.startedAt,
              lastCompletedAt: entry.progress.learning.lastCompletedAt,
            }
          : entry.progress.learning,
      review:
        session.mode === 'review'
          ? { ...entry.progress.review, activeSessionId: session.id }
          : entry.progress.review,
      lastPosition: {
        sessionId: session.id,
        activityId: null,
        cursor: null,
        updatedAt: session.startedAt,
      },
    };
    this.writeProgress(entry, next, command, 'session.started');
  }

  private applySessionEnded(command: JournalCommand): void {
    const sessionId = payloadString(command.payload, 'sessionId');
    const status = payloadString(command.payload, 'status');
    const endedAt = payloadString(command.payload, 'endedAt');
    if (
      sessionId === null ||
      (status !== 'completed' && status !== 'abandoned') ||
      !isTimestamp(endedAt)
    ) {
      this.invalid(command, 'session.ended payload invalid');
      return;
    }
    const session = this.sessionMap.get(sessionId);
    if (session === undefined) {
      this.invalid(command, `session.ended references unknown session ${sessionId}`);
      return;
    }
    if (session.status !== 'active') {
      this.invalid(command, `session ${sessionId} is not active`);
      return;
    }
    if (Date.parse(endedAt) < Date.parse(session.startedAt)) {
      this.invalid(command, 'session.ended precedes session.started');
      return;
    }
    this.sessionMap.set(sessionId, { ...session, status, endedAt });
    const entry = this.findLatestEntry(session.conceptId, session.courseEditionId, session.packVersion);
    if (entry === null) return;
    if (session.mode === 'review' && entry.progress.review.activeSessionId === sessionId) {
      this.writeProgress(
        entry,
        {
          ...entry.progress,
          review: { ...entry.progress.review, activeSessionId: null },
        },
        command,
        'session.ended',
      );
    }
  }

  private applyLearningCompleted(command: JournalCommand): void {
    const sessionId = payloadString(command.payload, 'sessionId');
    const conceptId = payloadString(command.payload, 'conceptId');
    const completedAt = payloadString(command.payload, 'completedAt');
    const dueAt = payloadString(command.payload, 'dueAt');
    const policyVersion = payloadString(command.payload, 'policyVersion');
    if (
      sessionId === null ||
      conceptId === null ||
      !isTimestamp(completedAt) ||
      !isTimestamp(dueAt) ||
      policyVersion === null ||
      policyVersion.length === 0
    ) {
      this.invalid(command, 'learning.completed payload invalid');
      return;
    }
    const session = this.sessionMap.get(sessionId);
    if (session === undefined) {
      this.invalid(command, `learning.completed references unknown session ${sessionId}`);
      return;
    }
    if (session.mode !== 'learn' || session.conceptId !== conceptId) {
      this.invalid(command, 'learning.completed must reference a learn session for the same concept');
      return;
    }
    if (Date.parse(completedAt) < Date.parse(session.startedAt)) {
      this.invalid(command, 'learning.completed precedes session.started');
      return;
    }
    const entry = this.ensureEntry(
      command.learnerId,
      session.courseEditionId,
      session.packVersion,
      conceptId,
    );
    entry.trustModeSeen.add(session.trustMode);
    const previousCompleted = entry.progress.learning.lastCompletedAt;
    const lastCompletedAt =
      previousCompleted === null || Date.parse(completedAt) > Date.parse(previousCompleted)
        ? completedAt
        : previousCompleted;
    const next: ConceptProgress = {
      ...entry.progress,
      learning: {
        state: 'completed',
        startedAt: entry.progress.learning.startedAt ?? completedAt,
        lastCompletedAt,
      },
      review: {
        ...entry.progress.review,
        dueAt,
        policyVersion,
      },
      lastPosition: {
        sessionId,
        activityId: entry.progress.lastPosition.activityId,
        cursor: entry.progress.lastPosition.cursor,
        updatedAt: completedAt,
      },
    };
    this.writeProgress(entry, next, command, 'learning.completed');
  }

  private applyReviewCompleted(command: JournalCommand): void {
    const sessionId = payloadString(command.payload, 'sessionId');
    const conceptId = payloadString(command.payload, 'conceptId');
    const outcome = payloadString(command.payload, 'outcome');
    const completedAt = payloadString(command.payload, 'completedAt');
    const previousDueAt = command.payload['previousDueAt'];
    const dueAt = payloadString(command.payload, 'dueAt');
    const early = payloadBoolean(command.payload, 'early');
    const policyVersion = payloadString(command.payload, 'policyVersion');
    if (
      sessionId === null ||
      conceptId === null ||
      (outcome !== 'needs_support' && outcome !== 'developing' && outcome !== 'supported') ||
      !isTimestamp(completedAt) ||
      !(previousDueAt === null || (typeof previousDueAt === 'string' && isValidRfc3339Utc(previousDueAt))) ||
      !isTimestamp(dueAt) ||
      early === null ||
      policyVersion === null
    ) {
      this.invalid(command, 'review.completed payload invalid');
      return;
    }
    const session = this.sessionMap.get(sessionId);
    if (session === undefined) {
      this.invalid(command, `review.completed references unknown session ${sessionId}`);
      return;
    }
    if (session.mode !== 'review' || session.conceptId !== conceptId) {
      this.invalid(command, 'review.completed must reference a review session for the same concept');
      return;
    }
    const entry = this.ensureEntry(
      command.learnerId,
      session.courseEditionId,
      session.packVersion,
      conceptId,
    );
    entry.trustModeSeen.add(session.trustMode);
    entry.reviewHistory.push({
      kind: 'completed',
      at: completedAt,
      dueAt,
      previousDueAt: previousDueAt === null ? null : previousDueAt,
      outcome,
      early,
      reason: early ? 'early_review' : 'scheduled_review',
    });
    const next: ConceptProgress = {
      ...entry.progress,
      review: {
        lastCompletedAt: completedAt,
        dueAt,
        activeSessionId: null,
        latestOutcome: outcome,
        policyVersion,
      },
      lastPosition: {
        sessionId,
        activityId: entry.progress.lastPosition.activityId,
        cursor: entry.progress.lastPosition.cursor,
        updatedAt: completedAt,
      },
    };
    entry.deferralDueAt = null;
    this.writeProgress(entry, next, command, 'review.completed');
  }

  private applyReviewDeferred(command: JournalCommand): void {
    const conceptId = payloadString(command.payload, 'conceptId');
    const courseEditionId = payloadString(command.payload, 'courseEditionId');
    const packVersion = payloadString(command.payload, 'packVersion');
    const previousDueAt = payloadString(command.payload, 'previousDueAt');
    const newDueAt = payloadString(command.payload, 'newDueAt');
    const deferredAt = payloadString(command.payload, 'deferredAt');
    const reason = payloadString(command.payload, 'reason');
    const policyVersion = payloadString(command.payload, 'policyVersion');
    if (
      conceptId === null ||
      !isTimestamp(previousDueAt) ||
      !isTimestamp(newDueAt) ||
      !isTimestamp(deferredAt) ||
      reason === null ||
      policyVersion === null
    ) {
      this.invalid(command, 'review.deferred payload invalid');
      return;
    }
    let entry: ConceptEntry | null = null;
    if (courseEditionId !== null && packVersion !== null) {
      entry = this.getEntry({
        learnerId: command.learnerId,
        courseEditionId,
        packVersion,
        conceptId,
      });
    } else {
      const matches = this.entries().filter((item) => item.progress.conceptId === conceptId);
      matches.sort((a, b) => (a.progress.packVersion < b.progress.packVersion ? 1 : -1));
      entry = matches[0] ?? null;
    }
    if (entry === null) {
      this.invalid(command, `review.deferred references unknown concept ${conceptId}`);
      return;
    }
    if (entry.progress.review.dueAt !== previousDueAt) {
      this.invalid(command, 'review.deferred previousDueAt does not match the current dueAt');
      return;
    }
    entry.reviewHistory.push({
      kind: 'deferred',
      at: deferredAt,
      dueAt: newDueAt,
      previousDueAt,
      outcome: null,
      early: false,
      reason,
    });
    entry.deferralDueAt = newDueAt;
    this.writeProgress(
      entry,
      {
        ...entry.progress,
        review: { ...entry.progress.review, dueAt: newDueAt, policyVersion },
      },
      command,
      'review.deferred',
    );
  }

  private addEvidence(
    entry: ConceptEntry,
    evidence: Evidence,
    meta: { coreMisconception: boolean; answerDisclosed: boolean },
  ): void {
    const index = entry.evidence.findIndex((item) => item.evidence.id === evidence.id);
    const effective: EffectiveEvidence = {
      evidence,
      validity: evidence.validity,
      staledAt: null,
      coreMisconception: meta.coreMisconception,
      answerDisclosed: meta.answerDisclosed,
    };
    if (index < 0) {
      entry.evidence.push(effective);
      return;
    }
    const prior = entry.evidence[index];
    if (prior === undefined) return;
    const preservedValidity =
      prior.validity === 'stale' || prior.validity === 'needs_recheck'
        ? prior.validity
        : effective.validity;
    entry.evidence[index] = {
      ...effective,
      validity: preservedValidity,
      staledAt: prior.staledAt,
      coreMisconception: prior.coreMisconception || effective.coreMisconception,
      answerDisclosed: prior.answerDisclosed || effective.answerDisclosed,
    };
  }

  private applyEvidenceList(
    entry: ConceptEntry,
    command: JournalCommand,
    evidenceList: readonly unknown[],
    coreIds: readonly string[],
    answerIds: readonly string[],
  ): boolean {
    let ok = true;
    for (const raw of evidenceList) {
      const validation = validateEvidence(raw);
      if (!validation.ok) {
        this.invalid(
          command,
          `evidence payload invalid: ${validation.issues[0]?.message ?? 'unknown'}`,
        );
        ok = false;
        continue;
      }
      const evidence = validation.value;
      if (evidence.learnerId !== entry.progress.learnerId) {
        this.invalid(command, 'evidence belongs to another learner');
        ok = false;
        continue;
      }
      this.addEvidence(entry, evidence, {
        coreMisconception: coreIds.includes(evidence.id),
        answerDisclosed: answerIds.includes(evidence.id),
      });
    }
    return ok;
  }

  private applyEvidenceRecorded(command: JournalCommand): void {
    const evidenceList = command.payload['evidence'];
    if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
      this.invalid(command, 'evidence.recorded requires a non-empty evidence array');
      return;
    }
    const coreIds = payloadStringArray(command.payload, 'coreMisconceptionEvidenceIds') ?? [];
    const answerIds = payloadStringArray(command.payload, 'answerDisclosedEvidenceIds') ?? [];
    for (const raw of evidenceList) {
      const validation = validateEvidence(raw);
      if (!validation.ok) {
        this.invalid(
          command,
          `evidence.recorded payload invalid: ${validation.issues[0]?.message ?? 'unknown'}`,
        );
        continue;
      }
      const evidence = validation.value;
      const entry = this.ensureEntry(
        command.learnerId,
        evidence.courseEditionId,
        evidence.packVersion,
        evidence.conceptId,
      );
      this.applyEvidenceList(entry, command, [evidence], coreIds, answerIds);
    }
  }

  private applyAssessmentCommitted(command: JournalCommand): void {
    const assessmentValidation = validateAssessment(command.payload['assessment']);
    if (!assessmentValidation.ok) {
      this.invalid(
        command,
        `assessment.committed assessment invalid: ${assessmentValidation.issues[0]?.message ?? 'unknown'}`,
      );
      return;
    }
    const assessment = assessmentValidation.value;
    const evidenceList = command.payload['evidence'];
    if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
      this.invalid(command, 'assessment.committed requires evidence');
      return;
    }
    const coreIds = payloadStringArray(command.payload, 'coreMisconceptionEvidenceIds') ?? [];
    const answerIds = payloadStringArray(command.payload, 'answerDisclosedEvidenceIds') ?? [];
    const entry = this.ensureEntry(
      command.learnerId,
      assessment.courseEditionId,
      assessment.packVersion,
      assessment.conceptId,
    );
    if (!this.applyEvidenceList(entry, command, evidenceList, coreIds, answerIds)) return;
    if (!entry.assessments.some((item) => item.assessment.id === assessment.id)) {
      entry.assessments.push({ assessment, validity: assessment.validity, staledAt: null });
    }
    const next: ConceptProgress = {
      ...entry.progress,
      understanding: {
        state: assessment.state,
        assessmentId: assessment.id,
        updatedAt: assessment.assessedAt,
        validity: assessment.validity,
      },
    };
    this.writeProgress(entry, next, command, 'assessment.committed');
    if (assessment.attemptId !== null) {
      this.attemptPhaseMap.set(assessment.attemptId, 'assessment_committed');
    }
  }

  private applyAssessmentFailure(command: JournalCommand): void {
    const attemptId = payloadString(command.payload, 'attemptId');
    if (attemptId === null) {
      this.invalid(command, `${command.type} payload needs attemptId`);
      return;
    }
    this.attemptPhaseMap.set(
      attemptId,
      command.type === LEARNER_COMMAND_TYPES.assessmentFailed
        ? 'assessment_failed'
        : 'assessment_cancelled',
    );
  }

  private applyEvidenceStaled(command: JournalCommand): void {
    const conceptId = payloadString(command.payload, 'conceptId');
    const courseEditionId = payloadString(command.payload, 'courseEditionId');
    const packVersion = payloadString(command.payload, 'packVersion');
    const staledAt = payloadString(command.payload, 'staledAt');
    const reason = payloadString(command.payload, 'reason');
    const policyVersion = payloadString(command.payload, 'policyVersion');
    const assessmentIds = payloadStringArray(command.payload, 'assessmentIds');
    const evidenceIds = payloadStringArray(command.payload, 'evidenceIds');
    if (
      conceptId === null ||
      !isTimestamp(staledAt) ||
      reason === null ||
      policyVersion === null ||
      assessmentIds === null ||
      evidenceIds === null
    ) {
      this.invalid(command, 'evidence.staled payload invalid');
      return;
    }
    let targets: ConceptEntry[];
    if (courseEditionId !== null && packVersion !== null) {
      const exact = this.getEntry({
        learnerId: command.learnerId,
        courseEditionId,
        packVersion,
        conceptId,
      });
      targets = exact === null ? [] : [exact];
    } else {
      // Legacy events without pack binding apply to every stored version of the
      // concept, which is visible as a version-bound warning in the report.
      targets = this.entries().filter((entry) => entry.progress.conceptId === conceptId);
    }
    if (targets.length === 0) {
      this.invalid(
        command,
        `evidence.staled references unknown progress ${conceptId} (${courseEditionId ?? '*'}/${packVersion ?? '*'})`,
      );
      return;
    }
    for (const entry of targets) {
      for (const [index, item] of entry.assessments.entries()) {
        if (assessmentIds.includes(item.assessment.id)) {
          entry.assessments[index] = { ...item, validity: 'stale', staledAt };
        }
      }
      for (const [index, item] of entry.evidence.entries()) {
        if (evidenceIds.includes(item.evidence.id)) {
          entry.evidence[index] = { ...item, validity: 'stale', staledAt };
        }
      }
      entry.staleHistory.push({ staledAt, reason, assessmentIds, evidenceIds });
      entry.lastStaledAt = staledAt;
      const current = entry.progress.understanding;
      if (current.state === 'unassessed') continue;
      const next: ConceptProgress = {
        ...entry.progress,
        understanding: {
          state: current.state === 'supported' ? 'developing' : current.state,
          assessmentId: current.assessmentId,
          updatedAt: staledAt,
          validity: 'stale',
        },
        review: { ...entry.progress.review, policyVersion },
      };
      this.writeProgress(entry, next, command, 'evidence.staled');
    }
  }

  private applySelfReport(command: JournalCommand): void {
    const validation = validateSelfReport(command.payload['selfReport']);
    if (!validation.ok) {
      this.invalid(command, `self_report.recorded payload invalid: ${validation.issues[0]?.message ?? 'unknown'}`);
      return;
    }
    const report = validation.value;
    if (report.learnerId !== command.learnerId) {
      this.invalid(command, 'self report belongs to another learner');
      return;
    }
    if (!this.selfReportList.some((item) => item.id === report.id)) {
      this.selfReportList.push(report);
    }
    // Deliberately no ConceptProgress write: self report is a separate field.
  }

  private applyScopeDeclared(command: JournalCommand): void {
    const conceptIds = payloadStringArray(command.payload, 'conceptIds');
    const declaredAt = payloadString(command.payload, 'declaredAt');
    if (conceptIds === null || !isTimestamp(declaredAt)) {
      this.invalid(command, 'scope.declared payload invalid');
      return;
    }
    if (conceptIds.some((id) => !isOpaqueId(id))) {
      this.invalid(command, 'scope.declared contains an invalid concept id');
      return;
    }
    this.declarationHistory.push({
      conceptIds: [...new Set(conceptIds)],
      declaredAt,
      source: 'first_use',
    });
  }

  private applyDiagnosticCompleted(command: JournalCommand): void {
    const sessionId = payloadString(command.payload, 'sessionId');
    const testedConceptIds = payloadStringArray(command.payload, 'testedConceptIds');
    const completedAt = payloadString(command.payload, 'completedAt');
    const skipped = payloadBoolean(command.payload, 'skipped');
    if (
      sessionId === null ||
      testedConceptIds === null ||
      !isTimestamp(completedAt) ||
      skipped === null
    ) {
      this.invalid(command, 'diagnostic.completed payload invalid');
      return;
    }
    this.diagnosticHistory.push({
      sessionId,
      testedConceptIds: [...new Set(testedConceptIds)],
      skipped,
      completedAt,
    });
  }

  private applyCompatibility(command: JournalCommand): void {
    const mapValidation = validateCompatibilityMap(command.payload['map']);
    if (!mapValidation.ok) {
      this.invalid(command, `compatibility.applied map invalid: ${mapValidation.issues[0]?.message ?? 'unknown'}`);
      return;
    }
    const map = mapValidation.value;
    const newEntries = command.payload['newEntries'];
    const effectsRaw = command.payload['evidenceEffects'];
    const inherited = payloadStringArray(command.payload, 'inheritedConceptIds') ?? [];
    const createdAt = payloadString(command.payload, 'createdAt');
    if (!Array.isArray(newEntries) || !Array.isArray(effectsRaw) || !isTimestamp(createdAt)) {
      this.invalid(command, 'compatibility.applied payload invalid');
      return;
    }
    const insertedConceptIds: Id[] = [];
    for (const raw of newEntries) {
      const validation = validateConceptProgress(raw);
      if (!validation.ok) {
        this.invalid(
          command,
          `compatibility.applied new entry invalid: ${validation.issues[0]?.message ?? 'unknown'}`,
        );
        continue;
      }
      const progress = validation.value;
      if (
        progress.learnerId !== command.learnerId ||
        progress.courseEditionId !== map.courseEditionId ||
        progress.packVersion !== map.toPackVersion
      ) {
        this.invalid(command, 'compatibility.applied new entry is bound to another learner/edition/version');
        continue;
      }
      if (progress.understanding.state !== 'unassessed') {
        this.invalid(command, 'compatibility.applied must not copy a formal understanding state');
        continue;
      }
      const key = progressKey(progress);
      if (this.entriesByKey.has(key)) continue;
      this.entriesByKey.set(key, {
        progress,
        assessments: [],
        evidence: [],
        reviewHistory: [],
        staleHistory: [],
        deferralDueAt: null,
        historyInherited: inherited.includes(progress.conceptId),
        trustModeSeen: new Set<TrustMode>(),
        lastStaledAt: null,
      });
      insertedConceptIds.push(progress.conceptId);
    }
    const effects: CompatibilityEvidenceEffect[] = [];
    for (const raw of effectsRaw) {
      if (typeof raw !== 'object' || raw === null) continue;
      const record = raw as Record<string, unknown>;
      const conceptId = typeof record['conceptId'] === 'string' ? record['conceptId'] : null;
      const packVersion = typeof record['packVersion'] === 'string' ? record['packVersion'] : null;
      const effect = record['effect'];
      const reason = typeof record['reason'] === 'string' ? record['reason'] : '';
      if (
        conceptId === null ||
        packVersion === null ||
        (effect !== 'inherit' && effect !== 'stale' && effect !== 'recheck' && effect !== 'reset')
      ) {
        this.invalid(command, 'compatibility.applied evidence effect invalid');
        continue;
      }
      effects.push({ conceptId, packVersion, effect, reason });
      const entry = this.entries().find(
        (item) =>
          item.progress.conceptId === conceptId && item.progress.packVersion === packVersion,
      );
      if (entry === undefined || effect === 'inherit') continue;
      const validity: Validity = effect === 'recheck' ? 'needs_recheck' : 'stale';
      for (const [index, item] of entry.assessments.entries()) {
        entry.assessments[index] = { ...item, validity, staledAt: createdAt };
      }
      for (const [index, item] of entry.evidence.entries()) {
        entry.evidence[index] = { ...item, validity, staledAt: createdAt };
      }
    }
    this.compatibilityHistory.push({
      mapId: map.id,
      fromPackVersion: map.fromPackVersion,
      toPackVersion: map.toPackVersion,
      toConceptIds: insertedConceptIds,
      inheritedConceptIds: [...new Set(inherited)],
      evidenceEffects: effects,
      appliedAt: createdAt,
    });
  }

  private applyAttemptSubmitted(command: JournalCommand): void {
    const validation = validateActivityAttempt(command.payload['attempt']);
    if (!validation.ok) {
      this.invalid(
        command,
        `attempt.submitted payload invalid: ${validation.issues[0]?.message ?? 'unknown'}`,
      );
      return;
    }
    const attempt = validation.value;
    if (attempt.learnerId !== command.learnerId) {
      this.invalid(command, 'attempt belongs to another learner');
      return;
    }
    this.attemptMap.set(attempt.id, attempt);
    this.attemptRequestMap.set(attempt.id, command.requestId);
    this.attemptPhaseMap.set(attempt.id, 'attempt_saved');
    const session = this.sessionMap.get(attempt.sessionId);
    if (session === undefined) return;
    for (const conceptId of attempt.conceptIds) {
      const entry = this.findLatestEntry(conceptId, attempt.courseEditionId, attempt.packVersion);
      if (entry === null) continue;
      if (session.mode === 'diagnostic') continue;
      this.writeProgress(
        entry,
        {
          ...entry.progress,
          lastPosition: {
            sessionId: attempt.sessionId,
            activityId: attempt.activityId,
            cursor: entry.progress.lastPosition.cursor,
            updatedAt: attempt.submittedAt,
          },
        },
        command,
        'attempt.submitted',
      );
    }
  }

  getAttemptPhase(attemptId: Id): string | null {
    return this.attemptPhaseMap.get(attemptId) ?? null;
  }

  requestSeqOf(requestId: string): number | null {
    return this.requestSeqMap.get(requestId) ?? null;
  }

  attemptRequestIdOf(attemptId: Id): string | null {
    return this.attemptRequestMap.get(attemptId) ?? null;
  }
}
