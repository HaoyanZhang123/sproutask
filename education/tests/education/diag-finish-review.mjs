/**
 * T15 rerun — diagnose the finish-review UNAUTHORIZED response without any model call.
 * Boots the host, starts a review session, and calls finish-review with a fresh
 * revision; prints the raw response so the error message/code is visible.
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
const out = {};
try {
  const start = await client.post('/edu/api/g1/tutor/start', {
    requestId: `diag-start-${Date.now()}`,
    conceptId: 'concept.bio7a.observation.meaning',
    mode: 'review',
  });
  const sessionId = start.json?.data?.session?.id;
  const revision = start.json?.data?.state?.revision ?? 0;
  out.start = { status: start.status, sessionId, revision };
  const finish = await client.post('/edu/api/g1/tutor/finish-review', {
    requestId: `diag-finish-${Date.now()}`,
    sessionId,
    revision,
    outcome: 'needs_support',
  });
  out.finish = { status: finish.status, text: finish.text, json: finish.json };
  console.log(finish.text.slice(0, 1200));
} finally {
  writeFileSync(join(runDir, 'diag-finish.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  spawnSync(process.execPath, [join(here, '..', '..', 'runtime', 'scripts', 'stop-education-web.mjs'), '--out', webOut], { encoding: 'utf8' });
}
