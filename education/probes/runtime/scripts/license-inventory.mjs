/**
 * T00 probe — license and redistribution inventory of the fixed npm closure.
 *
 * Usage: node scripts/license-inventory.mjs --probe <probe root> --out <evidence dir>
 *
 * Scans the installed pnpm closure (not the user's DSH install) and writes:
 *   license-inventory.json  per package: name, version, declared license,
 *                           LICENSE/NOTICE files (+ sha256), native/binary assets
 *   license-summary.json    aggregates and the gap list
 * Nothing is inferred: a package without a license field or license file is
 * reported as a gap, never assumed to be MIT.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const probe = arg('probe');
const out = arg('out');
if (!probe || !out) {
  console.error('usage: license-inventory.mjs --probe <probe root> --out <dir>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const store = join(probe, 'node_modules', '.pnpm');

const packages = new Map();
const binaryPattern = /\.(node|exe|dll|dylib|so|wasm|pak)$/i;
const fontPattern = /\.(woff2?|ttf|otf)$/i;

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function walkFiles(dir, depth = 0, acc = []) {
  if (depth > 6) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, depth + 1, acc);
    else acc.push(path);
  }
  return acc;
}

for (const entry of readdirSync(store, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const nm = join(store, entry.name, 'node_modules');
  if (!existsSync(nm)) continue;
  const scopeDirs = readdirSync(nm, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const scopeOrPkg of scopeDirs) {
    const candidates = scopeOrPkg.name.startsWith('@')
      ? readdirSync(join(nm, scopeOrPkg.name), { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => join(nm, scopeOrPkg.name, d.name))
      : [join(nm, scopeOrPkg.name)];
    for (const pkgDir of candidates) {
      const pkgJsonPath = join(pkgDir, 'package.json');
      if (!existsSync(pkgJsonPath)) continue;
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      } catch {
        continue;
      }
      if (!pkg.name || !pkg.version) continue;
      const key = `${pkg.name}@${pkg.version}`;
      if (packages.has(key)) continue;

      const files = walkFiles(pkgDir);
      const licenseFiles = files
        .filter((f) => /(^|[/\\])(LICEN[SC]E|NOTICE|COPYING)(\.[^/\\]*)?$/i.test(f))
        .map((f) => ({ file: f.slice(pkgDir.length + 1), sha256: sha256File(f) }));
      const binaryAssets = files.filter((f) => binaryPattern.test(f)).map((f) => f.slice(pkgDir.length + 1));
      const fontAssets = files.filter((f) => fontPattern.test(f)).length;

      packages.set(key, {
        name: pkg.name,
        version: pkg.version,
        official: pkg.name.startsWith('@deepseek-ai/'),
        license: pkg.license ?? null,
        licenses: pkg.licenses ?? null,
        repository: typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? null),
        homepage: pkg.homepage ?? null,
        licenseFiles,
        binaryAssets: binaryAssets.slice(0, 20),
        binaryAssetCount: binaryAssets.length,
        fontAssetCount: fontAssets,
      });
    }
  }
}

const all = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
const gaps = all.filter((p) => !p.license && !p.licenses && p.licenseFiles.length === 0);
const noLicenseField = all.filter((p) => !p.license && !p.licenses);
const noLicenseFile = all.filter((p) => p.licenseFiles.length === 0);
const withBinaries = all.filter((p) => p.binaryAssetCount > 0);
const official = all.filter((p) => p.official);
const thirdParty = all.filter((p) => !p.official);

writeFileSync(join(out, 'license-inventory.json'), `${JSON.stringify(all, null, 1)}\n`, 'utf8');
writeFileSync(
  join(out, 'license-summary.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      probeRoot: probe,
      totalPackages: all.length,
      officialPackages: official.length,
      thirdPartyPackages: thirdParty.length,
      officialLicenseValues: [...new Set(official.map((p) => p.license ?? '(none)'))],
      thirdPartyLicenseValues: [...new Set(thirdParty.map((p) => p.license ?? '(none)'))].sort(),
      packagesWithoutLicenseField: noLicenseField.map((p) => `${p.name}@${p.version}`),
      packagesWithoutLicenseFile: noLicenseFile.map((p) => `${p.name}@${p.version}`),
      gapsWithoutAnyLicenseEvidence: gaps.map((p) => `${p.name}@${p.version}`),
      packagesWithBinaryAssets: withBinaries.map((p) => ({
        name: p.name,
        version: p.version,
        binaryAssetCount: p.binaryAssetCount,
        sample: p.binaryAssets.slice(0, 3),
      })),
      packagesWithFontAssets: all.filter((p) => p.fontAssetCount > 0).map((p) => `${p.name}@${p.version}`),
    },
    null,
    1,
  )}\n`,
  'utf8',
);
console.log(
  JSON.stringify({
    totalPackages: all.length,
    official: official.length,
    thirdParty: thirdParty.length,
    gaps: gaps.length,
    noLicenseField: noLicenseField.length,
    noLicenseFile: noLicenseFile.length,
    binaries: withBinaries.length,
  }),
);
