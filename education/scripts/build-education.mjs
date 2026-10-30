#!/usr/bin/env node
/**
 * Builds the two phase-B DSH artifacts with esbuild (already an allowed
 * devDependency in the education workspace):
 *   runtime/host-plugin/lib/index.js   ESM host plugin bundle
 *   runtime/client-plugin/lib/client.js loader-protocol client root bundle
 *
 * The client bundle is wrapped in `window.__ModuleLoader__.load` and only
 * requires the frozen `react` module from the shell module table.
 */

import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..');
const runtimeRoot = path.join(educationRoot, 'runtime');

async function buildHost() {
  const outfile = path.join(runtimeRoot, 'host-plugin', 'lib', 'index.js');
  await build({
    entryPoints: [path.join(runtimeRoot, 'host-plugin', 'src', 'index.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  return outfile;
}

async function buildClient() {
  const temp = path.join(runtimeRoot, 'client-plugin', 'lib', '.client.bundle.cjs');
  const outfile = path.join(runtimeRoot, 'client-plugin', 'lib', 'client.js');
  await build({
    entryPoints: [path.join(runtimeRoot, 'client-plugin', 'src', 'index.ts')],
    outfile: temp,
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    external: ['react'],
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'silent',
    alias: {
      '@edu/client-shell': path.join(educationRoot, 'client', 'shell', 'src', 'index.ts'),
      '@edu/client-library': path.join(educationRoot, 'client', 'library', 'src', 'index.ts'),
      '@edu/client-map': path.join(educationRoot, 'client', 'map', 'src', 'index.ts'),
      '@edu/client-study': path.join(educationRoot, 'client', 'study', 'src', 'index.ts'),
      '@edu/client-visuals': path.join(educationRoot, 'client', 'visuals', 'src', 'index.ts'),
      '@edu/domain': path.join(educationRoot, 'packages', 'domain', 'src', 'index.ts'),
    },
    define: { 'process.env.NODE_ENV': '"production"' },
    jsx: 'transform',
  });
  const cjs = readFileSync(temp, 'utf8');
  rmSync(temp, { force: true });
  const wrapped = `window.__ModuleLoader__.load({
  id: '@edu/client-root',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${cjs.replace(/^/gm, '    ')}
    return module.exports;
  },
});
`;
  writeFileSync(outfile, wrapped, 'utf8');
  writeFileSync(
    path.join(runtimeRoot, 'client-plugin', 'lib', 'index.js'),
    '/** Host loader entry for the browser-only education root plugin: no host behavior. */\nexport function apply() {}\n',
    'utf8',
  );
  return outfile;
}

const host = await buildHost();
const client = await buildClient();
const sizes = [
  ['host', host, readFileSync(host).byteLength],
  ['client', client, readFileSync(client).byteLength],
];
for (const [kind, file, bytes] of sizes) {
  console.log(`[build] ${kind}: ${path.relative(educationRoot, file)} (${bytes} bytes)`);
}
