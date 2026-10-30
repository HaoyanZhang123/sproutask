#!/usr/bin/env node
/** Full typecheck: discovers every TypeScript project in the education workspace. */

import {
  discoverTsProjects,
  relativeToEducation,
  runTsc,
} from './lib/workspace.mjs';

const projects = discoverTsProjects();
if (projects.length === 0) {
  console.error('typecheck: no TypeScript projects discovered');
  process.exit(1);
}

let failed = false;
for (const project of projects) {
  console.log(`\n[typecheck] ${relativeToEducation(project)}`);
  const code = runTsc(project);
  if (code !== 0) failed = true;
  console.log(`[typecheck] ${relativeToEducation(project)} exit=${code}`);
}
process.exit(failed ? 1 : 0);
