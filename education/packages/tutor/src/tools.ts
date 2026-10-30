/**
 * Education tool factory (T07 card step 1 & 4).
 *
 * Six host-registered tools, all read-only content queries plus one controlled
 * submission path. There is no shell, no filesystem, no network and no plugin
 * installation tool in this allowlist, and no argument can widen it:
 *
 *   - parameters are validated at runtime against a closed JSON schema
 *     (unknown fields rejected before any service call);
 *   - the learner id and content pack are bound by the host, never accepted
 *     from model arguments;
 *   - every call carries an idempotency key; duplicates return the first result;
 *   - cancellation and timeout are checked before/after work, and no late
 *     result is committed;
 *   - failures are structured `AUTH/QUOTA/UNSUPPORTED/NETWORK/CANCELLED/...`
 *     errors, and any non-allowlisted tool name is rejected as `unknown tool`
 *     (dangerous names additionally leave a `permission.denied` audit event).
 */

import type {
  ConceptProgress,
  ContentPack,
  HelpKind,
  Id,
  KnowledgePort,
  PackKey,
  RequestContext,
  ServiceResult,
  Timestamp,
} from '@edu/domain';
import { isOpaqueId } from '@edu/domain';
import { fromServiceError, errorFromThrown, tutorError, TutorException } from './errors.js';
import { formatIssues, validateToolArguments } from './schema.js';
import type {
  EducationToolDefinition,
  EvidenceRejection,
  ToolCallContext,
  ToolCallOutcome,
  ToolHost,
  ToolOutputSchema,
  ToolParameterSchema,
  TutorAttemptOutcome,
  TutorContentPort,
  TutorError,
  TutorProgressSummary,
  TutorToolDependencies,
  TutorToolSessionResolver,
} from './types.js';

export const EDUCATION_TOOL_NAMES = [
  'edu_get_concept',
  'edu_resolve_source',
  'edu_list_activities',
  'edu_submit_attempt',
  'edu_get_feedback_rubric',
  'edu_progress_summary',
] as const;

export type EducationToolName = (typeof EDUCATION_TOOL_NAMES)[number];

/**
 * Names that are never part of the education profile. They receive the same
 * `unknown tool` error as any other miss, plus an explicit permission audit.
 */
export const FORBIDDEN_TOOL_NAMES: readonly string[] = [
  'bash',
  'shell',
  'powershell',
  'cmd',
  'exec',
  'run_code',
  'ptc',
  'read_file',
  'write_file',
  'delete_file',
  'list_dir',
  'http_request',
  'fetch',
  'fetch_url',
  'web_search',
  'install_plugin',
  'plugin_install',
  'computer_use',
];

export interface EducationToolRegistry {
  readonly names: readonly string[];
  readonly definitions: readonly EducationToolDefinition[];
  has(name: string): boolean;
  /** Never throws: unknown tools and invalid arguments become structured errors. */
  call(name: string, args: unknown, context: ToolCallContext): Promise<ToolCallOutcome>;
  /** Registers every allowlisted definition on the DSH host (`ctx.tools.register`). */
  register(host: ToolHost): void;
}

interface ResolvedCall {
  readonly rawArgs: unknown;
  readonly requestId: string;
  readonly ctx: RequestContext;
}

interface ToolSpec {
  readonly name: EducationToolName;
  readonly description: string;
  readonly parameters: ToolParameterSchema;
  readonly output: ToolOutputSchema;
  readonly render: (args: unknown, value: unknown) => readonly { readonly type: 'text'; readonly text: string }[];
  readonly run: (args: Readonly<Record<string, unknown>>, call: ResolvedCall) => Promise<unknown>;
}

const text = (description: string): ToolParameterSchema['properties'][string] => ({
  type: 'string',
  description,
});

const OPTIONAL_REQUEST_ID: ToolParameterSchema['properties'][string] = {
  type: 'string',
  description: 'Opaque idempotency key for this tool call (repeats return the first result).',
  minLength: 1,
  maxLength: 128,
};

function outputSchema(): ToolOutputSchema {
  return { type: 'object', additionalProperties: true };
}

function packKeyOf(deps: TutorToolDependencies): PackKey {
  return deps.packKey;
}

