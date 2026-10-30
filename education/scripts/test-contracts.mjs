#!/usr/bin/env node
/**
 * Contract test suite: verify the contract lock, then run every project's
 * `test/contracts` directory (valid/invalid fixtures and port consistency).
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  educationPath,
  isDirectory,
  listDirectories,
  runNodeScript,
  runVitest,
} from './lib/workspace.mjs';

const lockCode = runNodeScript('scripts/verify-contract-lock.mjs');
if (lockCode !== 0) {
  console.error(`test:contracts failed: contract-lock verification exit=${lockCode}`);
  process.exit(lockCode);
}

const projects = [];
for (const dir of listDirectories(educationPath('packages'))) {
  if (isDirectory(path.join(dir, 'test', 'contracts'))) projects.push(dir);
}
if (isDirectory(path.join(educationPath('runtime'), 'test', 'contracts'))) {
  projects.push(educationPath('runtime'));
}
for (const dir of listDirectories(educationPath('client'))) {
  if (isDirectory(path.join(dir, 'test', 'contracts'))) projects.push(dir);
}

if (projects.length === 0) {
  console.error('not implemented: test:contracts (no project has a test/contracts directory)');
  process.exit(3);
}

let failed = false;
for (const project of projects) {
  console.log(`\n[test:contracts] ${path.relative(educationPath(), project)}`);
  const code = runVitest(project, ['contracts']);
  if (code !== 0) failed = true;
  console.log(`[test:contracts] exit=${code}`);
}
process.exit(failed ? 1 : 0);
