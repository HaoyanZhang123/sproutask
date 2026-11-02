#!/usr/bin/env node
/**
 * Explicit "not implemented" exit. Never prints success, never exits 0:
 * a stage script that has not been implemented must fail loudly.
 */

const script = process.argv[2] ?? '<unknown>';
const reason =
  process.argv[3] ??
  'stage not reached in T01; runtimeReady is blocked (T00.runtimeReady) and the owner is T13/T15/T16';

console.error(`not implemented: ${script}`);
console.error(`reason: ${reason}`);
console.error('see docs/rebuild/reports/T01.md for the current stage readiness table');
process.exit(2);