function requestContextOf(deps: TutorToolDependencies, call: ToolCallContext): RequestContext {
  return {
    requestId: call.requestId,
    learnerId: deps.learnerId,
    now: deps.clock.now(),
    signal: call.signal,
    timeoutMs: call.timeoutMs,
  };
}

interface CancellationTokenLike {
  readonly cancelled: boolean;
  onCancel(listener: () => void): () => void;
}

function isCancellationToken(value: unknown): value is CancellationTokenLike {
  const candidate = value as { cancelled?: unknown; onCancel?: unknown } | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.cancelled === 'boolean' &&
    typeof candidate.onCancel === 'function'
  );
}

function isAbortSignalLike(value: unknown): value is AbortSignal {
  const candidate = value as { aborted?: unknown; addEventListener?: unknown } | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.aborted === 'boolean' &&
    typeof candidate.addEventListener === 'function'
  );
}

function adaptSignal(value: unknown): CancellationTokenLike | undefined {
  if (isCancellationToken(value)) return value;
  if (isAbortSignalLike(value)) {
    return {
      get cancelled() {
        return value.aborted;
      },
      onCancel(listener: () => void) {
        value.addEventListener('abort', listener);
        return () => value.removeEventListener('abort', listener);
      },
    };
  }
  return undefined;
}

/** Tolerates the DSH host tool context shape without trusting it for permissions. */
export function adaptToolCallContext(raw: unknown, fallbackRequestId: string): ToolCallContext {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const requestId =
    typeof record.requestId === 'string' && record.requestId.length > 0
      ? record.requestId
      : fallbackRequestId;
  const signal = adaptSignal(record.signal ?? record.cancellation);
  const timeoutMs = typeof record.timeoutMs === 'number' ? record.timeoutMs : undefined;
  return signal === undefined
    ? timeoutMs === undefined
      ? { requestId }
      : { requestId, timeoutMs }
    : timeoutMs === undefined
      ? { requestId, signal }
      : { requestId, signal, timeoutMs };
}

function looksLikePath(value: string): boolean {
  return /[\\/]/.test(value) || /^[A-Za-z]:/.test(value);
}

function assertOpaque(value: string, field: string): void {
  if (!isOpaqueId(value) || looksLikePath(value)) {
    throw new TutorException('INVALID_INPUT', `${field} must be an opaque id, not a path`);
  }
}

function throwFromService(error: { code: string; message: string; retryable: boolean; detailsRef?: string }): never {
  const mapped = fromServiceError(error as never);
  throw new TutorException(mapped.code, mapped.message, mapped.retryable, mapped.detailsRef);
}

function checkCancelled(signal: ToolCallContext['signal'], action: string): void {
  if (signal !== undefined && signal.cancelled) {
    throw new TutorException('CANCELLED', `${action} was cancelled`);
  }
}

function checkTimeout(call: ToolCallContext): void {
  if (call.timeoutMs !== undefined && call.timeoutMs <= 0) {
    throw new TutorException('TIMEOUT', 'the tool call timed out before it started', true);
  }
}

function progressView(progress: ServiceResult<ConceptProgress>): ConceptProgress | null {
  return progress.ok ? progress.data : null;
}

function activityInputKindMatches(
  answerSchema: ContentPack['activities'][number]['answerSchema'],
  inputType: string,
): boolean {
  switch (answerSchema.kind) {
    case 'text':
      return inputType === 'text';
    case 'choice':
      return inputType === 'choice';
    case 'diagram_label':
      return inputType === 'diagram_label';
    case 'relation':
      return inputType === 'relation';
    default:
      return false;
  }
}

function summariseRejections(rejected: readonly EvidenceRejection[]): readonly string[] {
  return rejected.map((item) => `${item.reason}: ${item.message}`);
}

