/**
 * Education tool factory tests (T07 card: six tools, runtime schema validation,
 * idempotency, cancellation/timeout, structured errors, host registration).
 */

import { describe, expect, it } from 'vitest';
import {
  EDUCATION_TOOL_NAMES,
  FORBIDDEN_TOOL_NAMES,
  createEducationToolRegistry,
  type ToolHost,
} from '../src/index.js';
import {
  FakeLearner,
  createKnowledgeHarness,
  createSequentialIds,
  met,
  startHarness,
} from './helpers.js';

describe('education tool allowlist', () => {
  it('exposes exactly the six declared tools and registers them as plain DSH definitions', async () => {
    const { service } = await startHarness({
      turns: [{ text: 'ok', grade: met(), signals: {}, evidenceCandidates: [] }],
    });
    expect([...service.tools.names]).toEqual([...EDUCATION_TOOL_NAMES]);
    expect(service.tools.has('edu_get_concept')).toBe(true);
    expect(service.tools.has('bash')).toBe(false);

    const registered: string[] = [];
    const host: ToolHost = {
      tools: {
        register(definition) {
          registered.push(definition.name);
          expect(typeof definition.description).toBe('string');
          expect(definition.parameters.type).toBe('object');
          expect(definition.parameters.additionalProperties).toBe(false);
          expect(Array.isArray(definition.parameters.required)).toBe(true);
          expect(typeof definition.output.schema.type).toBe('string');
          expect(typeof definition.output.render).toBe('function');
          expect(typeof definition.execute).toBe('function');
          expect(FORBIDDEN_TOOL_NAMES).not.toContain(definition.name);
        },
      },
    };
    service.tools.register(host);
    expect(registered).toEqual([...EDUCATION_TOOL_NAMES]);
  });

  it('rejects unknown and dangerous tool names with `unknown tool` and a permission audit', async () => {
    const { service } = await startHarness({
      turns: [{ text: 'ok', grade: met(), signals: {}, evidenceCandidates: [] }],
    });
    const unknown = await service.tools.call(
      'bash',
      { command: 'Get-ChildItem C:\\' },
      { requestId: 'deny-1' },
    );
    expect(unknown.ok).toBe(false);
    expect(unknown.error?.code).toBe('UNKNOWN_TOOL');
    expect(unknown.error?.message).toBe('unknown tool: bash');
    expect(unknown.value).toBeNull();
    const audits = service.auditEvents();
    expect(audits.some((event) => event.kind === 'permission.denied' && event.subject === 'bash')).toBe(true);
    expect(audits.some((event) => event.kind === 'tool.rejected')).toBe(true);
  });
});

