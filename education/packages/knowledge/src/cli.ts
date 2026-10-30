/**
 * `validate-pack` CLI implementation (T04 step 4).
 *
 * Reads a content pack JSON file (or every `*.json` file in a directory), runs
 * the full T04 validation (frozen domain rules + TOC/graph + coverage ledger +
 * publication scope gate) and prints a human readable report.
 *
 * Exit codes: 0 = every pack passes, 1 = at least one pack is invalid,
 * 2 = usage or I/O problem (never a silent success). A *candidate* pack passes
 * structurally (it is legitimately usable in explicit trial mode) but the
 * report says publication is not ready.
 *
 * The CLI lives in this package (`bin/validate-pack.mjs`) on purpose: the
 * workspace command owner wires `content:validate` later; T04 must not edit
 * `education/scripts/`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { validatePack, type PackValidationSummary } from './pack-loader.js';
import type { KnowledgeIssue } from './knowledge-errors.js';

export const VALIDATE_PACK_USAGE = [
  'usage: node education/packages/knowledge/bin/validate-pack.mjs <pack.json | directory> [options]',
  '',
  'options:',
  '  --json             machine readable JSON report on stdout',
  '  --max-issues N     print at most N issues per pack (default 50)',
  '  --help             show this help',
  '',
  'exit codes: 0 = all packs valid, 1 = invalid pack(s), 2 = usage/IO error',
].join('\n');

export interface CliIo {
  out(text: string): void;
  err(text: string): void;
}

export interface PackFileReport {
  readonly file: string;
  readonly ok: boolean;
  readonly publicationReady: boolean;
  readonly summary: PackValidationSummary | null;
  readonly issues: readonly KnowledgeIssue[];
}

function collectPackFiles(target: string): string[] {
  const stats = statSync(target);
  if (stats.isDirectory()) {
    return readdirSync(target)
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .sort()
      .map((entry) => path.join(target, entry));
  }
  return [target];
}

function reportIssues(summary: PackValidationSummary): readonly KnowledgeIssue[] {
  const seen = new Set<string>();
  const merged: KnowledgeIssue[] = [];
  for (const issue of [...summary.issues, ...summary.publicationIssues]) {
    const key = `${issue.code}|${issue.path}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(issue);
  }
  return merged;
}

function printIssueList(io: CliIo, issues: readonly KnowledgeIssue[], maxIssues: number): void {
  for (const issue of issues.slice(0, maxIssues)) {
    io.out(`    - ${issue.code} ${issue.path}: ${issue.message}`);
  }
  if (issues.length > maxIssues) {
    io.out(`    ... ${issues.length - maxIssues} more issue(s) suppressed`);
  }
}

function printPackReport(io: CliIo, file: string, summary: PackValidationSummary, maxIssues: number): void {
  io.out(`pack: ${file}`);
  io.out(`  identity: ${summary.packId ?? '<missing id>'}@${summary.version ?? '<missing version>'}`);
  io.out(
    `  scope: ${summary.scope ?? '<missing>'}  coverage: ${summary.coverageStatus ?? '<missing>'}  status: ${
      summary.status ?? '<missing>'
    }`,
  );
  io.out(
    `  structure: toc=${summary.tocNodeCount} concepts=${summary.conceptCount} relations=${summary.relationCount}`,
  );
  if (summary.status === 'candidate') {
    io.out('  trust: candidate content (explicit trial only; strong claims disabled)');
  }
  io.out(`  full volume ready: ${summary.fullVolumeReady ? 'yes' : 'no'}`);
  if (!summary.ok) {
    const issues = reportIssues(summary);
    io.out(`  RESULT: FAIL (${issues.length} issue(s))`);
    printIssueList(io, issues, maxIssues);
    return;
  }
  if (summary.publicationReady) {
    io.out('  RESULT: PASS (publication gate satisfied)');
    return;
  }
  const publicationIssues = summary.publicationIssues;
  io.out(`  RESULT: PASS (valid content, publication not ready: ${publicationIssues.length} gate issue(s))`);
  printIssueList(io, publicationIssues, maxIssues);
}

export function runValidatePackCli(argv: readonly string[], io: CliIo): number {
  const targets: string[] = [];
  let json = false;
  let maxIssues = 50;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg === '--help' || arg === '-h') {
      io.out(VALIDATE_PACK_USAGE);
      return 0;
    }
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--max-issues') {
      const raw = argv[index + 1];
      const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        io.err(`validate-pack: --max-issues requires a positive integer\n${VALIDATE_PACK_USAGE}`);
        return 2;
      }
      maxIssues = parsed;
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      io.err(`validate-pack: unknown option ${arg}\n${VALIDATE_PACK_USAGE}`);
      return 2;
    }
    targets.push(arg);
  }
  if (targets.length === 0) {
    io.err(`validate-pack: a pack JSON file or directory is required\n${VALIDATE_PACK_USAGE}`);
    return 2;
  }

  const files: string[] = [];
  for (const target of targets) {
    try {
      files.push(...collectPackFiles(target));
    } catch (error) {
      io.err(`validate-pack: cannot read ${target}: ${(error as Error).message}`);
      return 2;
    }
  }
  if (files.length === 0) {
    io.err('validate-pack: no *.json pack files found in the given directory');
    return 2;
  }

  const reports: PackFileReport[] = [];
  let failed = false;
  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch (error) {
      io.err(`validate-pack: cannot read ${file}: ${(error as Error).message}`);
      return 2;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      failed = true;
      const issues: KnowledgeIssue[] = [
        { code: 'INVALID_FORMAT', path: '$', message: `not valid JSON: ${(error as Error).message}` },
      ];
      reports.push({
        file,
        ok: false,
        publicationReady: false,
        summary: null,
        issues,
      });
      if (!json) {
        io.out(`pack: ${file}`);
        io.out('  RESULT: FAIL');
        printIssueList(io, issues, maxIssues);
        io.out('');
      }
      continue;
    }
    const summary = validatePack(parsed);
    const publicationDeadlineMissed = summary.status === 'published' && !summary.publicationReady;
    const fileOk = summary.ok && !publicationDeadlineMissed;
    if (!fileOk) failed = true;
    reports.push({
      file,
      ok: fileOk,
      publicationReady: summary.publicationReady,
      summary,
      issues: reportIssues(summary),
    });
    if (!json) {
      printPackReport(io, file, summary, maxIssues);
      io.out('');
    }
  }

  if (json) {
    io.out(JSON.stringify({ ok: !failed, packs: reports }, null, 2));
  } else {
    const passed = reports.filter((report) => report.ok).length;
    io.out(`summary: ${passed}/${reports.length} pack(s) valid, ${reports.length - passed} invalid`);
  }
  return failed ? 1 : 0;
}
