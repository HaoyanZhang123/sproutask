import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { composeEducationRuntime, G1Service } from '../../runtime/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const workspaceRoot = educationRoot;

const roots: string[] = [];

function dataRoot(label: string): string {
  const root = path.join(os.tmpdir(), `edu-t13-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function openComposition(root: string) {
  const result = await composeEducationRuntime({
    workspaceRoot,
    dataRoot: root,
    env: {} as NodeJS.ProcessEnv,
  });
  if (!result.ok) throw new Error(`composition failed: ${JSON.stringify(result.error)}`);
  return { composition: result.data, g1: new G1Service(result.data, workspaceRoot) };
}

describe('T13 G1 integration (real knowledge / learner / storage)', () => {
  it('reads the real published pack through library/map/study without fixture data', async () => {
    const root = dataRoot('read');
    const { composition, g1 } = await openComposition(root);
    try {
      const library = g1.library();
      expect(library.ok).toBe(true);
      if (library.ok) {
        expect(library.data.materialState).toBe('candidate');
        // Derived from the pack snapshot, not a constant: pack.json is published.
        expect(library.data.trustMode).toBe('published');
        expect(library.data.pageCount).toBeGreaterThan(100);
        expect(String(library.data.title).length).toBeGreaterThan(0);
      }

      const map = await g1.map();
      expect(map.ok).toBe(true);
      if (map.ok) {
        expect(map.data['fixture']).toBe(false);
        expect(map.data['packVersion']).toBe('2.0.0');
        expect(map.data['trustMode']).toBe('published');
        expect((map.data['concepts'] as unknown[]).length).toBeGreaterThan(0);
        expect((map.data['toc'] as unknown[]).length).toBeGreaterThan(0);
      }

      const mapData = map.ok ? map.data : null;
      const firstConcept = (mapData?.['concepts'] as { id: string }[] | undefined)?.[0];
      expect(firstConcept).toBeDefined();
      if (firstConcept === undefined) return;
      const study = await g1.study(firstConcept.id);
      expect(study.ok).toBe(true);
      if (study.ok) {
        expect(study.data['fixture']).toBe(false);
        expect(study.data['trustMode']).toBe('published');
        expect((study.data['activities'] as unknown[]).length).toBeGreaterThan(0);
        expect(study.data['concept']).toMatchObject({ id: firstConcept.id });
      }

      const pack = await composition.knowledge.getPack(
        { requestId: 't13.pack', learnerId: 'learner.local.default', now: composition.clock.now() },
        composition.packKey,
      );
      expect(pack.ok).toBe(true);
      if (pack.ok) {
        const sourceRefId = pack.data.concepts[0]?.sourceRefs[0];
        expect(sourceRefId).toBeDefined();
        if (sourceRefId !== undefined) {
          const source = await composition.content.resolveSource(
            { requestId: 't13.source', learnerId: 'learner.local.default', now: composition.clock.now() },
            sourceRefId,
          );
          expect(source.ok).toBe(true);
          if (source.ok) {
            expect(source.data.pdfPage).toBeGreaterThanOrEqual(1);
            expect(source.data.sourceRef.id).toBe(sourceRefId);
            expect(source.data.sourceRef.bookInstanceId).not.toBeNull();
          }
        }
      }

      expect(composition.tools.names).toEqual([
        'edu_get_concept',
        'edu_resolve_source',
        'edu_list_activities',
        'edu_submit_attempt',
        'edu_get_feedback_rubric',
        'edu_progress_summary',
      ]);
      expect(composition.tools.names).not.toContain('bash');
      expect(composition.tools.names).not.toContain('read_file');
      expect(composition.tools.names).not.toContain('run_code');
    } finally {
      composition.close();
    }
  });

  it('keeps formal understanding unassessed on self-report while recording drafts and self-report', async () => {
    const root = dataRoot('candidate');
    const first = await openComposition(root);
    let conceptId = '';
    let activityId = '';
    try {
      const map = await first.g1.map();
      if (!map.ok) throw new Error('map failed');
      conceptId = (map.data['concepts'] as { id: string }[])[0]?.id ?? '';
      expect(conceptId.length).toBeGreaterThan(0);
      const study = await first.g1.study(conceptId);
      if (!study.ok) throw new Error('study failed');
      activityId = (study.data['activities'] as { id: string }[])[0]?.id ?? '';
      expect(activityId.length).toBeGreaterThan(0);

      const saved = await first.g1.saveDraft(
        {
          conceptId,
          mode: 'learn',
          activityId,
          answer: { kind: 'text', text: '鎴戠殑鑽夌' },
          savedAt: first.composition.clock.now(),
        },
        't13.draft.1',
      );
      expect(saved.ok).toBe(true);

      const selfReport = await first.g1.saveSelfReport(conceptId, 'can_explain', 't13.self-report.1');
      expect(selfReport.ok).toBe(true);
      const progress = await first.g1.progress(conceptId);
      expect(progress.ok).toBe(true);
      if (progress.ok) {
        const value = progress.data as {
          understanding: { state: string };
        };
        expect(value.understanding.state).toBe('unassessed');
      }
    } finally {
      first.composition.close();
    }

    const reopened = await openComposition(root);
    try {
      const draft = await reopened.g1.loadDraft({
        conceptId,
        mode: 'learn',
        activityId,
      });
      expect(draft.ok).toBe(true);
      if (draft.ok) {
        expect(draft.data?.answer).toEqual({ kind: 'text', text: '鎴戠殑鑽夌' });
      }
    } finally {
      reopened.composition.close();
    }
  });

  it('uses the real visuals rule grader for a text activity and a diagram activity', async () => {
    const root = dataRoot('grade');
    const { composition } = await openComposition(root);
    try {
      const ctx = {
        requestId: 't13.grade',
        learnerId: 'learner.local.default',
        now: composition.clock.now(),
      };
      const pack = await composition.knowledge.getPack(ctx, composition.packKey);
      expect(pack.ok).toBe(true);
      if (!pack.ok) return;
      const textActivity = pack.data.activities.find((activity) => activity.type === 'transfer' || activity.type === 'explain');
      expect(textActivity).toBeDefined();
      if (textActivity !== undefined) {
        const rubric = pack.data.rubrics.find((entry) => entry.id === textActivity.rubricId);
        expect(rubric).toBeDefined();
        if (rubric !== undefined) {
          const graded = await composition.grade.grade(ctx, {
            attempt: {
              schemaVersion: 1,
              id: 'attempt.t13.text',
              requestId: 't13.text',
              learnerId: 'learner.local.default',
              sessionId: 'session.t13',
              courseEditionId: pack.data.courseEditionId,
              packVersion: pack.data.version,
              activityId: textActivity.id,
              activityVersion: textActivity.version,
              conceptIds: [...textActivity.conceptIds],
              inputType: 'text',
              answerAssetId: null,
              answerText: textActivity.stem,
              submittedAt: composition.clock.now(),
              helpUsed: [],
              evidenceIds: [],
            },
            activity: textActivity,
            rubric,
            mode: 'rule',
            modelRunId: null,
          });
          expect(graded.ok).toBe(true);
          if (graded.ok) expect(graded.data.graderVersion).toContain('rule');
        }
      }
      const diagramActivity = pack.data.activities.find((activity) => activity.type === 'diagram_label');
      expect(diagramActivity).toBeDefined();
      if (diagramActivity !== undefined) {
        const rubric = pack.data.rubrics.find((entry) => entry.id === diagramActivity.rubricId);
        if (rubric !== undefined) {
          const targets = diagramActivity.answerSchema.kind === 'diagram_label'
            ? diagramActivity.answerSchema.targets
            : [];
          const graded = await composition.grade.grade(ctx, {
            attempt: {
              schemaVersion: 1,
              id: 'attempt.t13.diagram',
              requestId: 't13.diagram',
              learnerId: 'learner.local.default',
              sessionId: 'session.t13',
              courseEditionId: pack.data.courseEditionId,
              packVersion: pack.data.version,
              activityId: diagramActivity.id,
              activityVersion: diagramActivity.version,
              conceptIds: [...diagramActivity.conceptIds],
              inputType: 'diagram_label',
              answerAssetId: null,
              answerText: JSON.stringify({
                labels: targets.map((target) => ({ targetId: target.id, text: target.label })),
              }),
              submittedAt: composition.clock.now(),
              helpUsed: [],
              evidenceIds: [],
            },
            activity: diagramActivity,
            rubric,
            mode: 'rule',
            modelRunId: null,
          });
          expect(graded.ok).toBe(true);
        }
      }
    } finally {
      composition.close();
    }
  });

  it('rejects a tool outside the education allowlist without executing it', async () => {
    const root = dataRoot('tools');
    const { composition } = await openComposition(root);
    try {
      const outcome = await composition.tools.call(
        'bash',
        { command: 'Get-ChildItem C:\\' },
        { requestId: 't13.bash' },
      );
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error?.code).toBe('UNKNOWN_TOOL');
      }
    } finally {
      composition.close();
    }
  });
});



