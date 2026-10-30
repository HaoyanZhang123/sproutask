#!/usr/bin/env node
/**
 * Verifies docs/rebuild/contract-lock.json against the working tree. Any drift
 * fails non-zero so consumers know the frozen contract changed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { verifyContractLock } from './lib/lock.mjs';
import { workspacePath } from './lib/workspace.mjs';

const target = workspacePath('docs', 'rebuild', 'contract-lock.json');
if (!existsSync(target)) {
  console.error('contract-lock verify: docs/rebuild/contract-lock.json is missing; run contract:lock:generate');
  process.exit(2);
}
const lock = JSON.parse(readFileSync(target, 'utf8'));
const problems = verifyContractLock(lock);
if (problems.length > 0) {
  console.error(`contract-lock verify: ${problems.length} problem(s)`);
  for (const problem of problems.slice(0, 20)) console.error(` - ${problem}`);
  if (problems.length > 20) console.error(` ... ${problems.length - 20} more`);
  process.exit(1);
}
console.log(
  `contract-lock verify: OK (version=${lock.contract.version}, files=${lock.files.length}, commands=${lock.commands.length})`,
);