describe('read-only tools', () => {
  it('edu_get_concept returns the concept, relations and three-axis progress without paths', async () => {
    const { service } = await startHarness({
      turns: [{ text: 'ok', grade: met(), signals: {}, evidenceCandidates: [] }],
    });
    const outcome = await service.tools.call(
      'edu_get_concept',
      { conceptId: 'concept.cell' },
      { requestId: 'concept-1' },
    );
    expect(outcome.ok).toBe(true);
    const value = outcome.value as {
      concept: { id: string; title: string; sourceRefs: string[] };
      relations: readonly unknown[];
      progress: { learning: { state: string } } | null;
    };
    expect(value.concept.id).toBe('concept.cell');
    expect(value.concept.sourceRefs.length).toBeGreaterThan(0);
    expect(value.relations.length).toBeGreaterThan(0);
    expect(value.progress?.learning.state).toBe('in_progress');
    expect(JSON.stringify(value)).not.toMatch(/[A-Za-z]:\\/);
  });

  it('edu_resolve_source resolves a controlled location and never returns a path', async () => {
    const { service } = await startHarness({
      turns: [{ text: 'ok', grade: met(), signals: {}, evidenceCandidates: [] }],
    });
    const outcome = await service.tools.call(
      'edu_resolve_source',
      { sourceRefId: 'source.p18' },
      { requestId: 'source-1' },
    );
    expect(outcome.ok).toBe(true);
    const value = outcome.value as { pdfPage: number; printedPage: string | null; bbox: unknown };
    expect(value.pdfPage).toBe(18);
    expect(value.printedPage).toBeNull();
    expect(value.bbox).toBeNull();
    expect(JSON.stringify(value)).not.toMatch(/[A-Za-z]:\\/);
  });

  it('edu_list_activities and edu_get_feedback_rubric read the bound pack', async () => {
    const { service } = await startHarness({
      turns: [{ text: 'ok', grade: met(), signals: {}, evidenceCandidates: [] }],
    });
    const activities = await service.tools.call(
      'edu_list_activities',
      { conceptId: 'concept.cell' },
      { requestId: 'list-1' },
    );
    expect(activities.ok).toBe(true);
    const listed = activities.value as {
      activities: readonly { activityId: string; rubricVersion: string }[];
    };
    expect(listed.activities.length).toBeGreaterThanOrEqual(2);

    const rubric = await service.tools.call(
      'edu_get_feedback_rubric',
      { activityId: 'activity.cell-explain' },
      { requestId: 'rubric-1' },
    );
    expect(rubric.ok).toBe(true);
    const value = rubric.value as { rubricId: string; criteria: readonly { criterionId: string }[] };
    expect(value.rubricId).toBe('rubric.cell');
    expect(value.criteria[0]?.criterionId).toBe('criterion.cell.identify');
  });

  it('edu_progress_summary reports activity coverage only (never a mastery percentage)', async () => {
    const { service } = await startHarness({
      turns: [{ text: 'ok', grade: met(), signals: {}, evidenceCandidates: [] }],
    });
    const outcome = await service.tools.call(
      'edu_progress_summary',
      { conceptIds: ['concept.cell'] },
      { requestId: 'progress-1' },
    );
    expect(outcome.ok).toBe(true);
    const value = outcome.value as {
      activityCoverage: { label: string; numerator: number; denominator: number; percent: number | null };
      note: string;
      concepts: readonly { conceptId: string }[];
    };
    expect(value.activityCoverage.label).toBe('activity_coverage_not_mastery');
    expect(value.activityCoverage.denominator).toBe(1);
    expect(value.concepts[0]?.conceptId).toBe('concept.cell');
    expect(value.note).toContain('不是掌握百分比');
  });
});

