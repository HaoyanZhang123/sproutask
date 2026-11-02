#!/usr/bin/env node
/**
 * Build the A1 student payload at education/dist/student.
 *
 * Produces the exact contract consumed by A3 (NSIS):
 *
 *   student/
 *     node/node.exe + LICENSE
 *     app/node_modules/**        hoisted DSH runtime, cropped
 *     app/runtime/...            @edu host/client build + product launcher scripts
 *     app/content/biology-7a/**  runtime content JSON
 *     app/skills/biology/**      biology skill bundle
 *     licenses/**                copied from education/licenses
 *     launcher.cmd / launcher.vbs
 *     version.txt
 *
 * The script never runs pnpm and never writes outside --out / the local cache.
 * The input DSH tree must be a hoisted, symlink-free install (see
 * docs/rebuild/reports/T16-feasibility.md).
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const workspaceRoot = path.resolve(educationRoot, '..');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--clean') {
      args.clean = true;
      continue;
    }
    if (value === '--keep-sharp') {
      args['keep-sharp'] = true;
      continue;
    }
    if (value.startsWith('--')) {
      args[value.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const keepSharp = args['keep-sharp'] === true;const dshInstall = path.resolve(
  args['dsh-install'] ?? path.join(educationRoot, '.local', 'cache', 'T16', 'hoisted-test'),
);
const out = path.resolve(args.out ?? path.join(educationRoot, 'dist', 'student'));
const nodeExe = path.resolve(
  args['node-exe'] ??
    path.join(workspaceRoot, '..', '..', '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe'),
);
const nodeLicense = path.resolve(args['node-license'] ?? path.join(path.dirname(path.dirname(nodeExe)), 'LICENSE'));
const contentRoot = path.resolve(args.content ?? path.join(educationRoot, 'content', 'biology-7a'));
const skillsRoot = path.resolve(args.skills ?? path.join(educationRoot, 'skills', 'biology'));
const licensesRoot = path.resolve(args.licenses ?? path.join(educationRoot, 'licenses'));
const runtimeRoot = path.join(educationRoot, 'runtime');
const launcherRoot = path.join(educationRoot, 'desktop', 'launcher');

function fail(message) {
  console.error(`build-student-payload: ${message}`);
  process.exit(1);
}

function walkFiles(root) {
  const entries = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const info = statSync(full);
      if (info.isSymbolicLink()) fail(`input contains a symlink/reparse point: ${full}`);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) entries.push(full);
    }
  }
  return entries;
}

function summarize(root) {
  const files = walkFiles(root);
  const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  return { root, files: files.length, bytes };
}

function isCropped(relativePath) {
  const parts = relativePath.split(/[\\/]/).filter((part) => part.length > 0);
  if (parts.length === 0) return false;
  // 第三方包可能随包发 tsbuildinfo（构建缓存，运行时无用）：一律不进 payload
  if (/\.tsbuildinfo$/i.test(relativePath)) return true;
  const top = parts[0];
  if ((!keepSharp && top === 'sharp') || (!keepSharp && top === '@img') || top === 'node-pty') return true;
  if (top === 'sherpa-onnx-node' || top === 'sherpa-onnx-win-x64') return true;
  if (top === '@deepseek-ai' && parts.length > 1) {
    const scoped = parts[1];
    if (scoped === 'libreoffice-kit' || scoped === 'libreoffice-kit-win32-x64') return true;
    if (scoped === 'dsh-office-to-pdf' || scoped === 'dsh-skill-office') return true;
    if (/speech-to-text|sensevoice|voice-input/i.test(scoped)) return true;
  }
  return false;
}

function copyFiltered(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(source, src);
      return !isCropped(rel);
    },
  });
}

function copyFile(source, destination) {
  if (!existsSync(source)) fail(`missing required input: ${source}`);
  mkdirSync(path.dirname(destination), { recursive: true });
  const info = statSync(source);
  if (info.isDirectory()) {
    cpSync(source, destination, { recursive: true, force: true });
  } else {
    cpSync(source, destination);
  }
}

function gitValue(argsList, fallback) {
  const result = spawnSync('git', argsList, { cwd: workspaceRoot, encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0 ? result.stdout.trim() : fallback;
}

// --------------------------------------------------------------------- preflight
if (!existsSync(path.join(dshInstall, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))) {
  fail(`not a hoisted DSH install: ${dshInstall}`);
}
for (const required of [
  path.join(runtimeRoot, 'host-plugin', 'lib', 'index.js'),
  path.join(runtimeRoot, 'client-plugin', 'lib', 'client.js'),
  path.join(contentRoot, 'pack.json'),
  path.join(contentRoot, 'source', 'source-refs.json'),
  path.join(contentRoot, 'source', 'course-edition.json'),
  path.join(contentRoot, 'source', 'block-index.json'),
  path.join(skillsRoot, 'SKILL.md'),
  path.join(launcherRoot, 'launcher.cmd'),
  path.join(launcherRoot, 'launcher.vbs'),
  nodeExe,
  nodeLicense,
]) {
  if (!existsSync(required)) fail(`missing required input: ${required}`);
}
const sourceInfo = summarize(path.join(dshInstall, 'node_modules'));
if (sourceInfo.files === 0) fail('empty DSH install');
console.log(`source: ${dshInstall} (${sourceInfo.files} files, ${(sourceInfo.bytes / 1024 / 1024).toFixed(1)} MB)`);

// ----------------------------------------------------------------------- output
if (args.clean === true || existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, 'app'), { recursive: true });
mkdirSync(path.join(out, 'node'), { recursive: true });
mkdirSync(path.join(out, 'licenses'), { recursive: true });

copyFile(nodeExe, path.join(out, 'node', 'node.exe'));
copyFile(nodeLicense, path.join(out, 'node', 'LICENSE'));

copyFiltered(path.join(dshInstall, 'node_modules'), path.join(out, 'app', 'node_modules'));

for (const [name, files] of [
  ['host-plugin', ['lib', 'package.json']],
  ['client-plugin', ['lib', 'package.json']],
]) {
  for (const file of files) {
    copyFile(path.join(runtimeRoot, name, file), path.join(out, 'app', 'runtime', name, file));
  }
}
copyFile(
  path.join(runtimeRoot, 'scripts', 'setup-education-home.mjs'),
  path.join(out, 'app', 'runtime', 'scripts', 'setup-education-home.mjs'),
);
copyFile(
  path.join(launcherRoot, 'start-student-web.mjs'),
  path.join(out, 'app', 'runtime', 'scripts', 'start-student-web.mjs'),
);

for (const relative of [
  'pack.json',
  path.join('source', 'source-refs.json'),
  path.join('source', 'course-edition.json'),
  path.join('source', 'block-index.json'),
]) {
  copyFile(path.join(contentRoot, relative), path.join(out, 'app', 'content', 'biology-7a', relative));
}

for (const file of walkFiles(skillsRoot)) {
  const rel = path.relative(skillsRoot, file);
  // Skill 运行期只需要 SKILL.md + references/*.md；manifest.ts / tsconfig.json 属本仓源码，不进 payload
  if (/\.(ts|tsx)$/i.test(rel) || /(^|\/)tsconfig\.json$/i.test(rel)) continue;
  copyFile(file, path.join(out, 'app', 'skills', 'biology', rel));
}

if (existsSync(licensesRoot)) {
  copyFiltered(licensesRoot, path.join(out, 'licenses'));
} else {
  writeFileSync(
    path.join(out, 'licenses', 'README.md'),
    '# Licenses\n\nA2 has not produced education/licenses yet. This placeholder must be replaced before distribution.\n',
    'utf8',
  );
}

copyFile(path.join(launcherRoot, 'launcher.cmd'), path.join(out, 'launcher.cmd'));
// 不把任何 VBS 放进 payload：本机 AV 会拦截 makensis 读取含 VBS 内容的文件（实测）。
// 安装器的快捷方式直接指向 launcher.cmd。

const gitHash = gitValue(['rev-parse', '--short', 'HEAD'], 'nogit');
// The artifact must not claim to be exactly HEAD when the working tree carries
// uncommitted changes (e.g. a runtime fix that was built before the commit).
const gitDirty = gitValue(['status', '--porcelain'], '').trim().length > 0 ? '+dirty' : '';
const version = '0.3.1';
// The ledger must describe what this build actually contains: with
// --keep-sharp the sharp/@img binaries ARE shipped (libvips is LGPL-3.0 and its
// licence text is under licenses/), so they must not be listed as cropped.
const croppedPackages = [
  ...(keepSharp ? [] : ['sharp', '@img']),
  'libreoffice-kit',
  'sherpa-onnx',
  'node-pty',
  'dsh-office-to-pdf',
  'dsh-skill-office',
];
const sharpIncluded = keepSharp ? 'true (--keep-sharp; libvips LGPL-3.0)' : 'false';
writeFileSync(
  path.join(out, 'version.txt'),
  [
    `product=SproutAsk`,
    `version=${version}`,
    `git=${gitHash}${gitDirty}`,
    `builtAt=${new Date().toISOString()}`,
    `dsh=0.2.1-rc.3`,
    `content=biology-7a@${JSON.parse(readFileSync(path.join(contentRoot, 'pack.json'), 'utf8')).version}`,
    `node=${spawnSync(nodeExe, ['--version'], { encoding: 'utf8' }).stdout.trim()}`,
    `cropped=${croppedPackages.join(',')}`,
    `sharpIncluded=${sharpIncluded}`,
    '',
  ].join('\n'),
  'utf8',
);

const payload = summarize(out);
const app = summarize(path.join(out, 'app'));
const licenses = summarize(path.join(out, 'licenses'));
console.log(
  JSON.stringify(
    {
      out,
      files: payload.files,
      bytes: payload.bytes,
      megabytes: Number((payload.bytes / 1024 / 1024).toFixed(1)),
      appFiles: app.files,
      appMegabytes: Number((app.bytes / 1024 / 1024).toFixed(1)),
      licenseFiles: licenses.files,
      nodeExeBytes: statSync(path.join(out, 'node', 'node.exe')).size,
      croppedPackages: [
        ...(keepSharp ? [] : ['sharp', '@img/*']),
        'node-pty',
        'sherpa-onnx-node',
        'sherpa-onnx-win-x64',
        '@deepseek-ai/libreoffice-kit',
        '@deepseek-ai/libreoffice-kit-win32-x64',
        '@deepseek-ai/dsh-office-to-pdf',
        '@deepseek-ai/dsh-skill-office',
      ],
    },
    null,
    1,
  ),
);
