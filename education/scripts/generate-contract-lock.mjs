#!/usr/bin/env node
/**
 * Regenerates docs/rebuild/contract-lock.json: contract versions, package
 * names/direction, command entry points, dependency licenses and SHA-256 for
 * every contract file. Run after any change to the frozen contract.
 */

import { writeFileSync } from 'node:fs';
import { buildContractLock } from './lib/lock.mjs';
import { workspacePath } from './lib/workspace.mjs';

const lock = {
  ...buildContractLock(),
  generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
};
const target = workspacePath('docs', 'rebuild', 'contract-lock.json');
writeFileSync(target, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
console.log(`contract-lock written: ${target}`);
console.log(`files hashed: ${lock.files.length}`);
console.log(`commands: ${lock.commands.length} (implemented=${lock.commands.filter((command) => command.implemented).length})`);
console.log(`contract version: ${lock.contract.version}`);
