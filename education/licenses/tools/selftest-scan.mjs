#!/usr/bin/env node
/**
 * A2/T16 — self-test for `education/scripts/packaging/scan-payload.mjs`.
 *
 * Builds a clean synthetic payload (pack JSON + license text + plugin JS) and a
 * dirty one (PDF, page image, .env, secret key, journal JSONL, log, source file),
 * runs the scanner on both, and requires exit 0 / exit 1 respectively.
 *
 * Usage: node education/licenses/tools/selftest-scan.mjs <out-dir>
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const out = process.argv[2];
if (out === undefined) {
  console.error('usage: node education/licenses/tools/selftest-scan.mjs <out-dir>');
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const scanner = path.join(educationRoot, 'scripts', 'packaging', 'scan-payload.mjs');
const root = path.resolve(out);
const clean = path.join(root, 'payload-clean');
const dirty = path.join(root, 'payload-bad');

function write(relative, content) {
  const file = path.join(clean, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

mkdirSync(clean, { recursive: true });
mkdirSync(dirty, { recursive: true });

write('content/biology-7a/pack.json', JSON.stringify({ pack: 'synthetic-scan-fixture', concepts: [] }));
write('licenses/NOTICE.md', '# synthetic NOTICE\n');
write('licenses/texts/license-fixture.txt', 'MIT fixture license text\n');
write('runtime/host-plugin/lib/index.js', 'export function apply() {}\n');
write('launcher/start.cmd', '@echo off\r\n');

const dirtyFiles = {
  'content/textbook.pdf': 'synthetic pdf placeholder',
  'content/pages/page-01.png': Buffer.alloc(300 * 1024, 0),
  '.env': 'DEEPSEEK_API_KEY=redacted',
  'secrets/deepseek.key': 'redacted',
  'journal/events.jsonl': '{"synthetic":true}\n',
  'logs/runtime.log': 'synthetic log\n',
  'src/main.ts': 'export const x = 1;\n',
  'cache/node_modules/.cache/blob.bin': 'synthetic cache\n',
};
for (const [relative, content] of Object.entries(dirtyFiles)) {
  const file = path.join(dirty, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function run(target) {
  const result = spawnSync(process.execPath, [scanner, target, '--json'], { encoding: 'utf8' });
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

const cleanRun = run(clean);
const dirtyRun = run(dirty);
const cleanJson = JSON.parse(cleanRun.stdout);
const dirtyJson = JSON.parse(dirtyRun.stdout);
const codes = [...new Set(dirtyJson.violations.map((violation) => violation.code))].sort();
const requiredCodes = [
  'BUILD_CACHE',
  'ENV_FILE',
  'FORBIDDEN_PATH',
  'JOURNAL_FILE',
  'LOG_FILE',
  'PAGE_IMAGE',
  'PDF_FILE',
  'SECRET_FILE',
  'SOURCE_FILE',
];
const missingCodes = requiredCodes.filter((code) => !codes.includes(code));
const verdict = {
  generatedAt: new Date().toISOString(),
  scanner: path.relative(educationRoot, scanner).split(path.sep).join('/'),
  scannerSha256: hashFile(scanner),
  clean: {
    dir: path.relative(educationRoot, clean).split(path.sep).join('/'),
    exitCode: cleanRun.exitCode,
    ok: cleanJson.ok,
    scannedFiles: cleanJson.scannedFiles,
    violations: cleanJson.violations.length,
  },
  dirty: {
    dir: path.relative(educationRoot, dirty).split(path.sep).join('/'),
    exitCode: dirtyRun.exitCode,
    ok: dirtyJson.ok,
    scannedFiles: dirtyJson.scannedFiles,
    violations: dirtyJson.violations.length,
    codes,
    missingRequiredCodes: missingCodes,
  },
  pass: cleanRun.exitCode === 0 && dirtyRun.exitCode === 1 && missingCodes.length === 0,
};
writeFileSync(path.join(root, 'scan-selftest.json'), `${JSON.stringify(verdict, null, 2)}\n`, 'utf8');
writeFileSync(path.join(root, 'scan-clean.json'), cleanRun.stdout);
writeFileSync(path.join(root, 'scan-bad.json'), dirtyRun.stdout);
writeFileSync(
  path.join(root, 'scan-selftest.log'),
  [
    `clean exit=${cleanRun.exitCode} violations=${cleanJson.violations.length}`,
    `dirty exit=${dirtyRun.exitCode} violations=${dirtyJson.violations.length} codes=${codes.join(',')}`,
    `missing required codes: ${missingCodes.length === 0 ? '(none)' : missingCodes.join(',')}`,
    `PASS=${verdict.pass}`,
    '',
  ].join('\n'),
  'utf8',
);
console.log(JSON.stringify({ pass: verdict.pass, cleanExit: cleanRun.exitCode, dirtyExit: dirtyRun.exitCode, codes }, null, 2));
process.exit(verdict.pass ? 0 : 1);

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
