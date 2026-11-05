#!/usr/bin/env node
/**
 * Builds the native Windows desktop host (Rust + WebView2) and stages the exe
 * where the installer payload expects it.
 *
 *   education/desktop/host/Cargo.toml  ──cargo build --release──▶  target/release/sproutask-host.exe
 *                                                                            │
 *                                                              copy ──▶ desktop/host/dist/SproutAsk.exe
 *
 * Students double-click SproutAsk.exe: it starts the packaged node service and
 * hosts the student web root in a WebView2 window (see desktop/host/README.md).
 *
 * Requires the Rust toolchain (`cargo` on PATH or at DSH's cargo location) and
 * the WebView2 Runtime (present on Windows 11 and most updated Windows 10).
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const workspaceRoot = path.resolve(educationRoot, '..');
const hostRoot = path.join(educationRoot, 'desktop', 'host');
const manifest = path.join(hostRoot, 'Cargo.toml');
const outDir = path.join(hostRoot, 'dist');
const outFile = path.join(outDir, 'SproutAsk.exe');

function fail(message, code = 1) {
  console.error(`build-desktop-host: ${message}`);
  process.exit(code);
}

function findCargo() {
  const candidates = [
    process.env['CARGO'],
    'cargo',
    'D:/Runtime/Rust/cargo/bin/cargo.exe',
    path.join(process.env['USERPROFILE'] ?? '', '.cargo', 'bin', 'cargo.exe'),
  ].filter((value) => typeof value === 'string' && value.length > 0);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true });
    if ((probe.status ?? 1) === 0) return candidate;
  }
  return null;
}

if (!existsSync(manifest)) fail(`missing host manifest: ${manifest}`);
const cargo = findCargo();
if (cargo === null) {
  fail('cargo not found. Install the Rust MSVC toolchain, or pass CARGO=<path\\cargo.exe>.', 2);
}

console.log(`build-desktop-host: cargo = ${cargo}`);
console.log(`build-desktop-host: manifest = ${manifest}`);
const build = spawnSync(
  cargo,
  ['build', '--release', '--manifest-path', manifest, '--target-dir', path.join(hostRoot, 'target')],
  { stdio: 'inherit', windowsHide: true, cwd: workspaceRoot, env: process.env },
);
if ((build.status ?? 1) !== 0) fail(`cargo build failed with exit code ${build.status}`, build.status ?? 1);

const builtDir = path.join(hostRoot, 'target', 'release');
const builtCandidates = existsSync(builtDir)
  ? readdirSync(builtDir).filter(
      (entry) => entry.toLowerCase().endsWith('.exe') && statSync(path.join(builtDir, entry)).isFile(),
    )
  : [];
if (builtCandidates.length !== 1) {
  fail(
    `expected exactly one exe in ${builtDir}, found ${builtCandidates.length}: ${builtCandidates.join(', ')}`,
  );
}
const built = path.join(builtDir, builtCandidates[0]);
mkdirSync(outDir, { recursive: true });
copyFileSync(built, outFile);
console.log(`build-desktop-host: ${outFile} (${statSync(outFile).size} bytes)`);
