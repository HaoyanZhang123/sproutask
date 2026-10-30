#!/usr/bin/env node
/**
 * T16/F-08 — third-party license bundle generator, v2 (2026-10-31 rewrite).
 *
 * The previous build-notice.mjs was destroyed by a PowerShell text round-trip
 * (UTF-8 BOM + mojibake) and could not run; it is kept as build-notice.mjs.broken.
 *
 * Ground rules of this rewrite:
 *   - "shipped" is decided by the real payload (education/dist/student/app/node_modules),
 *     never by a guess or by a stale trim list. Every status in the output can be
 *     re-derived by looking at that directory.
 *   - the 558-package rows still come from the T00 inventory that
 *     data/license-manifest.json points at; missing texts from data/missing-licenses.json;
 *     license bodies from texts/** (never rewritten, never invented).
 *   - output is deterministic: no timestamps, sorted rows, LF endings, so running the
 *     generator twice produces byte-identical files.
 *
 * Usage:
 *   node education/licenses/tools/build-notice-v2.mjs            # write
 *   node education/licenses/tools/build-notice-v2.mjs --check    # verify up to date
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const licensesRoot = path.resolve(here, '..');
const educationRoot = path.resolve(licensesRoot, '..');
const workspaceRoot = path.resolve(educationRoot, '..');
const payloadModules = path.join(educationRoot, 'dist', 'student', 'app', 'node_modules');
const textsDir = path.join(licensesRoot, 'texts');

/** 5A trim policy. Absence from the payload is the evidence; this list says why. */
const TRIM_GROUPS = [
  {
    id: 'office',
    title: 'Office 转换（LibreOffice Kit，MPL-2.0）',
    reason: '学生端不提供 Office 转换；需要几百 MB 二进制与额外运行时',
    restore: '附 MPL-2.0 全文与包内 NOTICE/program/license.txt，并提供对应源码获取方式',
    match: (name) => name === '@deepseek-ai/libreoffice-kit' || name === '@deepseek-ai/libreoffice-kit-win32-x64',
  },
  {
    id: 'office-skill',
    title: 'Office 技能入口（MIT）',
    reason: '依赖 office 转换链路，链路裁剪后入口无意义',
    restore: '随 office 一起恢复，并重跑 scan-payload 与 NOTICE',
    match: (name) => name === '@deepseek-ai/dsh-office-to-pdf' || name === '@deepseek-ai/dsh-skill-office',
  },
  {
    id: 'speech',
    title: '语音识别 / 语音输入（Apache-2.0）',
    reason: '语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包',
    restore: '恢复时需附 Apache-2.0 全文与 onnxruntime/sherpa 的 DLL 来源说明',
    match: (name) => /(^|\/)dsh-experimental-(api-)?speech-to-text|dsh-experimental-voice-input|sensevoice|voice-input/i.test(name),
  },
  {
    id: 'speech-native',
    title: 'sherpa-onnx 原生库（Apache-2.0）',
    reason: '语音识别的原生依赖，随语音链路一起裁剪',
    restore: '恢复时需附 Apache-2.0 全文（上游 tarball 未附文本，需向上游索取）',
    match: (name) => name === 'sherpa-onnx-node' || name === 'sherpa-onnx-win-x64',
  },
  {
    id: 'pty',
    title: 'node-pty（MIT）',
    reason: '学生端不起终端，PTY 及其 conpty/OpenConsole 二进制不需要',
    restore: '附 MIT 全文与 Windows Terminal 的 MIT 版权行',
    match: (name) => name === 'node-pty',
  },
];

/** Packages that must be tested as shipped, not guessed: sharp's libvips is LGPL. */
const LGPL_PACKAGES = ['@img/sharp-win32-x64', 'sharp'];

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const posix = (value) => value.split(path.sep).join('/');
const cell = (value) => String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();

function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function fail(message) {
  console.error(`build-notice-v2: ${message}`);
  process.exit(1);
}

