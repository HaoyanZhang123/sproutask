import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateContentPack } from '@edu/domain';
import { loadPack } from '../src/pack-loader.js';
import { domainFixturesRoot, packageRoot, readFixtureJson } from './helpers/fixtures.js';

interface ManifestCase {
  readonly id: string;
  readonly kind: string;
  readonly file: string;
  readonly expect: { readonly ok: boolean; readonly errorCodes?: readonly string[] };
}

const manifest = readFixtureJson<{ cases: readonly ManifestCase[] }>('manifest.json');

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

describe('consumes the frozen T01 pack fixtures (A28)', () => {
  const packCases = manifest.cases.filter((testCase) => testCase.kind === 'contentPack');

  it('has pack fixtures to consume instead of inventing a protocol', () => {
    expect(packCases.length).toBeGreaterThan(10);
    expect(packCases.some((testCase) => testCase.expect.ok)).toBe(true);
    expect(packCases.some((testCase) => !testCase.expect.ok)).toBe(true);
  });

  for (const testCase of packCases) {
    it(`${testCase.id} is ${testCase.expect.ok ? 'accepted' : 'rejected'}`, () => {
      const raw = readFixtureJson(testCase.file);
      const validated = validateContentPack(raw);
      expect(validated.ok).toBe(testCase.expect.ok);
      if (!validated.ok && testCase.expect.errorCodes !== undefined) {
        const codes = validated.issues.map((issue) => issue.code);
        for (const expected of testCase.expect.errorCodes) expect(codes).toContain(expected);
      }
      const loaded = loadPack(raw);
      expect(loaded.ok).toBe(testCase.expect.ok);
      if (!loaded.ok) {
        expect(loaded.issues.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('knowledge package boundary', () => {
  const srcRoot = path.join(packageRoot, 'src');
  const sourceFiles = walk(srcRoot).filter((file) => file.endsWith('.ts'));

  it('imports only @edu/domain, relative modules and approved node builtins', () => {
    const allowedNodeModules = new Set(['node:crypto', 'node:fs', 'node:path']);
    expect(sourceFiles.length).toBeGreaterThan(8);
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      expect(text, `${path.basename(file)} imports a foreign runtime`).not.toMatch(
        /from\s+['"](electron|react|vue|@deepseek-ai|dsh)/,
      );
      const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1] as string);
      for (const specifier of imports) {
        const allowed =
          specifier === '@edu/domain' ||
          specifier.startsWith('./') ||
          allowedNodeModules.has(specifier);
        expect(allowed, `${path.relative(packageRoot, file)} imports ${specifier}`).toBe(true);
      }
    }
  });

  it('keeps wall clock use confined to the measurement fallback', () => {
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      if (path.basename(file) === 'graph-index.ts') continue;
      expect(text.includes('Date.now('), `${path.basename(file)} reads the wall clock`).toBe(false);
    }
  });

  it('never writes storage or user data', () => {
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      expect(text.includes('writeFileSync')).toBe(false);
      expect(text.includes('appendFileSync')).toBe(false);
    }
  });

  it('declares one public entry, a CLI bin and no third party runtime dependency', () => {
    const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
      type?: string;
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      bin?: Record<string, string>;
    };
    expect(pkg.type).toBe('module');
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@edu/domain']);
    expect(Object.keys(pkg.exports ?? {})).toEqual(['.']);
    expect(pkg.bin?.['edu-validate-pack']).toBe('./bin/validate-pack.mjs');
    expect(statSync(path.join(packageRoot, 'bin', 'validate-pack.mjs')).isFile()).toBe(true);
  });
});
