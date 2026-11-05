import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { EDUCATION_ROOT, WORKSPACE_ROOT, educationPath, readJson, workspacePath } from './workspace.mjs';

// 生成物目录不参与契约锁：它们由脚本产出、可能只存在于本机，锁一旦算进去，
// 换台机器/干净克隆上 contract:lock:verify 就会红。
const SKIP_DIRS = new Set(['node_modules', '.local', 'dist', 'coverage', 'output', '.git', '.pnpm']);
const SKIP_FILES = new Set(['contract-lock.json']);

// 本机类型检查/运行日志同样不进锁（gitignore 忽略、内容因机器而异）。
function isSkippedFile(name) {
  return SKIP_FILES.has(name) || name.endsWith('.tsbuildinfo') || name.endsWith('.log');
}

const CONTRACT_DOCS = [
  'docs/rebuild/00-START.md',
  'docs/rebuild/01-product-contract.md',
  'docs/rebuild/04-dsh-integration.md',
  'docs/rebuild/05-data-contracts.md',
  'docs/rebuild/06-system-design.md',
  'docs/rebuild/07-acceptance.md',
  'docs/rebuild/08-execution.md',
  'docs/rebuild/09-report-template.md',
  'docs/rebuild/tasks/T01-foundation.md',
];

const ROOT_FILES = [
  'education/package.json',
  'education/pnpm-lock.yaml',
  'education/pnpm-workspace.yaml',
  'education/tsconfig.base.json',
  'education/tsconfig.json',
  'education/.gitignore',
  'education/client/package.json',
  'education/client/tsconfig.json',
];

const ROOT_TREES = [
  'education/config',
  'education/scripts',
  'education/packages',
  'education/runtime',
  'education/client',
  'education/skills',
];

function walk(workspaceRelativeDir, output) {
  const absolute = workspacePath(workspaceRelativeDir);
  if (!existsSync(absolute)) return;
  const entries = readdirSync(absolute).sort();
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry) || isSkippedFile(entry)) continue;
    const full = path.join(absolute, entry);
    const relative = path.relative(WORKSPACE_ROOT, full).split(path.sep).join('/');
    if (statSync(full).isDirectory()) walk(relative, output);
    else output.push(relative);
  }
}

export function collectLockFiles() {
  const files = [];
  for (const file of ROOT_FILES) {
    if (existsSync(workspacePath(file))) files.push(file);
  }
  for (const tree of ROOT_TREES) walk(tree, files);
  for (const file of CONTRACT_DOCS) {
    if (existsSync(workspacePath(file))) files.push(file);
  }
  return [...new Set(files)].sort();
}