describe('argument validation and permissions', () => {
  async function harness() {
    return startHarness({
      turns: [
        {
          text: 'ok',
          grade: met(),
          signals: { answerQuality: 'correct' },
          evidenceCandidates: [
            {
              conceptId: 'concept.cell',
              kind: 'explain',
              observation: 'synthetic tool fixture observation',
              criterionResults: [{ criterionId: 'criterion.cell.identify', result: 'met', note: null }],
              assistance: 'unassisted',
              sourceRefs: ['source.p18'],
              assessmentOrigin: 'model',
              modelRunId: 'mock-run-1',
              uncertainty: 0.2,
            },
          ],
        },
      ],
    });
  }

  it('rejects unknown fields before any service call', async () => {
    const { service } = await harness();
    const outcome = await service.tools.call(
      'edu_get_concept',
      { conceptId: 'concept.cell', learnerId: 'learner.other' },
      { requestId: 'unknown-field-1' },
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.code).toBe('INVALID_INPUT');
    expect(outcome.error?.message).toContain('learnerId');
    expect(outcome.error?.message).toContain('unknown field');
  });

  it('rejects path-shaped source refs and activity ids', async () => {
    const { service } = await harness();
    const pathSource = await service.tools.call(
      'edu_resolve_source',
      { sourceRefId: 'C:\\Users\\other\\book.pdf' },
      { requestId: 'path-source-1' },
    );
    expect(pathSource.ok).toBe(false);
    expect(pathSource.error?.code).toBe('INVALID_INPUT');

    const pathActivity = await service.tools.call(
      'edu_get_feedback_rubric',
      { activityId: '../../etc/passwd' },
      { requestId: 'path-activity-1' },
    );
    expect(pathActivity.ok).toBe(false);
    expect(pathActivity.error?.code).toBe('INVALID_INPUT');
  });

  it('rejects a session from another learner / unknown session', async () => {
    const { service } = await harness();
    const outcome = await service.tools.call(
      'edu_submit_attempt',
      {
        requestId: 'other-session-1',
        sessionId: 'session.other.learner',
        inputType: 'text',
        answerText: '细胞是基本单位。',
      },
      { requestId: 'other-session-1' },
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.code).toBe('NOT_FOUND');
  });

  it('submits through the teaching service, persists first and dedupes repeated request ids', async () => {
    const { service, learner, session } = await harness();
    const args = {
      requestId: 'submit-idem-1',
      sessionId: session.id,
      activityId: 'activity.cell-explain',
      inputType: 'text',
      answerText: '细胞是生物体结构和功能的基本单位。',
    };
    const first = await service.tools.call('edu_submit_attempt', args, { requestId: 'submit-idem-1' });
    expect(first.ok).toBe(true);
    const value = first.value as { attemptId: string; persisted: boolean; outcomes: readonly unknown[] };
    expect(value.persisted).toBe(true);
    expect(value.outcomes.length).toBe(1);
    expect(learner.count('submitAttempt')).toBe(1);
    expect(learner.count('recordGradedAttempt')).toBe(1);

    const second = await service.tools.call('edu_submit_attempt', args, { requestId: 'submit-idem-1' });
    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(learner.count('submitAttempt')).toBe(1);
    expect(learner.count('recordGradedAttempt')).toBe(1);
  });

  it('honours cancellation and timeout with structured errors', async () => {
    const { service, learner } = await harness();
    const cancelledSignal = { cancelled: true, onCancel: () => () => undefined };
    const cancelled = await service.tools.call(
      'edu_get_concept',
      { conceptId: 'concept.cell' },
      { requestId: 'cancel-1', signal: cancelledSignal },
    );
    expect(cancelled.ok).toBe(false);
    expect(cancelled.error?.code).toBe('CANCELLED');

    const timedOut = await service.tools.call(
      'edu_get_concept',
      { conceptId: 'concept.cell' },
      { requestId: 'timeout-1', timeoutMs: 0 },
    );
    expect(timedOut.ok).toBe(false);
    expect(timedOut.error?.code).toBe('TIMEOUT');
    expect(timedOut.error?.retryable).toBe(true);
    expect(learner.count('submitAttempt')).toBe(0);
  });
});

describe('tool registry construction', () => {
  it('can be created directly without a teaching session for read-only tools', async () => {
    const { knowledge } = createKnowledgeHarness();
    const registry = createEducationToolRegistry({
      content: knowledge,
      learner: new FakeLearner(),
      clock: { now: () => '2026-10-29T08:00:00Z' },
      ids: createSequentialIds(),
      learnerId: 'learner.t07.fixture',
      packKey: { courseEditionId: 'course.biology-7a', packVersion: '1.0.0' },
    });
    const concept = await registry.call(
      'edu_get_concept',
      { conceptId: 'concept.cell' },
      { requestId: 'direct-1' },
    );
    expect(concept.ok).toBe(true);
    const value = concept.value as { progress: { learning: { state: string } } | null };
    expect(value.progress?.learning.state).toBe('not_started');

    const submit = await registry.call(
      'edu_submit_attempt',
      { requestId: 'direct-submit', sessionId: 'session.direct', inputType: 'text', answerText: 'x' },
      { requestId: 'direct-submit' },
    );
    expect(submit.ok).toBe(false);
    expect(submit.error?.code).toBe('UNSUPPORTED');
  });
});
