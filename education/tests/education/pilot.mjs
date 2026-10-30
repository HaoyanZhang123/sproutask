/**
 * T15 pilot: boot the isolated education web host (real DSH + real composition),
 * inspect the G1 API, and run exactly one real tutor turn to validate the route
 * and measure per-turn model-call behaviour before spending the full budget.
 *
 * Usage: node education/tests/education/pilot.mjs <runDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupEducationHome } from '../../runtime/scripts/setup-education-home.mjs';
import { startEducationWeb } from '../../runtime/scripts/start-education-web.mjs';
import { openEducationHost, readAudit } from './web-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(process.argv[2] ?? join(here, '..', '..', '.local', 'evidence', 'T15', 'pilot'));
mkdirSync(runDir, { recursive: true });

const home = join(runDir, 'home');
const webOut = join(runDir, 'web');
const setup = setupEducationHome(home);
writeFileSync(join(runDir, 'setup.json'), `${JSON.stringify(setup, null, 2)}\n`, 'utf8');

const meta = await startEducationWeb({ home, out: webOut, timeoutMs: 120000 });
writeFileSync(join(runDir, 'web-meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ started: true, port: meta.port, authKeyPresent: meta.authKeyPresent }));

const client = await openEducationHost(meta);
const evidence = { meta: { port: meta.port, authKeyPresent: meta.authKeyPresent }, calls: [] };

try {
  const status = await client.get('/edu/api/status');
  const library = await client.get('/edu/api/g1/library');
  const map = await client.get('/edu/api/g1/map');
  evidence.calls.push(
    { path: '/edu/api/status', status: status.status, durationMs: status.durationMs, body: status.json },
    { path: '/edu/api/g1/library', status: library.status, durationMs: library.durationMs, body: library.json },
    { path: '/edu/api/g1/map', status: map.status, durationMs: map.durationMs, bodyKeys: map.json === null ? null : Object.keys(map.json) },
  );

  const conceptId =
    map.json?.data?.concepts?.[0]?.id ??
    map.json?.concepts?.[0]?.id ??
    library.json?.data?.concepts?.[0]?.id ??
    library.json?.concepts?.[0]?.id ??
    null;
  evidence.conceptId = conceptId;
  console.log(JSON.stringify({ conceptId, mapStatus: map.status, mapShape: map.json === null ? null : Object.keys(map.json) }));

  if (conceptId !== null) {
    const startedAt = Date.now();
    const start = await client.post('/edu/api/g1/tutor/start', {
      requestId: `pilot-start-${Date.now()}`,
      conceptId,
      mode: 'learn',
    });
    evidence.tutorStart = { status: start.status, durationMs: start.durationMs, body: start.json };
    const sessionId = start.json?.data?.session?.id ?? start.json?.data?.sessionId ?? null;
    const revision = start.json?.data?.state?.revision ?? start.json?.revision ?? 0;
    evidence.sessionId = sessionId;
    console.log(JSON.stringify({ startStatus: start.status, sessionId: sessionId !== null, revision }));

    if (sessionId !== null) {
      const turn = await client.post('/edu/api/g1/tutor/turn', {
        requestId: `pilot-turn-${Date.now()}`,
        sessionId,
        revision,
        message: '老师，我不太明白“观察”到底是什么意思，能提示我一下吗？',
      });
      evidence.tutorTurn = {
        status: turn.status,
        durationMs: turn.durationMs,
        body: turn.json,
        wallClockMs: Date.now() - startedAt,
      };
      console.log(JSON.stringify({ turnStatus: turn.status, durationMs: turn.durationMs }));
      const end = await client.post('/edu/api/g1/tutor/end', {
        requestId: `pilot-end-${Date.now()}`,
        sessionId,
        revision: turn.json?.data?.revision ?? revision + 1,
        reason: 'completed',
      });
      evidence.tutorEnd = { status: end.status, body: end.json };
    }
  }
} finally {
  writeFileSync(join(runDir, 'pilot-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  const audit = readAudit(join(webOut, 'runtime.jsonl'));
  writeFileSync(join(runDir, 'runtime-audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  const stopped = spawnSync(
    process.execPath,
    [join(here, '..', '..', 'runtime', 'scripts', 'stop-education-web.mjs'), '--out', webOut],
    { encoding: 'utf8' },
  );
  writeFileSync(join(runDir, 'stop.json'), `${JSON.stringify({ status: stopped.status, stdout: stopped.stdout, stderr: stopped.stderr }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ stopped: stopped.status === 0, auditEvents: audit.length }));
}
