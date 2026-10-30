#!/usr/bin/env node
/**
 * `pnpm --dir education dev`: build, generate the isolated profile, start the
 * education web root on a random loopback port, print the real URL and stay in
 * the foreground until Ctrl+C. It never binds the current GUI port (29962) or
 * uses E:\DSH\.dsh.
 */

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, setupEducationHome } from '../runtime/scripts/setup-education-home.mjs';
import { startEducationWeb } from '../runtime/scripts/start-education-web.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..');
const args = parseArgs(process.argv.slice(2));
const home = path.resolve(
  typeof args.home === 'string' ? args.home : path.join(educationRoot, '.local', 'cache', 'T01', 'dev-home'),
);
const out = path.resolve(
  typeof args.out === 'string' ? args.out : path.join(educationRoot, '.local', 'cache', 'T01', 'dev-run'),
);

const build = spawnSync(process.execPath, [path.join(here, 'build-education.mjs')], {
  cwd: educationRoot,
  stdio: 'inherit',
  windowsHide: true,
});
if ((build.status ?? 1) !== 0) {
  console.error('dev: build failed');
  process.exit(build.status ?? 1);
}
setupEducationHome(home);
const meta = await startEducationWeb({ home, out });
console.log(`education web root: ${meta.url}`);
console.log(`DSH_HOME=${meta.home}`);
console.log('press Ctrl+C to stop');
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  spawnSync(process.execPath, [path.join(educationRoot, 'runtime', 'scripts', 'stop-education-web.mjs'), '--out', out], {
    stdio: 'inherit',
    windowsHide: true,
  });
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
await new Promise(() => {
  /* keep the foreground process alive; the DSH child is detached */
});
