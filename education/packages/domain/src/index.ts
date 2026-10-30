/**
 * @edu/domain public API.
 *
 * Consumers (storage/knowledge/importer/learner/visuals/runtime/client) must
 * import only from this entry point. Domain source never imports Node, DSH,
 * Electron or UI runtime modules.
 */

export * from './versions.js';
export * from './primitives.js';
export * from './validation.js';
export * from './canonical.js';
export * from './entities/sources.js';
export * from './entities/content.js';
export * from './entities/learning.js';
export * from './entities/system.js';
export * from './rules/content-rules.js';
export * from './rules/learning-rules.js';
export * from './rules/two-phase.js';
export * from './services/results.js';
export * from './services/ports.js';
export * from './services/dedupe.js';
