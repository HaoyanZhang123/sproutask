#!/usr/bin/env node
/**
 * Task scoped typecheck (pnpm --dir education typecheck:task T01).
 * Reads config/task-routes.json; missing task packages are a hard, explained
 * failure (never a success).
 */

import {
  educationPath,
  fail,
  isDirectory,
  isFile,
  readJson,
  relativeToEducation,
  runTsc,
} from './lib/workspace.mjs';

const taskId = process.argv[2];
if (taskId === undefined || !/^T(0[1-9]|1[0-7])$/.test(taskId)) {
  fail('usage: typecheck:task Txx (T01..T17)', 2);
}

const routes = readJson(educationPath('config', 'task-routes.json'));
const route = routes.tasks[taskId];
if (route === undefined) {
  fail(`not implemented: typecheck:task ${taskId}\nreason: no route in config/task-routes.json`, 3);
}

const projects = route.projects ?? [];
const missing = [];
for (const project of projects) {
  const absolute = educationPath(project);
  if (!isDirectory(absolute) || !isFile(`${absolute}/tsconfig.json`)) {
    missing.push(project);
  }
}
if (missing.length > 0 || projects.length === 0) {
  fail(
    `not implemented: typecheck:task ${taskId}\nreason: ${
      route.reason ?? 'task package not created yet'
    }\nmissing projects: ${missing.length > 0 ? missing.join(', ') : '(none declared)'}`,
    3,
  );
}

let failed = false;
for (const project of projects) {
  console.log(`\n[typecheck:task ${taskId}] ${project}`);
  const code = runTsc(educationPath(project));
  if (code !== 0) failed = true;
  console.log(`[typecheck:task ${taskId}] ${project} exit=${code}`);
}
process.exit(failed ? 1 : 0);
