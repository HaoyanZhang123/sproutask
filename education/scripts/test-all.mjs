#!/usr/bin/env node
/** Full offline test run across every discovered vitest project. */

import {
  discoverTestProjects,
  relativeToEducation,
  runVitest,
} from './lib/workspace.mjs';

const projects = discoverTestProjects();
if (projects.length === 0) {
  console.error('test: no vitest projects discovered');
  process.exit(1);
}

let failed = false;
for (const project of projects) {
  console.log(`\n[test] ${relativeToEducation(project)}`);
  const code = runVitest(project);
  if (code !== 0) failed = true;
  console.log(`[test] ${relativeToEducation(project)} exit=${code}`);
}
process.exit(failed ? 1 : 0);
