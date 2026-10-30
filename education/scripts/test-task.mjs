#!/usr/bin/env node
/**
 * Task scoped tests (pnpm --dir education test:task T01).
 * Missing packages/test dirs are a hard, explained failure.
 */

import {
  educationPath,
  fail,
  isDirectory,
  isFile,
  readJson,
  runVitest,
} from './lib/workspace.mjs';

const taskId = process.argv[2];
if (taskId === undefined || !/^T(0[1-9]|1[0-7])$/.test(taskId)) {
  fail('usage: test:task Txx (T01..T17)', 2);
}

const routes = readJson(educationPath('config', 'task-routes.json'));
const route = routes.tasks[taskId];
if (route === undefined) {
  fail(`not implemented: test:task ${taskId}\nreason: no route in config/task-routes.json`, 3);
}

const missing = [];
const runnable = [];
for (const project of route.tests ?? []) {
  const absolute = educationPath(project);
  if (!isDirectory(absolute)) {
    missing.push(project);
    continue;
  }
  if (!isFile(`${absolute}/vitest.config.ts`)) {
    missing.push(`${project} (no vitest.config.ts)`);
    continue;
  }
  runnable.push(project);
}
if (missing.length > 0 || runnable.length === 0) {
  fail(
    `not implemented: test:task ${taskId}\nreason: ${
      route.reason ?? 'task test project not created yet'
    }\nmissing: ${missing.length > 0 ? missing.join(', ') : '(none declared)'}`,
    3,
  );
}

let failed = false;
for (const project of runnable) {
  console.log(`\n[test:task ${taskId}] ${project}`);
  const code = runVitest(educationPath(project));
  if (code !== 0) failed = true;
  console.log(`[test:task ${taskId}] ${project} exit=${code}`);
}
process.exit(failed ? 1 : 0);
