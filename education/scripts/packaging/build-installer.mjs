#!/usr/bin/env node
/**
 * build-installer.mjs — 用 NSIS 构建 SproutAsk 学生版一键安装程序。
 *
 * 前置：payload 由 build-student-payload.mjs 产出到 education/dist/student/。
 * NSIS：优先 makensis 已在 PATH；否则用 .local/cache/T16/tools/nsis/<ver>/makensis.exe。
 *
 * 用法：
 *   node education/scripts/packaging/build-installer.mjs [--payload education/dist/student]
 *        [--out education/dist/SproutAsk-Setup-x64.exe] [--nsis <makensis路径>]
 *
 * 退出码：0 成功；2 缺 payload/NSIS；1 NSIS 编译失败。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const workspaceRoot = path.resolve(educationRoot, '..');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const payloadDir = path.resolve(workspaceRoot, flag('--payload', 'education/dist/student'));
const outFile = path.resolve(workspaceRoot, flag('--out', 'education/dist/SproutAsk-Setup-x64.exe'));
const nsiPath = path.join(here, 'nsis', 'SproutAsk-Setup.nsi');

function fail(message, code = 2) {
  console.error(`build-installer: ${message}`);
  process.exit(code);
}

function findMakensis(explicit) {
  if (explicit) return explicit;
  const fromPath = spawnSync('where', ['makensis'], { encoding: 'utf8', windowsHide: true });
  if (fromPath.status === 0) {
    const first = fromPath.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.trim();
  }
  const toolsRoot = path.join(educationRoot, '.local', 'cache', 'T16', 'tools', 'nsis');
  if (existsSync(toolsRoot)) {
    const stack = [toolsRoot];
    while (stack.length > 0) {
      const dir = stack.pop();
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) stack.push(full);
        else if (entry.toLowerCase() === 'makensis.exe') return full;
      }
    }
  }
  return null;
}

if (!existsSync(payloadDir)) fail(`payload not found: ${payloadDir} (run build-student-payload.mjs first)`);
if (!existsSync(path.join(payloadDir, 'launcher.cmd'))) fail(`payload missing launcher.cmd: ${payloadDir}`);
if (!existsSync(nsiPath)) fail(`NSIS script not found: ${nsiPath}`);

const makensis = findMakensis(flag('--nsis', null));
if (!makensis || !existsSync(makensis)) fail('makensis not found (pass --nsis <path> or put it on PATH)');

const versionFile = path.join(payloadDir, 'version.txt');
const versionText = existsSync(versionFile) ? readFileSync(versionFile, 'utf8') : '';
/** version.txt is `key=value`; accept `key: value` too for older payloads. */
const ledger = (key) =>
  (versionText.match(new RegExp(`^\\s*${key}\\s*[:=]\\s*(.+)$`, 'im'))?.[1] ?? '').trim();
const version = ledger('version') || '0.3.0';
// A payload that carries no explicit build id still has a git hash and a build
// time: report those instead of the useless "unversioned" placeholder.
const buildId = (
  ledger('build') ||
  [ledger('git'), ledger('builtAt')].filter((part) => part.length > 0).join('@') ||
  'unversioned'
)
  .trim()
  .slice(0, 80);

// NSIS 的 Unicode 脚本需要 UTF-8 BOM；生成带 BOM 的副本再编译，避免中文乱码。
const bomPath = path.join(here, 'nsis', '.SproutAsk-Setup.bom.nsi');
writeFileSync(bomPath, `\uFEFF${readFileSync(nsiPath, 'utf8')}`, 'utf8');

mkdirSync(path.dirname(outFile), { recursive: true });
const defines = [
  `/DPAYLOAD_DIR=${payloadDir}`,
  `/DOUTPUT_FILE=${outFile}`,
  `/DVERSION=${version}`,
  `/DBUILD_ID=${buildId}`,
];
console.log(`makensis: ${makensis}`);
console.log(`payload : ${payloadDir}`);
console.log(`output  : ${outFile}`);
const result = spawnSync(makensis, [...defines, bomPath], { stdio: 'inherit', windowsHide: true, cwd: workspaceRoot });
if (result.status !== 0) fail(`makensis failed with exit code ${result.status}`, 1);
if (!existsSync(outFile)) fail('makensis reported success but output file is missing', 1);
console.log(`installer built: ${outFile} (${statSync(outFile).size} bytes)`);