export function hashFiles(files) {
  return files.map((file) => {
    const bytes = readFileSync(workspacePath(file));
    return { path: file, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
}

function readInstalledPackage(name) {
  if (name === '@edu/domain') {
    return readJson(educationPath('packages', 'domain', 'package.json'));
  }
  const candidate = educationPath('node_modules', ...name.split('/'), 'package.json');
  if (!existsSync(candidate)) return null;
  return readJson(candidate);
}

function collectDependencies(pkg) {
  const dependencies = [];
  const scopes = [
    ['dependencies', pkg.dependencies ?? {}],
    ['devDependencies', pkg.devDependencies ?? {}],
  ];
  for (const [scope, entries] of scopes) {
    for (const name of Object.keys(entries).sort()) {
      const installed = readInstalledPackage(name);
      dependencies.push({
        name,
        scope,
        declared: entries[name],
        resolvedVersion: installed?.version ?? null,
        license: installed?.license ?? 'UNKNOWN',
        workspacePackage: name === '@edu/domain',
      });
    }
  }
  return dependencies;
}

function readWorkspacePackages() {
  const text = readFileSync(educationPath('pnpm-workspace.yaml'), 'utf8');
  const patterns = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*-\s*['"]?([^'"]+)['"]?\s*$/.exec(line);
    if (match !== null && (match[1].startsWith('packages') || match[1].startsWith('client'))) {
      patterns.push(match[1]);
    }
  }
  return patterns;
}

function commandsFromConfig(pkg) {
  const config = readJson(educationPath('config', 'commands.json'));
  return config.commands.map((command) => {
    const fromPackageJson = command.script === 'install' ? null : pkg.scripts?.[command.script] ?? null;
    return {
      script: command.script,
      entry: command.entry,
      packageScript: fromPackageJson,
      matchesPackageJson: command.script === 'install' ? true : fromPackageJson === command.entry,
      stage: command.stage,
      owner: command.owner,
      implemented: command.implemented,
    };
  });
}

export function buildContractLock() {
  const pkg = readJson(educationPath('package.json'));
  const commandConfig = readJson(educationPath('config', 'commands.json'));
  const runtimeEntry = educationPath('runtime', 'src', 'index.ts');
  const domainPkg = readJson(educationPath('packages', 'domain', 'package.json'));

  return {
    schemaVersion: 1,
    generatedBy: 'education/scripts/generate-contract-lock.mjs',
    contract: commandConfig.contract,
    workspace: {
      root: 'education',
      packageManager: pkg.packageManager,
      engines: pkg.engines ?? {},
      workspaceMemberPatterns: readWorkspacePackages(),
      legacyRootUntouched: true,
    },
    packages: [
      {
        name: domainPkg.name,
        version: domainPkg.version,
        license: domainPkg.license,
        path: 'education/packages/domain',
        workspaceMember: true,
        publicEntry: 'education/packages/domain/src/index.ts',
        exports: Object.keys(domainPkg.exports ?? {}),
        runtimeDependencies: Object.keys(domainPkg.dependencies ?? {}),
        consumedBy: [
          'education/packages/* (future T02/T03/T04/T06/T11)',
          'education/runtime (composition skeleton)',
          'education/client/* (DTO types only)',
        ],
      },
      {
        name: null,
        version: null,
        license: 'UNLICENSED',
        path: 'education/runtime',
        workspaceMember: false,
        publicEntry: existsSync(runtimeEntry) ? 'education/runtime/src/index.ts' : null,
        exports: [],
        runtimeDependencies: ['@edu/domain'],
        note: 'Composition/registration skeleton; not a pnpm workspace member in T01. T13 may promote it to a package and bump the lock.',
      },
      {
        name: '@edu/client-base',
        version: '0.0.0',
        license: 'UNLICENSED',
        path: 'education/client',
        workspaceMember: false,
        publicEntry: 'education/client/tsconfig.json',
        exports: [],
        runtimeDependencies: [],
        note: 'Shared framework-agnostic client TS config base; client/* feature packages are workspace members.',
      },
    ],
    dependencyDirection: [
      'education/packages/domain <- education/packages/* (future feature packages)',
      'education/packages/domain <- education/runtime (composition skeleton)',
      'education/packages/domain <- education/client/* (public DTO types only)',
      'education/runtime -> education/packages/domain (imports public entry only)',
      'education/packages/domain -X-> DSH / Electron / React / Vue / Node runtime (enforced by purity contract test)',
    ],
    commands: commandsFromConfig(pkg),
    dependencies: collectDependencies(pkg),
    files: hashFiles(collectLockFiles()),
  };
}

export function verifyContractLock(lock) {
  const problems = [];
  const expected = buildContractLock();
  const actualFiles = new Map((lock.files ?? []).map((entry) => [entry.path, entry.sha256]));
  const expectedFiles = new Map(expected.files.map((entry) => [entry.path, entry.sha256]));

  for (const [file, sha] of expectedFiles) {
    if (!actualFiles.has(file)) problems.push(`missing file hash: ${file}`);
    else if (actualFiles.get(file) !== sha) problems.push(`hash mismatch: ${file}`);
  }
  for (const file of actualFiles.keys()) {
    if (!expectedFiles.has(file)) problems.push(`stale file hash: ${file}`);
  }
  for (const key of ['contract', 'workspace', 'packages', 'commands', 'dependencies']) {
    if (JSON.stringify(lock[key]) !== JSON.stringify(expected[key])) {
      problems.push(`lock section changed: ${key}`);
    }
  }
  return problems;
}