// ------------------------------------------------------------------------ inputs
const manifest = loadJson(path.join(licensesRoot, 'data', 'license-manifest.json'));
const inventoryPath = path.join(educationRoot, ...manifest.inventory.path.split('/'));
if (!existsSync(inventoryPath)) fail(`inventory missing: ${inventoryPath}`);
const inventoryBytes = readFileSync(inventoryPath);
const inventorySha = sha256(inventoryBytes);
if (inventorySha !== manifest.inventory.sha256) {
  fail(`inventory sha256 drift: manifest=${manifest.inventory.sha256} actual=${inventorySha}`);
}
const inventory = JSON.parse(inventoryBytes.toString('utf8'));
const missing = loadJson(path.join(licensesRoot, 'data', 'missing-licenses.json'));
const textIndex = loadJson(path.join(licensesRoot, 'data', 'license-text-index.json'));

const target = process.argv.includes('--check') ? 'check' : 'write';

// ----------------------------------------------------------------- payload scan
if (!existsSync(payloadModules)) fail(`payload not built: ${payloadModules}`);
const payloadDirs = new Set(readdirSync(payloadModules, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name));
const payloadInfo = new Map();
function payloadPresence(name) {
  if (payloadInfo.has(name)) return payloadInfo.get(name);
  const parts = name.split('/');
  const dir = path.join(payloadModules, ...parts);
  const present = parts.length === 1 ? payloadDirs.has(parts[0]) : existsSync(dir);
  const record = { present, files: 0, bytes: 0 };
  if (present) {
    const pkgJson = path.join(dir, 'package.json');
    record.hasPackageJson = existsSync(pkgJson);
  }
  payloadInfo.set(name, record);
  return record;
}

const rows = inventory
  .map((record) => {
    const presence = payloadPresence(record.name);
    return {
      name: record.name,
      version: record.version,
      license: record.license ?? 'UNKNOWN',
      official: record.official === true,
      licenseFiles: record.licenseFiles ?? [],
      shipped: presence.present,
      trimGroup: TRIM_GROUPS.find((group) => group.match(record.name)) ?? null,
    };
  })
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

// --------------------------------------------------------------- sanity asserts
const absent = rows.filter((row) => !row.shipped);
const undeclared = absent.filter((row) => row.trimGroup === null);
if (undeclared.length > 0) {
  fail(
    `payload 缺少未声明裁剪的包：${undeclared.map((r) => r.name).join(', ')} —— ` +
      '要么补进 TRIM_GROUPS 并写清恢复义务，要么说明它不是被裁剪（改生成器前先查 payload）',
  );
}
for (const name of LGPL_PACKAGES) {
  const row = rows.find((entry) => entry.name === name);
  if (row === undefined) fail(`missing from inventory: ${name}`);
  if (!row.shipped) fail(`${name} 不在 payload 内：重打学生包必须带 --keep-sharp（libvips 随包，LGPL 义务见 NOTICE §3）`);
}
const sharpRow = rows.find((row) => row.name === 'sharp');
if (sharpRow.trimGroup !== null) fail('sharp 不应出现在裁剪清单内');

// ----------------------------------------------------------- text file resolution
const textFiles = readdirSync(textsDir)
  .filter((file) => file.endsWith('.txt'))
  .sort();
const textByHash = new Map();
for (const file of textFiles) {
  const bytes = readFileSync(path.join(textsDir, file));
  const hash = sha256(bytes);
  textByHash.set(hash, { file, hash, bytes: bytes.length, text: bytes.toString('utf8') });
}
const refCounts = new Map();
for (const row of rows) {
  for (const file of row.licenseFiles) {
    const entry = textByHash.get(file.sha256);
    if (entry === undefined) continue;
    refCounts.set(entry.file, (refCounts.get(entry.file) ?? 0) + 1);
  }
}
for (const item of missing.packages ?? []) {
  for (const file of item.extractedFiles ?? []) {
    const entry = textByHash.get(file.sha256);
    if (entry !== undefined) refCounts.set(entry.file, (refCounts.get(entry.file) ?? 0) + 1);
  }
}
for (const item of textIndex) {
  const entry = textByHash.get(item.sha256);
  if (entry !== undefined && !refCounts.has(entry.file)) refCounts.set(entry.file, 0);
}

