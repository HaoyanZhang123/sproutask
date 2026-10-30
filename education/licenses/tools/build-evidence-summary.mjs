#!/usr/bin/env node
/**
 * A2/T16 — evidence summary for the license/NOTICE work.
 * Usage: node education/licenses/tools/build-evidence-summary.mjs <evidence-run-dir>
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const licensesRoot = path.join(educationRoot, 'licenses');
const runDir = process.argv[2];
if (runDir === undefined) {
  console.error('usage: node education/licenses/tools/build-evidence-summary.mjs <evidence-run-dir>');
  process.exit(2);
}
const out = path.resolve(runDir);
const rel = (file) => path.relative(educationRoot, file).split(path.sep).join('/');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function walk(dir, outFiles = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, outFiles);
    else outFiles.push(full);
  }
  return outFiles;
}

const licenseFiles = walk(licensesRoot)
  .filter((file) => !file.includes(`${path.sep}texts${path.sep}`))
  .map((file) => ({ path: rel(file), bytes: statSync(file).size, sha256: hash(file) }))
  .sort((a, b) => (a.path < b.path ? -1 : 1));

const textFiles = walk(path.join(licensesRoot, 'texts'))
  .map((file) => ({ path: rel(file), bytes: statSync(file).size, sha256: hash(file) }))
  .sort((a, b) => (a.path < b.path ? -1 : 1));

const manifest = JSON.parse(readFileSync(path.join(licensesRoot, 'data', 'license-manifest.json'), 'utf8'));
const missing = JSON.parse(readFileSync(path.join(licensesRoot, 'data', 'missing-licenses.json'), 'utf8'));
const verification = existsSync(path.join(out, 'license-verification.json'))
  ? JSON.parse(readFileSync(path.join(out, 'license-verification.json'), 'utf8'))
  : null;
const selftest = existsSync(path.join(out, 'scan-selftest.json'))
  ? JSON.parse(readFileSync(path.join(out, 'scan-selftest.json'), 'utf8'))
  : null;

const evidenceFiles = walk(out)
  .filter((file) => !file.endsWith('summary.json'))
  .map((file) => ({ path: rel(file), bytes: statSync(file).size, sha256: hash(file) }))
  .sort((a, b) => (a.path < b.path ? -1 : 1));

const summary = {
  task: 'T16',
  workItem: 'A2 third-party license NOTICE and missing-text completion',
  generatedAt: new Date().toISOString(),
  workspace: process.cwd(),
  environment: {
    platform: 'Windows',
    node: process.version,
    downloadRoot: 'education/.local/cache/T16/tarballs (git-ignored; no tarball in repository)',
    inventory: {
      path: 'education/.local/evidence/T00/run-01/40-licenses/license-inventory.json',
      sha256: hash(path.join(educationRoot, '.local/evidence/T00/run-01/40-licenses/license-inventory.json')),
      packages: manifest.packageCount,
    },
  },
  results: {
    packages: manifest.packageCount,
    officialPackages: manifest.officialPackages,
    thirdPartyPackages: manifest.thirdPartyPackages,
    uniqueLicenseTexts: manifest.uniqueLicenseTexts,
    missingLicenseTextPackages: missing.missingCount,
    supplemented: missing.supplementedCount,
    upstreamAbsent: missing.absentCount,
    missingErrors: missing.errorCount,
    trimmedApproxClosure: manifest.trimmedClosureSize,
    fonts: manifest.fonts.length,
    nativeBinaryPackages: manifest.binaries.length,
  },
  missingPackages: missing.packages.map((item) => ({
    name: item.name,
    version: item.version,
    license: item.license,
    status: item.status,
    extracted: item.extractedFiles?.map((file) => file.target) ?? [],
    registryUrl: item.registryUrl,
  })),
  katex: missing.katex,
  node: manifest.node,
  verification,
  scanSelftest: selftest,
  files: {
    licenseDocs: licenseFiles,
    texts: textFiles,
    evidence: evidenceFiles,
  },
};
writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify(
    {
      summary: rel(path.join(out, 'summary.json')),
      sha256: hash(path.join(out, 'summary.json')),
      docs: licenseFiles.length,
      texts: textFiles.length,
      evidence: evidenceFiles.length,
      verification: verification?.pass ?? null,
      scanSelftest: selftest?.pass ?? null,
    },
    null,
    2,
  ),
);
