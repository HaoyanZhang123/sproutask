/**
 * T15 rerun — find the revision finish-review accepts (no model calls).
 * Boots the host, submits one graded review attempt, then tries revisions 0..12.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupEducationHome } from '../../runtime/scripts/setup-education-home.mjs';
import { startEducationWeb } from '../../runtime/scripts/start-education-web.mjs';
import { openEducationHost } from './web-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(process.argv[2]);
mkdirSync(runDir, { recursive: true });
const home = join(runDir, 'home');
const webOut = join(runDir, 'web');
setupEducationHome(home);
const meta = await startEducationWeb({ home, out: webOut, timeoutMs: 120000 });
const client = await openEducationHost(meta);
const out = { attempts: [] };
try {
  const start = await client.post('/edu/api/g1/tutor/start', {
    requestId: `rev-start-${Date.now()}`,
    conceptId: 'concept.bio7a.observation.meaning',
    mode: 'review',
  });
  const sessionId = start.json?.data?.session?.id;
  const revision = start.json?.data?.state?.revision ?? 0;
  const turn = await client.post('/edu/api/g1/tutor/turn', {
    requestId: `rev-turn-${Date.now()}`,
    sessionId,
    revision,
    attempt: { activityId: 'activity.bio7a.c1.choice-basics', inputType: 'choice', answerText: JSON.stringify(['option.a']) },
  });
  out.turn = { ok: turn.json?.ok, dataRevision: turn.json?.data?.revision ?? null, stateRevision: turn.json?.data?.state?.revision ?? null, durationMs: turn.durationMs };
  for (let candidate = 0; candidate <= 12; candidate += 1) {
    const finish = await client.post('/edu/api/g1/tutor/finish-review', {
      requestId: `rev-finish-${candidate}-${Date.now()}`,
      sessionId,
      revision: candidate,
      outcome: 'needs_support',
    });
    out.attempts.push({ revision: candidate, ok: finish.json?.ok, code: finish.json?.error?.code ?? null, data: finish.json?.data ?? null });
    if (finish.json?.ok === true) break;
  }
  console.log(JSON.stringify(out, null, 1).slice(0, 2000));
} finally {
  writeFileSync(join(runDir, 'finish-revision-probe.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  spawnSync(process.execPath, [join(here, '..', '..', 'runtime', 'scripts', 'stop-education-web.mjs'), '--out', webOut], { encoding: 'utf8' });
}
