#!/usr/bin/env node
/**
 * build:win —— 一条命令产出 Windows 学生版安装包。
 *
 *   1. pnpm build                 插件 bundle（runtime 下的 lib，已提交）
 *   2. build:host                 Rust + WebView2 原生桌面壳 → desktop/host/dist/SproutAsk.exe
 *   3. build:payload              node/app/licenses/SproutAsk.exe → dist/student/
 *   4. build:installer            NSIS → dist/SproutAsk-Setup-<version>-x64.exe
 *
 * 前置：Rust MSVC 工具链（含 WebView2 Runtime 的系统）与 NSIS；payload 还需要
 * DSH 运行时（education/probes/runtime/node_modules）与 Node 可执行文件。
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(educationRoot, '..');

function run(label, command, args) {
  console.log(`\n[build:win] ${label}`);
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    console.error(`[build:win] ${label} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

run('plugins', process.execPath, [path.join(educationRoot, 'scripts', 'build-education.mjs')]);
run('desktop host', process.execPath, [path.join(educationRoot, 'scripts', 'packaging', 'build-desktop-host.mjs')]);
run('payload', process.execPath, [
  path.join(educationRoot, 'scripts', 'packaging', 'build-student-payload.mjs'),
]);
run('installer', process.execPath, [
  path.join(educationRoot, 'scripts', 'packaging', 'build-installer.mjs'),
]);

console.log('\n[build:win] done. Artifacts under education/dist/.');
