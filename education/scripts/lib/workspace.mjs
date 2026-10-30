import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const EDUCATION_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const WORKSPACE_ROOT = path.resolve(EDUCATION_ROOT, '..');

export function educationPath(...parts) {
  return path.join(EDUCATION_ROOT, ...parts);
}

export function workspacePath(...parts) {
  return path.join(WORKSPACE_ROOT, ...parts);
}

export function relativeToEducation(absolutePath) {
  return path.relative(EDUCATION_ROOT, absolutePath).split(path.sep).join('/');
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}
`, 'utf8');
}

export function isDirectory(target) {
  return existsSync(target) && statSync(target).isDirectory();
}

export function isFile(target) {
  return existsSync(target) && statSync(target).isFile();
}

export function listDirectories(parent) {
  if (!isDirectory(parent)) return [];
  return readdirSync(parent)
    .map((entry) => path.join(parent, entry))
    .filter((entry) => isDirectory(entry))
    .sort();
}

export function runTsc(projectDir, extraArgs = []) {
  const tsc = educationPath('node_modules', 'typescript', 'bin', 'tsc');
  const result = spawnSync(process.execPath, [tsc, '-p', projectDir, '--noEmit', ...extraArgs], {
    cwd: EDUCATION_ROOT,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  return result.status ?? 1;
}

export function runVitest(projectDir, extraArgs = []) {
  const vitest = educationPath('node_modules', 'vitest', 'vitest.mjs');
  const result = spawnSync(process.execPath, [vitest, 'run', '--root', projectDir, ...extraArgs], {
    cwd: EDUCATION_ROOT,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  return result.status ?? 1;
}

export function runNodeScript(scriptRelativePath, args = []) {
  const script = educationPath(scriptRelativePath);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: EDUCATION_ROOT,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  return result.status ?? 1;
}

/** TypeScript projects that the full typecheck should cover (discovered, not hardcoded). */
export function discoverTsProjects() {
  const projects = [];
  for (const dir of listDirectories(educationPath('packages'))) {
    const tsconfig = path.join(dir, 'tsconfig.json');
    if (isFile(tsconfig)) projects.push(dir);
  }
  const integrationDir = educationPath('tests', 'integration');
  if (isFile(path.join(integrationDir, 'tsconfig.json'))) projects.push(integrationDir);
  const runtimeDir = educationPath('runtime');
  if (isFile(path.join(runtimeDir, 'tsconfig.json'))) projects.push(runtimeDir);
  for (const dir of listDirectories(educationPath('client'))) {
    const tsconfig = path.join(dir, 'tsconfig.json');
    if (isFile(tsconfig)) projects.push(dir);
  }
  return projects;
}

/** Vitest projects that the full offline test run should cover (discovered). */
export function discoverTestProjects() {
  const projects = [];
  for (const dir of listDirectories(educationPath('packages'))) {
    if (isFile(path.join(dir, 'vitest.config.ts'))) projects.push(dir);
  }
  const integrationDir = educationPath('tests', 'integration');
  if (isFile(path.join(integrationDir, 'tsconfig.json'))) projects.push(integrationDir);
  const runtimeDir = educationPath('runtime');
  if (isFile(path.join(runtimeDir, 'vitest.config.ts'))) projects.push(runtimeDir);
  for (const dir of listDirectories(educationPath('client'))) {
    if (isFile(path.join(dir, 'vitest.config.ts'))) projects.push(dir);
  }
  return projects;
}

export function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}


