/**
 * T15 retry probe: one more real tutor turn through the G1 HTTP route with a
 * different learner message, to decide whether the "no assistant text" failure
 * is deterministic before choosing the evaluation route.
 *
 * Usage: node education/tests/education/pilot2.mjs <runDir> [message]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupEducationHome } from '../../runtime/scripts/setup-education-home.mjs';
import { startEducationWeb } from '../../runtime/scripts/start-education-web.mjs';
import { openEducationHost, readAudit } from './web-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(process.argv[2]);
const message = process.argv[3] ?? '什么是观察？请用一句话说明。';
mkdirSync(runDir, { recursive: true });
const home = join(runDir, 'home');
const webOut = join(runDir, 'web');
setupEducationHome(home);
const meta = await startEducationWeb({ home, out: webOut, timeoutMs: 120000 });
const client = await openEducationHost(meta);
const evidence = { message, port: meta.port };
try {
  const study = await client.get('/edu/api/g1/study?conceptId=concept.bio7a.observation.meaning');
  evidence.studyStatus = study.status;
  const start = await client.post('/edu/api/g1/tutor/start', {
    requestId: `pilot2-start-${Date.now()}`,
    conceptId: 'concept.bio7a.observation.meaning',
    mode: 'learn',
  });
  const sessionId = start.json?.data?.session?.id;
  const revision = start.json?.data?.state?.revision ?? 0;
  evidence.start = { status: start.status, sessionId, revision };
  const turn = await client.post('/edu/api/g1/tutor/turn', {
    requestId: `pilot2-turn-${Date.now()}`,
    sessionId,
    revision,
    message,
  });
  evidence.turn = { status: turn.status, durationMs: turn.durationMs, body: turn.json };
  console.log(JSON.stringify({ turnStatus: turn.status, ok: turn.json?.ok, code: turn.json?.error?.code ?? null }));
} finally {
  writeFileSync(join(runDir, 'pilot2-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  writeFileSync(join(runDir, 'runtime-audit.json'), `${JSON.stringify(readAudit(join(webOut, 'runtime.jsonl')), null, 2)}\n`, 'utf8');
  const stopped = spawnSync(process.execPath, [join(here, '..', '..', 'runtime', 'scripts', 'stop-education-web.mjs'), '--out', webOut], { encoding: 'utf8' });
  console.log(JSON.stringify({ stopped: stopped.status === 0 }));
}