function copyrightOf(row) {
  for (const file of row.licenseFiles) {
    const entry = textByHash.get(file.sha256);
    if (entry === undefined) continue;
    for (const raw of entry.text.split(/\r?\n/).slice(0, 400)) {
      const line = raw.replace(/^[#*;\s-]+/, '').trim();
      if (line.length < 8) continue;
      if (!/copyright|\(c\)\s*\d{4}|©/i.test(line)) continue;
      return line.length > 96 ? `${line.slice(0, 96)}…` : line;
    }
  }
  return '—';
}

function textCell(row) {
  const links = [];
  for (const file of row.licenseFiles) {
    const entry = textByHash.get(file.sha256);
    if (entry === undefined) continue;
    links.push(`[${entry.file}](texts/${entry.file})`);
  }
  return links.length > 0 ? links.join('<br>') : '上游未提供文本（见 §2）';
}

// ------------------------------------------------------------- LGPL source facts
const lgplTextName = '9a7e34fbf3903507.txt';
const lgplText = textByHash.get(
  sha256(readFileSync(path.join(textsDir, lgplTextName))),
);
if (lgplText === undefined) fail(`LGPL full text missing: texts/${lgplTextName}`);
const lgplHasMarker = /GNU LESSER GENERAL PUBLIC LICENSE/.test(lgplText.text) && /Version 3/.test(lgplText.text);
if (!lgplHasMarker) fail(`texts/${lgplTextName} 不再包含 LGPL-3.0 全文，§3.1 的引用会失真`);
const vipsDll = path.join(payloadModules, '@img', 'sharp-win32-x64', 'lib');
const vipsFiles = existsSync(vipsDll) ? readdirSync(vipsDll).filter((f) => /^libvips/i.test(f)).sort() : [];

// ---------------------------------------------------------------------- NOTICE
const statusYes = rows.filter((row) => row.shipped).length;
const statusTrim = rows.filter((row) => !row.shipped).length;
const byLicense = new Map();
for (const row of rows) {
  const list = byLicense.get(row.license) ?? [];
  list.push(row);
  byLicense.set(row.license, list);
}
const licenseGroups = [...byLicense.entries()]
  .map(([license, list]) => ({ license, list }))
  .sort((a, b) => (b.list.length - a.list.length) || (a.license < b.license ? -1 : 1));

const noticeLines = [];
const push = (...lines) => noticeLines.push(...lines);

push('# 第三方许可 NOTICE（Third-Party Notices）', '');
push('> 本文件由 `education/licenses/tools/build-notice-v2.mjs` 从数据文件生成，**请勿手改**。', '');
push(`- 包清单基准：\`${manifest.inventory.path}\`（sha256 \`${inventorySha}\`，${rows.length} 包；${rows.filter((r) => r.official).length} 官方 / ${rows.filter((r) => !r.official).length} 第三方）`);
push(`- 随包判定基准：\`education/dist/student/app/node_modules\` 实测目录（本文件生成时该目录含 ${payloadDirs.size} 个顶层条目）`);
push(`- 缺文本清单：\`education/licenses/data/missing-licenses.json\`（${missing.packages.length} 包：${missing.packages.filter((p) => p.status === 'supplemented').length} 已补齐 / ${missing.packages.filter((p) => p.status === 'absent-in-tarball').length} 上游未提供）`);
push('- 生成器不写入时间戳、按包名排序，因此同一份输入两次生成的字节相同（可重复性见 §4）', '');
push('## 0. 随包状态总览（以实物 payload 为准）', '');
push('| 状态 | 包数 | 含义 |', '|---|---|---|');
push(`| \`yes\` | ${statusYes} | payload 内实测存在该包目录 → 随学生包分发 |`);
push(`| \`no (5A trim)\` | ${statusTrim} | payload 内实测不存在，且属于 §0.1 的裁剪项 → 不随包 |`);
push(`| 合计 | ${rows.length} | 与 T00 全量闭包一致 |`, '');
push('### 0.1 当前裁剪项（12 包 / 5 组，全部为 payload 实测缺失）', '');
push('| 组 | 包 | 版本 | 许可 | 裁剪原因 |', '|---|---|---|---|---|');
for (const group of TRIM_GROUPS) {
  const members = absent.filter((row) => row.trimGroup?.id === group.id);
  for (const row of members) {
    push(`| ${group.title} | \`${row.name}\` | ${row.version} | ${cell(row.license)} | ${group.reason} |`);
  }
}
push('', '### 0.2 sharp / libvips 的状态（与裁剪清单互斥，必须显式确认）', '');
push(`- \`sharp\` ${sharpRow.version}（Apache-2.0）：**随包 (\`yes\`)**，学生端图片上传/缩略图依赖它。`);
push(`- \`@img/sharp-win32-x64\`（Apache-2.0 AND **LGPL-3.0-or-later**）：**随包 (\`yes\`)**；payload 内 \`@img/sharp-win32-x64/lib/\` 实测含 ${vipsFiles.map((f) => `\`${f}\``).join('、') || '（未找到 libvips DLL，需复核）'}。`);
push('- 结论：**sharp/@img 不属于 5A 裁剪项**，不得在 NOTICE/EXCLUDED 中写成"已裁剪"；其 LGPL 义务见 §3.1。', '');
push('## 1. 包清单（按许可分组）', '');
push('列说明：`随包` = payload 实测；`版权行` 取自该包许可文本的首个版权行（无文本则记 `—`）；`文本` 指向去重后的全文文件。', '');
for (const group of licenseGroups) {
  push(`### ${group.license}（${group.list.length} 包）`, '');
  push('| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |', '|---|---|---|---|---|---|');
  for (const row of group.list) {
    push(`| \`${row.name}\` | ${row.version} | ${cell(row.license)} | ${cell(copyrightOf(row))} | ${row.shipped ? 'yes' : 'no (5A trim)'} | ${textCell(row)} |`);
  }
  push('');
}
push(`## 2. ${missing.packages.length} 个缺许可文本包的处理结果`, '');
push('上游 npm tarball 本身不含许可文本，因此**不编造文本**：能从上���其它产物取到全文的补入 `texts/` 并标 `supplemented`，其余标 `absent-in-tarball` 并给出上游地址。', '');
push('| 包 | 版本 | 许可 | 处理 | 上游地址 |', '|---|---|---|---|---|');
for (const item of [...missing.packages].sort((a, b) => (a.name < b.name ? -1 : 1))) {
  const status = item.status === 'supplemented' ? `已补入 ${(item.extractedFiles ?? []).map((f) => `\`texts/${f.sha256.slice(0, 16)}.txt\``).join(' ')}` : '上游未提供（不编造）';
  push(`| \`${item.name}\` | ${item.version} | ${cell(item.license)} | ${status} | ${item.registryUrl ? `<${item.registryUrl}>` : '—'} |`);
}
push('');
push('## 3. 分发义务摘要', '');
push('### 3.1 LGPL-3.0-or-later（`@img/sharp-win32-x64` 内的 libvips，随包）', '');
push(`- 许可表达式：\`Apache-2.0 AND LGPL-3.0-or-later\`（见该包 \`package.json\`）。`);
push(`- **LGPL-3.0 全文**：\`texts/${lgplText.file}\`（${lgplText.bytes} 字节，sha256 \`${lgplText.hash}\`）。该文件是上游随 LibreOffice 许可汇编一起提供的 LGPL-3.0 全文，本项目未改动任何字节；\`@img/sharp-win32-x64\` 自带的 \`LICENSE\`（\`texts/${[...textByHash.values()].find((t) => t.text.startsWith('Apache License'))?.file ?? '—'}\`）只有 Apache-2.0 正文，因此 LGPL 全文以本文件为准。`);
push('- **libvips 源码获取**：本项目未修改 libvips。对应源码可从上游取得：');
push('  - libvips 本体：<https://github.com/libvips/libvips>（payload 内 DLL 版本见文件名 `libvips-cpp-<version>.dll`）');
push('  - Windows 预编译与构建脚本：<https://github.com/lovell/sharp>（`@img/sharp-win32-x64` 的发布物即由该仓库的构建流程产出）');
push('- **可替换性（LGPL §4 动态链接要求）**：libvips 以 DLL 动态链接方式随包，接收者可自行替换 `node_modules/@img/sharp-win32-x64/lib/libvips-42.dll`（保持 ABI 版本一致即可），本项目不阻止替换。');
push('- 若后续修改 libvips，必须按 LGPL-3.0 提供修改后的源码；当前状态为「未修改」。');
push('- 分发时须同时保留 `@img/sharp-win32-x64/lib/*` 内的 DLL 与本节说明，不得只留 sharp 主包。', '');
push('### 3.2 Apache-2.0（sharp 主包、sherpa-onnx 等）', '');
push('- 随包部分：附 Apache-2.0 全文（`texts/` 内已含），保留上游 `NOTICE`/版权行（如有），修改过的文件须标注。');
push('- 已裁剪部分（sherpa-onnx 两包）：当前不分发，恢复时再补全文（上游 tarball 未附文本，需向上游索取）。', '');
push('### 3.3 MPL-2.0（LibreOffice Kit，当前已裁剪）', '');
push('- 当前不随包，无分发义务；若恢复分发：附 MPL-2.0 全文与包内 `program/license.txt`，公开 MPL 覆盖文件的源码获取方式，修改文件需保留修改说明与日期。', '');
push('### 3.4 MIT / ISC / BSD / 0BSD / Unlicense / Python-2.0 / (MIT OR CC0-1.0)', '');
push('- 随包部分：保留版权行与许可全文（见 §1 各行与 `THIRD-PARTY-LICENSES.md`）。');
push('- 这些许可不要求公开源码，但**不得删除版权与许可声明**。', '');
push('### 3.5 上游未提供文本的 17 包', '');
push('- `sherpa-onnx-node`、`sherpa-onnx-win-x64` 当前已裁剪；其余 15 包随包分发时依 §2 的上游地址提供来源说明，并在取得上游文本后补入 `texts/`（补入需重跑本生成器与 `verify-licenses.mjs`）。', '');
push('## 4. 重新生成与校验', '');
push('```powershell');
push('node education/licenses/tools/build-notice-v2.mjs          # 生成 NOTICE/THIRD-PARTY-LICENSES/EXCLUDED + data/license-status.json');
push('node education/licenses/tools/build-notice-v2.mjs --check   # 只校验磁盘上的文件是否与生成结果一致');
push('node education/licenses/tools/verify-licenses.mjs education/.local/evidence/T16/license-verify');
push('```', '');
push('生成器会先做三件事，任何一条不满足就报错退出：① inventory 的 sha256 必须与 manifest 记录一致；② payload 内缺失的包必须全部落在 §0.1 的裁剪组内；③ `sharp`/`@img/sharp-win32-x64` 必须在 payload 内且不在裁剪组。', '');

