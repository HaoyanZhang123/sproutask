#!/usr/bin/env node
/**
 * Content validation CLI entry (T04): `validate-pack <pack.json | directory>`.
 *
 * The workspace has no TypeScript build step for development commands; Node
 * (>=22.18) strips erasable TypeScript types natively. Source files use the
 * Node ESM convention (`./x.js`) while the tree contains `.ts`, so this hook
 * maps a missing `.js` specifier onto the sibling `.ts` file. No dependency is
 * added and no generated output is required.
 */

import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.endsWith('.js') && context.parentURL !== undefined) {
        const candidate = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, shortCircuit: true };
        }
      }
      throw error;
    }
  },
});

const { runValidatePackCli } = await import('../src/cli.ts');

const exitCode = runValidatePackCli(process.argv.slice(2), {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
});
process.exitCode = exitCode;
