#!/usr/bin/env node
/**
 * A2/T16 — supplement the 18 closure packages that ship no license text.
 *
 * For every package listed in the T00 inventory as `packagesWithoutLicenseFile`,
 * download the exact registry tarball (to .local/cache/T16, never into Git),
 * extract it, and copy any upstream LICENSE/COPYING/NOTICE text into
 * `education/licenses/texts/supplemented/<pkg>@<version>/`.
 *
 * If the tarball really contains no license text, the package is recorded as
 * "upstream did not provide a text" with its registry URL and version — no
 * license text is ever invented or copied from another project.
 *
 * Also fetches the upstream KaTeX tarball to include its MIT license text, because
 * KaTeX fonts are bundled in `@deepseek-ai/dsh-web-frontend` without a KaTeX
 * package in the closure.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const inventoryPath = path.join(
  educationRoot,
  '.local',
  'evidence',
  'T00',
  'run-01',
  '40-licenses',
  'license-inventory.json',
);
const summaryPath = path.join(
  educationRoot,
  '.local',
  'evidence',
  'T00',
  'run-01',
  '40-licenses',
  'license-summary.json',
);
const cacheRoot = path.join(educationRoot, '.local', 'cache', 'T16');
const licensesRoot = path.join(educationRoot, 'licenses');
const supplementedRoot = path.join(licensesRoot, 'texts', 'supplemented');
const dataRoot = path.join(licensesRoot, 'data');

const LICENSE_FILE = /^(licen[cs]e|copying|notice|unlicense|copyright)([.-][a-z0-9+]+)?$/i;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function safeName(name, version) {
  return `${name.replaceAll('@', '').replaceAll('/', '__')}@${version}`;
}

function tarballUrl(name, version) {
  const bare = name.startsWith('@') ? name.split('/')[1] : name;
  const scope = name.startsWith('@') ? name.split('/')[0] : null;
  const encoded = scope === null ? name : `${scope}%2f${bare}`;
  return `https://registry.npmjs.org/${encoded}/-/${bare}-${version}.tgz`;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function findLicenseFiles(packageDir) {
  const files = walk(packageDir);
  return files.filter((file) => {
    const base = path.basename(file).toLowerCase();
    return LICENSE_FILE.test(base) && statSync(file).size > 0 && statSync(file).size < 2 * 1024 * 1024;
  });
}

async function download(url, target) {
  if (existsSync(target) && statSync(target).size > 0) return { cached: true, bytes: statSync(target).size };
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(target, buffer);
  return { cached: false, bytes: buffer.byteLength };
}

function extract(tarball, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  const result = spawnSync('tar', ['-xzf', tarball, '-C', targetDir], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`tar failed (${result.status}): ${result.stderr || result.stdout}`);
  }
}

async function supplementPackage(record, options) {
  const url = tarballUrl(record.name, record.version);
  const safe = safeName(record.name, record.version);
  const tarball = path.join(options.tarballs, `${safe}.tgz`);
  const extracted = path.join(options.extract, safe);
  const entry = {
    name: record.name,
    version: record.version,
    license: record.license ?? null,
    repository: record.repository ?? null,
    homepage: record.homepage ?? null,
    registryUrl: `https://www.npmjs.com/package/${record.name}/v/${record.version}`,
    tarballUrl: url,
    downloaded: null,
    tarballSha256: null,
    tarballBytes: null,
    extractedFiles: [],
    status: 'unknown',
    note: null,
  };
  try {
    const downloaded = await download(url, tarball);
    entry.downloaded = downloaded.cached ? 'cache' : 'network';
    entry.tarballBytes = statSync(tarball).size;
    entry.tarballSha256 = createHash('sha256').update(readFileSync(tarball)).digest('hex');
    extract(tarball, extracted);
    const packageDir = path.join(extracted, 'package');
    const licenseFiles = findLicenseFiles(packageDir);
    if (licenseFiles.length === 0) {
      entry.status = 'absent-in-tarball';
      entry.note =
        '上游 tarball 内没有 LICENSE/COPYING/NOTICE 文本；license 字段值仅作声明，本 NOTICE 记录来源 URL 与版本，不编造文本。';
    } else {
      entry.status = 'supplemented';
      for (const file of licenseFiles) {
        const relative = path.relative(extracted, file).split(path.sep).join('/');
        const target = path.join(supplementedRoot, safe, relative);
        mkdirSync(path.dirname(target), { recursive: true });
        const buffer = readFileSync(file);
        writeFileSync(target, buffer);
        entry.extractedFiles.push({
          file: relative,
          target: path.relative(educationRoot, target).split(path.sep).join('/'),
          sha256: sha256(buffer),
          bytes: buffer.byteLength,
        });
      }
    }
  } catch (error) {
    entry.status = 'error';
    entry.note = `下载/解包失败：${error instanceof Error ? error.message : String(error)}`;
  }
  return entry;
}

async function supplementKatex() {
  const url = 'https://registry.npmjs.org/katex';
  const meta = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!meta.ok) throw new Error(`katex metadata HTTP ${meta.status}`);
  const parsed = await meta.json();
  const version = parsed['dist-tags']?.latest;
  if (typeof version !== 'string') throw new Error('katex metadata has no latest version');
  const safe = `katex@${version}`;
  const tarball = path.join(cacheRoot, 'tarballs', `${safe}.tgz`);
  const extracted = path.join(cacheRoot, 'extract', safe);
  const downloaded = await download(tarballUrl('katex', version), tarball);
  extract(tarball, extracted);
  const licenseFiles = findLicenseFiles(path.join(extracted, 'package'));
  const entry = {
    name: 'katex',
    version,
    license: 'MIT',
    purpose: 'bundled KaTeX fonts used by @deepseek-ai/dsh-web-frontend (package not in the closure)',
    registryUrl: `https://www.npmjs.com/package/katex/v/${version}`,
    tarballUrl: tarballUrl('katex', version),
    downloaded: downloaded.cached ? 'cache' : 'network',
    tarballSha256: entryHash(tarball),
    tarballBytes: statSync(tarball).size,
    extractedFiles: [],
    status: licenseFiles.length === 0 ? 'absent-in-tarball' : 'supplemented',
    note:
      'KaTeX 字体随 dsh-web-frontend 打包；闭包中无 katex 包，因此从上游取同项目 MIT 文本。字体构建版本未记录，需人工确认（见 FONTS-NOTICE）。',
  };
  for (const file of licenseFiles) {
    const relative = path.relative(extracted, file).split(path.sep).join('/');
    const target = path.join(supplementedRoot, safe, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    const buffer = readFileSync(file);
    writeFileSync(target, buffer);
    entry.extractedFiles.push({
      file: relative,
      target: path.relative(educationRoot, target).split(path.sep).join('/'),
      sha256: sha256(buffer),
      bytes: buffer.byteLength,
    });
  }
  return entry;
}

function entryHash(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function main() {
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const missing = summary.packagesWithoutLicenseFile ?? [];
  const byName = new Map(inventory.map((record) => [record.name, record]));
  mkdirSync(path.join(cacheRoot, 'tarballs'), { recursive: true });
  mkdirSync(path.join(cacheRoot, 'extract'), { recursive: true });
  mkdirSync(supplementedRoot, { recursive: true });
  mkdirSync(dataRoot, { recursive: true });

  const options = {
    tarballs: path.join(cacheRoot, 'tarballs'),
    extract: path.join(cacheRoot, 'extract'),
  };
  const results = [];
  for (const label of missing) {
    const name = label.includes('@') ? label.slice(0, label.lastIndexOf('@')) : label;
    const record = byName.get(name);
    if (record === undefined) {
      results.push({
        name,
        version: null,
        status: 'inventory-missing',
        note: 'T00 inventory has no record for this package',
      });
      continue;
    }
    const result = await supplementPackage(record, options);
    results.push(result);
    process.stdout.write(`${label}: ${result.status}\n`);
  }
  let katex = null;
  try {
    katex = await supplementKatex();
    process.stdout.write(`katex@${katex.version}: ${katex.status}\n`);
  } catch (error) {
    katex = {
      name: 'katex',
      version: null,
      status: 'error',
      note: `KaTeX supplement failed: ${error instanceof Error ? error.message : String(error)}`,
    };
    process.stdout.write(`katex: error (${katex.note})\n`);
  }

  const supplemented = results.filter((item) => item.status === 'supplemented').length;
  const absent = results.filter((item) => item.status === 'absent-in-tarball').length;
  const payload = {
    generatedAt: new Date().toISOString(),
    inventoryPath: path.relative(educationRoot, inventoryPath).split(path.sep).join('/'),
    inventorySha256: entryHash(inventoryPath),
    missingCount: missing.length,
    supplementedCount: supplemented,
    absentCount: absent,
    errorCount: results.filter((item) => item.status === 'error').length,
    packages: results,
    katex,
    note:
      '许可文本只从各自 tarball 提取；缺文本的包只记录来源 URL/版本。tarball 只缓存在 .local/cache/T16，不进 Git。',
  };
  writeFileSync(path.join(dataRoot, 'missing-licenses.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `missing=${missing.length} supplemented=${supplemented} absent=${absent} errors=${payload.errorCount}\n`,
  );
}

main().catch((error) => {
  console.error(`fetch-missing-licenses failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
