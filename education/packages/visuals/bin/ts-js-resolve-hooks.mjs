/**
 * Node ESM loader hook: resolve `./x.js` specifiers to `./x.ts` when the .js
 * file does not exist. Lets the visuals evidence CLI run TypeScript sources
 * directly with plain `node` (no build step, no third-party loader).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js')) {
    const parent = context.parentURL;
    if (typeof parent === 'string' && parent.startsWith('file:')) {
      const target = new URL(specifier, parent);
      const typescript = new URL(`${target.href.slice(0, -3)}.ts`);
      if (!existsSync(fileURLToPath(target)) && existsSync(fileURLToPath(typescript))) {
        return { url: typescript.href, shortCircuit: true, format: 'module-typescript' };
      }
    }
  }
  return nextResolve(specifier, context);
}
