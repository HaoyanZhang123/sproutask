#!/usr/bin/env node
/**
 * A2/T16 — verify the generated license bundle without trusting the generator.
 *
 * Checks:
 *  1. every `texts/<hash>.txt` content hash is present in the T00 inventory
 *     license-file hashes or in a supplemented upstream text (no invented text);
 *  2. NOTICE.md package-row count equals the inventory package count (558);
 *  3. the 18 missing-text packages resolve to exactly 1 supplemented + 17 absent;
 *  4. required files exist and are non-empty.
 *
 * Usage: node education/licenses/tools/verify-licenses.mjs <evidence-dir>
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const licensesRoot = path.join(educationRoot, 'licenses');
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
const evidenceDir = process.argv[2];
if (evidenceDir === undefined) {
  console.error('usage: node education/licenses/tools/verify-licenses.mjs <evidence-dir>');
  process.exit(2);
}
const out = path.resolve(evidenceDir);
mkdirSync(out, { recursive: true });

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const missing = JSON.parse(readFileSync(path.join(licensesRoot, 'data', 'missing-licenses.json'), 'utf8'));
const textIndex = JSON.parse(readFileSync(path.join(licensesRoot, 'data', 'license-text-index.json'), 'utf8'));
const hoisted = path.join(educationRoot, '.local', 'cache', 'T16', 'hoisted-test', 'node_modules');

const upstreamHashes = new Set();
for (const record of inventory) {
  for (const file of record.licenseFiles ?? []) upstreamHashes.add(file.sha256);
}
for (const item of missing.packages) {
  for (const file of item.extractedFiles ?? []) upstreamHashes.add(file.sha256);
}
for (const file of missing.katex?.extractedFiles ?? []) upstreamHashes.add(file.sha256);

function sourceContentMatches(hash, sources) {
  for (const source of sources ?? []) {
    let file = null;
    if (source.startsWith('node_modules/')) {
      file = path.join(hoisted, ...source.slice('node_modules/'.length).split('/'));
    } else if (source.startsWith('licenses/')) {
      file = path.join(educationRoot, ...source.split('/'));
    }
    if (file === null || !existsSync(file)) continue;
    if (createHash('sha256').update(readFileSync(file)).digest('hex') === hash) return true;
  }
  return false;
}

const textsDir = path.join(licensesRoot, 'texts');
const textChecks = [];
for (const entry of readdirSync(textsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;
  if (entry.name === 'nodejs-LICENSE.txt') continue;
  const file = path.join(textsDir, entry.name);
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  const indexEntry = textIndex.find((item) => item.sha256 === hash);
  textChecks.push({
    file: path.relative(educationRoot, file).split(path.sep).join('/'),
    sha256: hash,
    bytes: statSync(file).size,
    upstreamMatch:
      upstreamHashes.has(hash) || (indexEntry !== undefined && sourceContentMatches(hash, indexEntry.sources)),
  });
}
const unmatched = textChecks.filter((item) => !item.upstreamMatch);

const notice = readFileSync(path.join(licensesRoot, 'NOTICE.md'), 'utf8');
const noticePackageRows = notice
  .split('\n')
  .filter((line) => /^\| `[^`]+` \| [^|]+ \| [^|]+ \| [^|]* \| (yes|no \(5A trim\)) \|/.test(line)).length;
const missingSupplemented = missing.packages.filter((item) => item.status === 'supplemented').length;
const missingAbsent = missing.packages.filter((item) => item.status === 'absent-in-tarball').length;

const required = [
  'NOTICE.md',
  'THIRD-PARTY-LICENSES.md',
  'NODEJS-NOTICE.md',
  'FONTS-NOTICE.md',
  'NATIVE-BINARIES.md',
  'EXCLUDED.md',
  'README.md',
  'data/license-manifest.json',
  'data/missing-licenses.json',
  'texts/nodejs-LICENSE.txt',
];
const missingFiles = required.filter((relative) => {
  const file = path.join(licensesRoot, ...relative.split('/'));
  return !existsSync(file) || statSync(file).size === 0;
});

const checks = {
  'all license texts match an upstream file hash': unmatched.length === 0,
  'NOTICE package rows equal inventory count': noticePackageRows === inventory.length,
  '18 missing packages = 1 supplemented + 17 absent':
    summary.packagesWithoutLicenseFile.length === 18 && missingSupplemented === 1 && missingAbsent === 17,
  'required files present and non-empty': missingFiles.length === 0,
};
const pass = Object.values(checks).every(Boolean);
const report = {
  generatedAt: new Date().toISOString(),
  inventory: {
    path: path.relative(educationRoot, inventoryPath).split(path.sep).join('/'),
    sha256: createHash('sha256').update(readFileSync(inventoryPath)).digest('hex'),
    packages: inventory.length,
    licenseFileHashes: upstreamHashes.size,
  },
  texts: {
    checked: textChecks.length,
    unmatched,
  },
  notice: {
    packageRows: noticePackageRows,
    expected: inventory.length,
  },
  missing: {
    count: summary.packagesWithoutLicenseFile.length,
    supplemented: missingSupplemented,
    absent: missingAbsent,
    statuses: missing.packages.map((item) => ({ name: item.name, version: item.version, status: item.status })),
  },
  requiredFilesMissing: missingFiles,
  checks,
  pass,
};
writeFileSync(path.join(out, 'license-verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ pass, checks, unmatched: unmatched.length, noticeRows: noticePackageRows }, null, 2));
process.exit(pass ? 0 : 1);