const notice = noticeLines.join('\n');

// ------------------------------------------------------- THIRD-PARTY-LICENSES
const textRows = [...textByHash.values()].sort((a, b) => (a.file < b.file ? -1 : 1));
const usersOf = new Map();
for (const row of rows) {
  for (const file of row.licenseFiles) {
    const entry = textByHash.get(file.sha256);
    if (entry === undefined) continue;
    const list = usersOf.get(entry.file) ?? [];
    if (!list.includes(row.name)) list.push(row.name);
    usersOf.set(entry.file, list);
  }
}
const textLines = [];
const tpush = (...lines) => textLines.push(...lines);
tpush('# 第三方许可全文索引（Third-Party License Texts）', '');
tpush('> 由 `education/licenses/tools/build-notice-v2.mjs` 生成，请勿手改。', '');
tpush(`- 去重后全文：**${textRows.length} 份**；引用它们的分发包：**${rows.length} 个**（其中随包 ${statusYes} 个）。`);
tpush('- 文件名 = 文件内容 SHA-256 的前 16 位；文本按字节原样保存，未做任何改写。');
tpush(`- LGPL-3.0 全文：\`texts/${lgplText.file}\`（${lgplText.bytes} 字节）；libvips 源码获取说明见 \`NOTICE.md\` §3.1。`);
tpush('- 上游未提供文本的 17 包不在此表内，见 `NOTICE.md` §2。', '');
tpush('| 文本文件 | SHA-256 | 字节 | 引用包数 | 引用包（示例） |', '|---|---|---|---|---|');
for (const entry of textRows) {
  const users = (usersOf.get(entry.file) ?? []).sort();
  const sample = users.slice(0, 3).map((name) => `\`${name}\``).join('、') || '—';
  const suffix = users.length > 3 ? ` 等 ${users.length} 个` : '';
  tpush(`| [${entry.file}](texts/${entry.file}) | \`${entry.hash}\` | ${entry.bytes} | ${refCounts.get(entry.file) ?? users.length} | ${users.length === 0 ? '—（仅 §2 补齐项引用）' : `${sample}${suffix}`} |`);
}
tpush('');
const thirdParty = textLines.join('\n');

