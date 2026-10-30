/**
 * @edu/tutor public entry (T07).
 *
 * Consumers (T13 composition root, tests) import only from this module:
 * teaching service, education tool factory, pedagogy policy, evidence guard,
 * mock/DSH gateway adapters and the Biology Skill wiring.
 */

export * from './types.js';
export * from './errors.js';
export * from './schema.js';
export * from './pedagogy.js';
export * from './evidence-guard.js';
export * from './attempt-pipeline.js';
export * from './mock-gateway.js';
export * from './gateway-adapter.js';
export * from './context.js';
export * from './tools.js';
export * from './tutor-service.js';
export * from './skill.js';
