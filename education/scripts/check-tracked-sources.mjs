#!/usr/bin/env node
/**
 * check:tracked —— CI 守卫：education/ 下本该进 git 的文件，一个都不能少。
 *
 * 2026-11-05 事故：根 .gitignore 里一条全局 `data/` 规则把
 * education/client/shell/src/data/ 的两个源文件静默忽略了。本机照常构建、
 * 测试也绿，但干净克隆缺文件 → typecheck 红、CI 红、许可证流程 ENOENT。
 *
 * 本脚本遍历 education 树，跳过运行时/构建产物目录与日志，任何不在
 * `git ls-files` 里的文件都算失败。它只做「有没有被跟踪」，不检查内容。
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { EDUCATION_ROOT, WORKSPACE_ROOT } from './lib/workspace.mjs';

/** 生成物 / 本机运行数据目录：允许存在、允许不进 git。 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.local',
  'dist',
  'coverage',
  'output',
  '.git',
  '.pnpm',
  '.vite-temp',
  '.vitest-cache',
]);

/** 本机产物文件：同样不进 git、也不进契约锁。 */
function isSkippedFile(name) {
  return name.endsWith('.tsbuildinfo') || name.endsWith('.log');
}

function walk(dir, output) {
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(entry) || isSkippedFile(entry)) continue;
    const full = path.join(dir, entry);
    const relative = path.relative(WORKSPACE_ROOT, full).split(path.sep).join('/');
    if (statSync(full).isDirectory()) walk(full, output);
    else output.push(relative);
  }
}

function trackedFiles() {
  const out = execFileSync('git', ['-C', WORKSPACE_ROOT, 'ls-files', '-z', '--', 'education'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return new Set(out.split('\0').filter((entry) => entry.length > 0));
}

const onDisk = [];
walk(EDUCATION_ROOT, onDisk);
const tracked = trackedFiles();
const missing = onDisk.filter((file) => !tracked.has(file));

if (missing.length > 0) {
  console.error(`check:tracked: ${missing.length} 个文件在 education/ 下却没有进 git`);
  for (const file of missing.slice(0, 20)) console.error(` - ${file}`);
  if (missing.length > 20) console.error(` ... 还有 ${missing.length - 20} 个`);
  console.error('');
  console.error('常见原因：.gitignore 规则过宽（例如全局 `data/` 会误伤 `src/data/`）。');
  console.error('处理：收窄 .gitignore，然后 `git add` 这些文件；不要删除它们。');
  process.exit(1);
}

console.log(`check:tracked: OK（education/ 下 ${onDisk.length} 个文件全部被 git 跟踪）`);
