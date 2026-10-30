/**
 * T15 rerun — A14 review-mode turn through the real G1 HTTP route.
 *
 * Boots the isolated education web host (composeEducationRuntime + real DSH),
 * starts a review session, sends one recall turn, then completes the review and
 * records the resulting outcome (expected: "复习完成但仍需巩固" when the recall
 * is weak).
 *
 * Usage: node education/tests/education/rerun-review.mjs <runDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupEducationHome } from '../../runtime/scripts/setup-education-home.mjs';
import { startEducationWeb } from '../../runtime/scripts/start-education-web.mjs';
import { openEducationHost, readAudit } from './web-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(process.argv[2] ?? join(here, '..', '..', '.local', 'evidence', 'T15', 'rerun-review'));
mkdirSync(runDir, { recursive: true });
const home = join(runDir, 'home');
const webOut = join(runDir, 'web');
setupEducationHome(home);
const meta = await startEducationWeb({ home, out: webOut, timeoutMs: 120000 });
const client = await openEducationHost(meta);
const evidence = { port: meta.port, authKeyPresent: meta.authKeyPresent };

try {
  const start = await client.post('/edu/api/g1/tutor/start', {
    requestId: `review-start-${Date.now()}`,
    conceptId: 'concept.bio7a.observation.meaning',
    mode: 'review',
  });
  const sessionId = start.json?.data?.session?.id;
  const revision = start.json?.data?.state?.revision ?? 0;
  evidence.start = { status: start.status, sessionId, revision, mode: start.json?.data?.session?.mode };

  const turn = await client.post('/edu/api/g1/tutor/turn', {
    requestId: `review-turn-${Date.now()}`,
    sessionId,
    revision,
    attempt: {
      activityId: 'activity.bio7a.c1.choice-basics',
      inputType: 'choice',
      answerText: JSON.stringify(['option.a']),
    },
  });
  evidence.turn = {
    status: turn.status,
    durationMs: turn.durationMs,
    ok: turn.json?.ok,
    code: turn.json?.error?.code ?? null,
    message: turn.json?.data?.message ?? null,
    decision: turn.json?.data?.decision ?? null,
    revision: turn.json?.data?.revision ?? null,
    stateRevision: turn.json?.data?.state?.revision ?? null,
    turnRevision: turn.json?.data?.revision ?? null,
  };

  const candidates = [
    turn.json?.data?.state?.revision ?? null,
    turn.json?.data?.revision ?? null,
    (turn.json?.data?.state?.revision ?? 0) + 1,
    (turn.json?.data?.state?.revision ?? 0) + 2,
  ].filter((value) => typeof value === 'number');
  evidence.finishAttempts = [];
  let finishResult = null;
  let usedRevision = null;
  for (const candidate of [...new Set(candidates)]) {
    const finish = await client.post('/edu/api/g1/tutor/finish-review', {
      requestId: `review-finish-${candidate}-${Date.now()}`,
      sessionId,
      revision: candidate,
      outcome: 'needs_support',
    });
    evidence.finishAttempts.push({ revision: candidate, status: finish.status, ok: finish.json?.ok, code: finish.json?.error?.code ?? null });
    if (finish.json?.ok === true) {
      finishResult = finish;
      usedRevision = candidate;
      break;
    }
  }
  evidence.finishRevisionUsed = usedRevision;
  evidence.finish = finishResult === null
    ? { status: null, ok: false, code: evidence.finishAttempts.at(-1)?.code ?? 'UNKNOWN', data: null }
    : { status: finishResult.status, ok: finishResult.json?.ok, code: null, data: finishResult.json?.data ?? null };
  console.log(JSON.stringify({ turnOk: evidence.turn.ok, decision: evidence.turn.decision?.action, finish: evidence.finish.ok, outcome: evidence.finish.data?.outcome }));
} finally {
  writeFileSync(join(runDir, 'review-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  writeFileSync(join(runDir, 'runtime-audit.json'), `${JSON.stringify(readAudit(join(webOut, 'runtime.jsonl')), null, 2)}\n`, 'utf8');
  const stopped = spawnSync(process.execPath, [join(here, '..', '..', 'runtime', 'scripts', 'stop-education-web.mjs'), '--out', webOut], { encoding: 'utf8' });
  console.log(JSON.stringify({ stopped: stopped.status === 0 }));
}
