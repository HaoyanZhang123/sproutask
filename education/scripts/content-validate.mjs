#!/usr/bin/env node
/**
 * content:validate (config owner wiring, 2026-10-29).
 *
 * Runs the frozen content validation CLI from @edu/knowledge against every
 * content pack under education/content/ (each directory that contains a
 * pack.json). Never reports success when there is no pack: a missing pack is a
 * hard, explained failure (exit 2), matching the "no echo success" rule.
 *
 * Exit codes: 0 all packs valid, 1 at least one pack invalid, 2 usage/IO or no pack.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { educationPath, fail, isDirectory, isFile, listDirectories } from './lib/workspace.mjs';

const CLI = educationPath('packages', 'knowledge', 'bin', 'validate-pack.mjs');
if (!isFile(CLI)) {
  fail(`content:validate: missing validation CLI at ${CLI}`, 2);
}

const args = process.argv.slice(2);
const explicitTargets = args.filter((arg) => !arg.startsWith('-'));
const passthrough = args.filter((arg) => arg.startsWith('-'));

let targets = explicitTargets;
if (targets.length === 0) {
  const contentRoot = educationPath('content');
  targets = listDirectories(contentRoot)
    .filter((dir) => isFile(`${dir}/pack.json`))
    .map((dir) => dir);
  if (targets.length === 0) {
    fail('content:validate: no content pack found under education/content/*/pack.json', 2);
  }
}

let worst = 0;
for (const target of targets) {
  const absolute = path.isAbsolute(target) ? target : educationPath(target);
  if (!isFile(absolute) && !isDirectory(absolute)) {
    fail(`content:validate: target not found: ${target}`, 2);
  }
  console.log(`\n[content:validate] ${target}`);
  const result = spawnSync(process.execPath, [CLI, absolute, ...passthrough], {
    cwd: educationPath(),
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  const code = result.status ?? 1;
  console.log(`[content:validate] ${target} exit=${code}`);
  if (code !== 0 && worst === 0) worst = code;
}

process.exit(worst);