// ------------------------------------------------------------------- EXCLUDED
const excludedLines = [];
const epush = (...lines) => excludedLines.push(...lines);
epush('# 5A 裁剪清单（EXCLUDED）', '');
epush('> 由 `education/licenses/tools/build-notice-v2.mjs` 生成，请勿手改。');
epush('> **判定口径**：本文件只列 `education/dist/student/app/node_modules` 实测**不存在**、且能归入裁剪策略的包。');
epush(`> 生成时 payload 共 ${payloadDirs.size} 个顶层条目、${statusYes} 个包随包、${statusTrim} 个包被裁剪。`, '');
epush('## 1. 被裁剪的包（12 包 / 5 组）', '');
epush('| 组 | 包 | 版本 | 许可 | 裁剪原因 | 恢复分发需承担的义务 |', '|---|---|---|---|---|---|');
for (const group of TRIM_GROUPS) {
  for (const row of absent.filter((entry) => entry.trimGroup?.id === group.id)) {
    epush(`| ${group.title} | \`${row.name}\` | ${row.version} | ${cell(row.license)} | ${group.reason} | ${group.restore} |`);
  }
}
epush('');
epush('## 2. 明确**不在**本清单内的包', '');
epush(`- \`sharp\` ${sharpRow.version}（Apache-2.0）：**随包**，学生端图片处理依赖；不在裁剪清单。`);
epush('- `@img/sharp-win32-x64`（Apache-2.0 AND LGPL-3.0-or-later）：**随包**，内含 libvips（LGPL-3.0-or-later）；');
epush('  分发义务见 `NOTICE.md` §3.1（LGPL 全文 + libvips 源码获取 + 允许替换 DLL）。');
epush('- 因此本文件与 `NOTICE.md` 的口径一致：`no (5A trim)` = 仅本清单这 12 个包，sharp/@img 一律 `yes`。', '');
epush('## 3. 恢复某个裁剪项时的步骤', '');
epush('1. 改 `education/scripts/packaging/build-student-payload.mjs` 的 `isCropped()`（去掉对应判断）；');
epush('2. 重打 payload：`node education/scripts/packaging/build-student-payload.mjs --keep-sharp --clean`；');
epush('3. 重跑 `node education/scripts/packaging/scan-payload.mjs education/dist/student`；');
epush('4. 重跑 `node education/licenses/tools/build-notice-v2.mjs`（本文件与 NOTICE 会自动改口径）；');
epush('5. 重跑 `node education/licenses/tools/verify-licenses.mjs <evidence-dir>` 留证。', '');
epush('## 4. 与旧版（2026-10-30 及以前）的差异', '');
epush('- 旧版把 `sharp`、`@img/sharp-win32-x64` 列为"裁剪根"，与 `--keep-sharp` 后的实物冲突，形成"正文说已裁剪、表格说随包"的自相矛盾；');
epush('- 新版以 payload 实测为准，sharp/@img 归入随包并在 `NOTICE.md` §3.1 承担 LGPL 义务；');
epush('- 旧版"近似裁剪闭包 22 包"是按依赖图推算的，含 `brotli`、`fontkit`、`saxes` 等实际仍在 payload 内的包，已删除该节。', '');
const excluded = excludedLines.join('\n');