export function createEducationToolRegistry(
  deps: TutorToolDependencies,
): EducationToolRegistry {
  const maxRows = deps.maxRows ?? 20;

  function audit(
    kind: Parameters<NonNullable<TutorToolDependencies['onAudit']>>[0]['kind'],
    subject: string,
    reason: string,
    detail?: Readonly<Record<string, unknown>>,
  ): void {
    deps.onAudit?.({
      at: deps.clock.now(),
      kind,
      subject,
      reason,
      ...(detail === undefined ? {} : { detail }),
    });
  }

  const specs: readonly ToolSpec[] = [
    {
      name: 'edu_get_concept',
      description:
        'Read one published concept from the bound content pack: explanation, objectives, common misconceptions, resolvable source refs, prerequisite/related relations and the learner three-axis projection. Read-only.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['conceptId'],
        properties: {
          conceptId: text('Opaque concept id from the current content pack.'),
          requestId: OPTIONAL_REQUEST_ID,
        },
      },
      output: outputSchema(),
      render: (_args, value) => {
        const data = value as { concept?: { title?: string } } | null;
        return [
          {
            type: 'text',
            text: `edu_get_concept -> ${data?.concept?.title ?? 'concept'} (source-backed, read-only)`,
          },
        ];
      },
      async run(args, call) {
        const conceptId = args.conceptId as string;
        assertOpaque(conceptId, 'conceptId');
        const view = await deps.content.getConcept(call.ctx, {
          ...packKeyOf(deps),
          conceptId,
        });
        if (!view.ok) throwFromService(view.error);
        if (!view.ok) throw new Error('unreachable');
        const progress = progressView(
          await deps.learner.get(call.ctx, {
            learnerId: deps.learnerId,
            courseEditionId: deps.packKey.courseEditionId,
            packVersion: deps.packKey.packVersion,
            conceptId,
          }),
        );
        return {
          concept: {
            id: view.data.concept.id,
            title: view.data.concept.title,
            aliases: view.data.concept.aliases,
            objectives: view.data.concept.learningObjectives,
            explanation: view.data.concept.explanation,
            misconceptions: view.data.concept.misconceptions,
            sourceRefs: view.data.concept.sourceRefs,
            rubricIds: view.data.concept.rubricIds,
            activityIds: view.data.concept.activityIds,
          },
          relations: view.data.relations.map((relation) => ({
            id: relation.id,
            type: relation.type,
            basis: relation.basis,
            fromConceptId: relation.fromConceptId,
            toConceptId: relation.toConceptId,
            rationale: relation.rationale,
            sourceRefs: relation.sourceRefs,
          })),
          progress:
            progress === null
              ? null
              : {
                  learning: progress.learning,
                  understanding: progress.understanding,
                  review: progress.review,
                },
          sourceComplete: view.data.concept.sourceRefs.length > 0,
        };
      },
    },
    {
      name: 'edu_resolve_source',
      description:
        'Resolve one source ref to its controlled location (PDF page integer, printed page or explicit null, normalized bbox). Never returns an OS path or textbook text. Read-only.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceRefId'],
        properties: {
          sourceRefId: text('Opaque source ref id.'),
          requestId: OPTIONAL_REQUEST_ID,
        },
      },
      output: outputSchema(),
      render: (_args, value) => {
        const data = value as { pdfPage?: number; printedPage?: string | null } | null;
        return [
          {
            type: 'text',
            text: `edu_resolve_source -> pdfPage=${data?.pdfPage ?? '?'} printedPage=${data?.printedPage ?? 'null'}`,
          },
        ];
      },
      async run(args, call) {
        const sourceRefId = args.sourceRefId as string;
        assertOpaque(sourceRefId, 'sourceRefId');
        const resolved = await deps.content.resolveSource(call.ctx, sourceRefId);
        if (!resolved.ok) throwFromService(resolved.error);
        if (!resolved.ok) throw new Error('unreachable');
        const summary = resolved.data;
        return {
          sourceRefId: summary.sourceRef.id,
          bookInstanceId: summary.sourceRef.bookInstanceId,
          pdfPage: summary.pdfPage,
          printedPage: summary.printedPage,
          bbox: summary.bbox,
          blockId: summary.sourceRef.blockId,
          figureId: summary.sourceRef.figureId,
          verification: summary.sourceRef.verification,
          bookConfirmedMetadata: summary.bookInstance?.confirmedMetadata ?? null,
          note: '印刷页缺失时保持 null；不根据文件名或固定偏移推断页码。',
        };
      },
    },
    {
      name: 'edu_list_activities',
      description:
        'List the activities attached to one concept in the bound content pack (type, stem, source refs, rubric version, disclosure policy). Read-only.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['conceptId'],
        properties: {
          conceptId: text('Opaque concept id from the current content pack.'),
          requestId: OPTIONAL_REQUEST_ID,
        },
      },
      output: outputSchema(),
      render: (_args, value) => {
        const data = value as { activities?: readonly unknown[] } | null;
        return [{ type: 'text', text: `edu_list_activities -> ${data?.activities?.length ?? 0} activity/activities` }];
      },
      async run(args, call) {
        const conceptId = args.conceptId as string;
        assertOpaque(conceptId, 'conceptId');
        const pack = await deps.content.getPack(call.ctx, packKeyOf(deps));
        if (!pack.ok) throwFromService(pack.error);
        if (!pack.ok) throw new Error('unreachable');
        const concept = pack.data.concepts.find((item) => item.id === conceptId);
        if (concept === undefined) {
          throw new TutorException('NOT_FOUND', `concept ${conceptId} is not in this content pack`);
        }
        const activities = pack.data.activities
          .filter((activity) => activity.conceptIds.includes(conceptId))
          .slice(0, maxRows)
          .map((activity) => ({
            activityId: activity.id,
            version: activity.version,
            type: activity.type,
            stem: activity.stem,
            sourceRefs: activity.sourceRefs,
            rubricId: activity.rubricId,
            rubricVersion: activity.rubricVersion,
            answerDisclosurePolicy: activity.answerDisclosurePolicy,
            inputKind: activity.answerSchema.kind,
          }));
        return { conceptId, activities };
      },
    },
    {
      name: 'edu_submit_attempt',
      description:
        'Submit one answer to a teaching session. The raw answer is persisted first; grading and evidence validation happen afterwards in the same service, and rejected evidence is never written. Mutating; idempotency key required.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['requestId', 'sessionId', 'inputType'],
        properties: {
          requestId: {
            type: 'string',
            description: 'Idempotency key; a repeated key never creates a second answer.',
            minLength: 1,
            maxLength: 128,
          },
          sessionId: text('Active education session id.'),
          activityId: text('Activity id; defaults to the current activity of the session.'),
          inputType: {
            type: 'string',
            enum: ['text', 'choice', 'diagram_label', 'relation', 'image'],
            description: 'Answer input kind; must match the activity answer schema.',
          },
          answerText: {
            type: 'string',
            description: 'Text answer (never a path).',
            minLength: 1,
            maxLength: 20000,
          },
          answerAssetId: {
            type: 'string',
            description: 'Managed asset handle for an image answer (host-owned, never a path).',
            minLength: 1,
            maxLength: 200,
          },
        },
      },
      output: outputSchema(),
      render: (_args, value) => {
        const data = value as { attemptId?: string; feedbackPending?: boolean } | null;
        return [
          {
            type: 'text',
            text: `edu_submit_attempt -> attempt=${data?.attemptId ?? '?'} feedbackPending=${String(
              data?.feedbackPending,
            )}`,
          },
        ];
      },
      async run(args, call) {
        const sessions: TutorToolSessionResolver | undefined = deps.sessions;
        if (sessions === undefined) {
          throw new TutorException(
            'UNSUPPORTED',
            'answer submission requires the tutor service binding (createTutorService)',
          );
        }
        const sessionId = args.sessionId as string;
        assertOpaque(sessionId, 'sessionId');
        const snapshot = sessions.snapshot(call.ctx, sessionId);
        if (!snapshot.ok) throwFromService(snapshot.error);
        if (!snapshot.ok) throw new Error('unreachable');
        const requestedActivityId =
          typeof args.activityId === 'string' ? args.activityId : snapshot.data.state.currentActivityId;
        if (requestedActivityId === null) {
          throw new TutorException('INVALID_INPUT', 'activityId is required when the session has no current activity');
        }
        assertOpaque(requestedActivityId, 'activityId');
        const pack = await deps.content.getPack(call.ctx, packKeyOf(deps));
        if (!pack.ok) throwFromService(pack.error);
        if (!pack.ok) throw new Error('unreachable');
        const activity = pack.data.activities.find((item) => item.id === requestedActivityId);
        if (activity === undefined) {
          throw new TutorException('NOT_FOUND', `activity ${requestedActivityId} is not in this content pack`);
        }
        const inputType = args.inputType as string;
        if (!activityInputKindMatches(activity.answerSchema, inputType)) {
          throw new TutorException(
            'INVALID_INPUT',
            `inputType ${inputType} does not match the activity answer schema ${activity.answerSchema.kind}`,
          );
        }
        const answerText = typeof args.answerText === 'string' ? args.answerText : null;
        const answerAssetId = typeof args.answerAssetId === 'string' ? args.answerAssetId : null;
        if (inputType === 'image' && answerAssetId === null) {
          throw new TutorException('INVALID_INPUT', 'image answers require answerAssetId');
        }
        if (inputType !== 'image' && (answerText === null || answerText.trim().length === 0)) {
          throw new TutorException('INVALID_INPUT', 'this answer type requires a non-empty answerText');
        }
        if (answerAssetId !== null) assertOpaque(answerAssetId, 'answerAssetId');

        checkCancelled(call.ctx.signal, 'answer submission');
        const committed = await sessions.commitAttempt(call.ctx, {
          sessionId,
          activityId: requestedActivityId,
          inputType: inputType as 'text' | 'choice' | 'diagram_label' | 'relation' | 'image',
          answerText,
          answerAssetId,
        });
        checkCancelled(call.ctx.signal, 'answer submission');
        if (!committed.ok) throwFromService(committed.error);
        if (!committed.ok) throw new Error('unreachable');
        const outcome: TutorAttemptOutcome = committed.data;
        return {
          attemptId: outcome.attemptId,
          persisted: outcome.persisted,
          duplicate: outcome.duplicate,
          feedbackPending: outcome.feedbackPending,
          feedback: outcome.grade?.feedback ?? null,
          criteria: outcome.grade?.criteria ?? [],
          sources: outcome.grade?.sourceRefs ?? [],
          outcomes: outcome.outcomes.map((item) => ({
            conceptId: item.conceptId,
            kind: item.kind,
            state: item.derivedState,
            rationale: item.rationale,
            assessmentId: item.assessment?.id ?? null,
            duplicate: item.duplicate,
          })),
          rejectedCandidates: summariseRejections(outcome.rejectedCandidates),
          assistNote:
            outcome.grade === null
              ? '本轮没有可提交的证据；可重试批改'
              : 'assisted 证据不充作独立掌握证据',
        };
      },
    },
    {
      name: 'edu_get_feedback_rubric',
      description:
        'Read the rubric used to grade one activity (criteria, acceptable evidence, common misconceptions, counter examples, transfer items, feedback source refs). Read-only.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['activityId'],
        properties: {
          activityId: text('Activity id from the current content pack.'),
          requestId: OPTIONAL_REQUEST_ID,
        },
      },
      output: outputSchema(),
      render: (_args, value) => {
        const data = value as { rubricId?: string; criteria?: readonly unknown[] } | null;
        return [
          {
            type: 'text',
            text: `edu_get_feedback_rubric -> ${data?.rubricId ?? 'rubric'} (${data?.criteria?.length ?? 0} criteria)`,
          },
        ];
      },
      async run(args, call) {
        const activityId = args.activityId as string;
        assertOpaque(activityId, 'activityId');
        const pack = await deps.content.getPack(call.ctx, packKeyOf(deps));
        if (!pack.ok) throwFromService(pack.error);
        if (!pack.ok) throw new Error('unreachable');
        const activity = pack.data.activities.find((item) => item.id === activityId);
        if (activity === undefined) {
          throw new TutorException('NOT_FOUND', `activity ${activityId} is not in this content pack`);
        }
        const rubric = pack.data.rubrics.find((item) => item.id === activity.rubricId);
        if (rubric === undefined) {
          throw new TutorException('NOT_FOUND', `rubric ${activity.rubricId} is missing from the content pack`);
        }
        return {
          activityId,
          rubricId: rubric.id,
          version: rubric.version,
          rubricVersion: activity.rubricVersion,
          conceptIds: rubric.conceptIds,
          criteria: rubric.criteria.map((criterion) => ({
            criterionId: criterion.criterionId,
            description: criterion.description,
            acceptableEvidence: criterion.acceptableEvidence,
            commonMisconceptions: criterion.commonMisconceptions,
            counterExamples: criterion.counterExamples,
            transferItems: criterion.transferItems,
            feedbackSourceRefs: criterion.feedbackSourceRefs,
          })),
        };
      },
    },
    {
      name: 'edu_progress_summary',
      description:
        'Read the learner three-axis summary for the bound content pack: learning state, understanding state/validity, review due, review queue. Returns activity coverage only — never a mastery percentage. Read-only.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          conceptIds: {
            type: 'array',
            description: 'Optional subset of concept ids; defaults to every concept in the pack.',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 200,
          },
          requestId: OPTIONAL_REQUEST_ID,
        },
      },
      output: outputSchema(),
      render: (_args, value) => {
        const data = value as { activityCoverage?: { numerator?: number; denominator?: number } } | null;
        return [
          {
            type: 'text',
            text: `edu_progress_summary -> activity coverage ${data?.activityCoverage?.numerator ?? 0}/${data?.activityCoverage?.denominator ?? 0} (not mastery)`,
          },
        ];
      },
      async run(args, call) {
        const pack = await deps.content.getPack(call.ctx, packKeyOf(deps));
        if (!pack.ok) throwFromService(pack.error);
        if (!pack.ok) throw new Error('unreachable');
        const allConceptIds = pack.data.concepts.map((concept) => concept.id);
        const requested = Array.isArray(args.conceptIds)
          ? (args.conceptIds as unknown[]).map((value) => String(value))
          : allConceptIds;
        for (const conceptId of requested) {
          assertOpaque(conceptId, 'conceptIds[]');
          if (!allConceptIds.includes(conceptId)) {
            throw new TutorException('NOT_FOUND', `concept ${conceptId} is not in this content pack`);
          }
        }
        const listed = await deps.learner.list(call.ctx, {
          learnerId: deps.learnerId,
          courseEditionId: deps.packKey.courseEditionId,
          packVersion: deps.packKey.packVersion,
          conceptIds: requested,
        });
        if (!listed.ok) throwFromService(listed.error);
        if (!listed.ok) throw new Error('unreachable');
        const queue = await deps.learner.reviewQueue(call.ctx, {
          now: call.ctx.now,
          limit: maxRows,
        });
        if (!queue.ok) throwFromService(queue.error);
        if (!queue.ok) throw new Error('unreachable');
        const byConcept = new Map(listed.data.map((progress) => [progress.conceptId, progress]));
        const nowMs = Date.parse(call.ctx.now);
        const concepts = requested.map((conceptId) => {
          const progress = byConcept.get(conceptId);
          const dueAt = progress?.review.dueAt ?? null;
          return {
            conceptId,
            learning: progress?.learning.state ?? ('not_started' as const),
            understanding: progress?.understanding.state ?? ('unassessed' as const),
            understandingValidity: progress?.understanding.validity ?? ('current' as const),
            reviewDue: dueAt !== null && nowMs >= Date.parse(dueAt),
            dueAt,
          };
        });
        const completed = concepts.filter((concept) => concept.learning === 'completed').length;
        const denominator = concepts.length;
        const summary: TutorProgressSummary = {
          courseEditionId: deps.packKey.courseEditionId,
          packVersion: deps.packKey.packVersion,
          activityCoverage: {
            numerator: completed,
            denominator,
            percent: denominator === 0 ? null : Math.round((completed / denominator) * 100),
            label: 'activity_coverage_not_mastery',
          },
          concepts,
          reviewQueue: queue.data.slice(0, maxRows),
          note: '这是学习活动覆盖，不是掌握百分比；理解判断需打开证据查看版本与理由。',
        };
        return summary;
      },
    },
  ];

  const responses = new Map<string, ToolCallOutcome>();

  function resolveCall(name: string, args: unknown, context: ToolCallContext): ResolvedCall {
    const record = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>;
    const requestId =
      typeof record.requestId === 'string' && record.requestId.trim().length > 0
        ? record.requestId
        : context.requestId;
    if (requestId.trim().length === 0) {
      throw new TutorException('INVALID_INPUT', 'requestId must not be empty');
    }
    const signal = context.signal;
    checkCancelled(signal, name);
    checkTimeout(context);
    return {
      rawArgs: args,
      requestId,
      ctx: {
        requestId,
        learnerId: deps.learnerId,
        now: deps.clock.now(),
        ...(signal === undefined ? {} : { signal }),
        ...(context.timeoutMs === undefined ? {} : { timeoutMs: context.timeoutMs }),
      },
    };
  }

  async function call(
    name: string,
    args: unknown,
    context: ToolCallContext,
  ): Promise<ToolCallOutcome> {
    const spec = specs.find((item) => item.name === name);
    if (spec === undefined) {
      if (FORBIDDEN_TOOL_NAMES.includes(name)) {
        audit('permission.denied', name, 'tool is not available in the education profile');
      }
      const error = tutorError('UNKNOWN_TOOL', `unknown tool: ${name}`);
      audit('tool.rejected', name, error.message);
      return {
        tool: name,
        requestId: context.requestId,
        ok: false,
        value: null,
        error,
        duplicate: false,
      };
    }

    const validated = validateToolArguments(spec.parameters, args);
    if (!validated.ok) {
      const error = tutorError(
        'INVALID_INPUT',
        `invalid arguments for ${name}: ${formatIssues(validated.issues)}`,
      );
      audit('tool.rejected', name, error.message);
      return { tool: name, requestId: context.requestId, ok: false, value: null, error, duplicate: false };
    }

    let resolved: ResolvedCall;
    try {
      resolved = resolveCall(name, validated.value, context);
    } catch (error) {
      const mapped = errorFromThrown(error);
      audit('tool.rejected', name, mapped.message);
      return { tool: name, requestId: context.requestId, ok: false, value: null, error: mapped, duplicate: false };
    }

    const cacheKey = `${name}|${resolved.requestId}`;
    const cached = responses.get(cacheKey);
    if (cached !== undefined) {
      return { ...cached, duplicate: true };
    }

    let outcome: ToolCallOutcome;
    try {
      const value = await spec.run(validated.value, resolved);
      outcome = {
        tool: name,
        requestId: resolved.requestId,
        ok: true,
        value,
        error: null,
        duplicate: false,
      };
      audit('tool.called', name, 'tool executed within the education allowlist', {
        requestId: resolved.requestId,
      });
    } catch (error) {
      const mapped = errorFromThrown(error);
      outcome = {
        tool: name,
        requestId: resolved.requestId,
        ok: false,
        value: null,
        error: mapped,
        duplicate: false,
      };
      audit('tool.rejected', name, mapped.message, { code: mapped.code });
    }
    responses.set(cacheKey, outcome);
    return outcome;
  }

  const definitions: readonly EducationToolDefinition[] = specs.map((spec) => ({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
    output: {
      schema: spec.output,
      render: (args: unknown, value: unknown) =>
        spec.render(args, value) as readonly { type: 'text'; text: string }[],
    },
    async execute(args: unknown, context?: unknown): Promise<unknown> {
      const fallbackRequestId = `tool-${deps.ids.next('request')}`;
      const toolContext = adaptToolCallContext(context, fallbackRequestId);
      const outcome = await call(spec.name, args, toolContext);
      if (!outcome.ok) {
        const error = outcome.error ?? tutorError('UNSUPPORTED', 'tool failed');
        throw new TutorException(error.code, error.message, error.retryable, error.detailsRef);
      }
      return outcome.value;
    },
  }));

  return {
    names: specs.map((spec) => spec.name),
    definitions,
    has(name: string) {
      return specs.some((spec) => spec.name === name);
    },
    call,
    register(host: ToolHost) {
      for (const definition of definitions) host.tools.register(definition);
    },
  };
}

export function registerEducationTools(host: ToolHost, deps: TutorToolDependencies): EducationToolRegistry {
  const registry = createEducationToolRegistry(deps);
  registry.register(host);
  return registry;
}

export type { KnowledgePort, HelpKind, Id, Timestamp };
