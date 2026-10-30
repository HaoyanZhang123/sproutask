/**
 * @edu/runtime public entry (T01 phase B).
 *
 * Phase A shipped the not-bound skeleton; phase B adds the real DSH tutor
 * gateway, the rule grading port and the composition root used by the fixed
 * DSH host plugin. The DSH package itself is never imported here.
 */

export * from './registry.js';
export * from './pages.js';
export * from './composition.js';
export * from './runtime-composition.js';
export * from './g1-service.js';
export * from './adapters/system-clock.js';
export * from './adapters/sequential-ids.js';
export * from './adapters/session-ids.js';
export * from './adapters/mock-tutor.js';
export * from './adapters/dsh-not-bound.js';
export * from './adapters/dsh-tutor.js';
export * from './adapters/rule-grade.js';
