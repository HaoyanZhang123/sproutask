/**
 * Architecture contract test: the pure domain stays free of DSH, Electron, UI
 * and Node runtime imports, never creates fact sources from wall clock/random,
 * and ships fixtures without textbook binaries.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(packageRoot, 'src');
const fixturesRoot = path.join(packageRoot, 'fixtures');

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const sourceFiles = walk(srcRoot).filter((file) => file.endsWith('.ts'));

describe('domain purity', () => {
  it('contains TypeScript source only', () => {
    expect(sourceFiles.length).toBeGreaterThan(5);
    expect(walk(srcRoot).every((file) => file.endsWith('.ts'))).toBe(true);
  });

  it('never imports DSH, Electron, UI frameworks or Node builtins', () => {
    const forbidden = /from\s+['"](node:|electron|react|vue|@deepseek-ai|dsh|fs|path|crypto|os|child_process)/;
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      expect(forbidden.test(text), `${path.relative(packageRoot, file)} imports a forbidden runtime`).toBe(
        false,
      );
      expect(text.includes('require('), `${path.relative(packageRoot, file)} uses require`).toBe(false);
    }
  });

  it('never uses Date.now or Math.random as a fact source', () => {
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      expect(text.includes('Date.now('), `${path.relative(packageRoot, file)} uses Date.now`).toBe(false);
      expect(text.includes('Math.random('), `${path.relative(packageRoot, file)} uses Math.random`).toBe(
        false,
      );
    }
  });

  it('has zero runtime third party dependencies and a single public entry', () => {
    const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    };
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(Object.keys(pkg.exports ?? {})).toEqual(['.']);
  });

  it('fixtures contain no textbook binaries or real textbook material', () => {
    const files = walk(fixturesRoot);
    expect(files.some((file) => /\.(pdf|png|jpe?g|webp)$/i.test(file))).toBe(false);
    expect(files.length).toBeGreaterThan(40);
  });
});