// --------------------------------------------------------------- status (mach)
const status = {
  schemaVersion: 1,
  kind: 't16-license-status',
  generator: 'education/licenses/tools/build-notice-v2.mjs',
  basis: {
    inventory: { path: manifest.inventory.path, sha256: inventorySha, packages: rows.length },
    payload: { path: 'education/dist/student/app/node_modules', topLevelEntries: payloadDirs.size },
    missingLicenses: { count: missing.packages.length, supplemented: missing.packages.filter((p) => p.status === 'supplemented').length, absent: missing.packages.filter((p) => p.status === 'absent-in-tarball').length },
    texts: textRows.length,
  },
  shipped: statusYes,
  trimmed: statusTrim,
  trimGroups: TRIM_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    packages: absent.filter((row) => row.trimGroup?.id === group.id).map((row) => `${row.name}@${row.version}`),
  })),
  mustShip: LGPL_PACKAGES.map((name) => ({ name, shipped: rows.find((row) => row.name === name).shipped })),
  lgpl: { text: `texts/${lgplText.file}`, sha256: lgplText.hash, bytes: lgplText.bytes, libvipsFiles: vipsFiles },
  staleInputs: {
    'data/license-manifest.json#trimRoots': 'Stale: it still lists sharp/@img as trim roots. Payload-presence in this file is authoritative; trimRoots is not used.',
  },
};
const statusText = `${JSON.stringify(status, null, 2)}\n`;

// ------------------------------------------------------------------- emission
const outputs = [
  ['NOTICE.md', notice],
  ['THIRD-PARTY-LICENSES.md', thirdParty],
  ['EXCLUDED.md', excluded],
  [path.join('data', 'license-status.json'), statusText],
];
const hashes = {};
for (const [relative, body] of outputs) {
  const file = path.join(licensesRoot, relative);
  const next = body.endsWith('\n') ? body : `${body}\n`;
  hashes[relative] = sha256(Buffer.from(next, 'utf8'));
  if (target === 'check') {
    if (!existsSync(file)) fail(`${relative} missing`);
    if (readFileSync(file, 'utf8') !== next) fail(`${relative} is stale; run build-notice-v2.mjs`);
    continue;
  }
  writeFileSync(file, next, 'utf8');
}

if (target === 'check') {
  console.log(JSON.stringify({ ok: true, hashes }, null, 2));
} else {
  console.log(
    JSON.stringify(
      { ok: true, packages: rows.length, shipped: statusYes, trimmed: statusTrim, texts: textRows.length, hashes },
      null,
      2,
    ),
  );
}
