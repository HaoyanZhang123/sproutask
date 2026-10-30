import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { domainFixturesRoot, packageRoot } from './helpers/fixtures.js';

const binPath = path.resolve(packageRoot, 'bin', 'validate-pack.mjs');
const packsDir = path.resolve(domainFixturesRoot, 'packs');

interface CliRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function run(args: readonly string[]): CliRun {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('content validation CLI (bin/validate-pack.mjs)', () => {
  it('passes a published full volume pack with exit 0', () => {
    const result = run([path.resolve(packsDir, 'valid-full.json')]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('RESULT: PASS (publication gate satisfied)');
    expect(result.stdout).toContain('full volume ready: yes');
    expect(result.stdout).toContain('summary: 1/1 pack(s) valid');
  });

  it('passes a candidate pack as trial content and says publication is not ready', () => {
    const result = run([path.resolve(packsDir, 'valid-candidate.json')]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('trust: candidate content');
    expect(result.stdout).toContain('publication not ready');
  });

  it('fails an invalid pack with a non zero exit code and code names', () => {
    const cycle = run([path.resolve(packsDir, 'invalid-prereq-cycle.json')]);
    expect(cycle.code).toBe(1);
    expect(cycle.stdout).toContain('RESULT: FAIL');
    expect(cycle.stdout).toContain('RELATION_CYCLE');

    const scope = run([path.resolve(packsDir, 'invalid-partial-complete.json')]);
    expect(scope.code).toBe(1);
    expect(scope.stdout).toContain('PACK_SCOPE_INVALID');
  });

  it('validates a directory and reports the summary', () => {
    const result = run([packsDir]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('summary:');
    expect(result.stdout).toMatch(/\d+\/\d+ pack\(s\) valid/);
  });

  it('emits machine readable JSON with --json', () => {
    const result = run([path.resolve(packsDir, 'valid-full.json'), '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      packs: { ok: boolean; publicationReady: boolean }[];
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.packs[0]?.ok).toBe(true);
    expect(parsed.packs[0]?.publicationReady).toBe(true);
  });

  it('exits 2 for usage and IO problems', () => {
    expect(run([]).code).toBe(2);
    expect(run(['--unknown-option']).code).toBe(2);
    expect(run([path.resolve(packsDir, 'does-not-exist.json')]).code).toBe(2);
    const help = run(['--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('usage:');
  });
});
