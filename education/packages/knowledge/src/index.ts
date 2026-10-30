/**
 * @edu/knowledge public API (T04).
 *
 * Consumers import only from this entry (same rule as `@edu/domain`):
 * `graph.getToc` / `graph.getConcept` / `graph.getNeighborhood` /
 * `source.resolve` / `knowledge.*` implementations, publication rules and the
 * content validation CLI entry.
 */

export * from './knowledge-errors.js';
export * from './toc-index.js';
export * from './graph-index.js';
export * from './source-catalog.js';
export * from './progress-projection.js';
export * from './coverage.js';
export * from './compatibility.js';
export * from './publication.js';
export * from './content-hash.js';
export * from './pack-loader.js';
export * from './knowledge-service.js';
export * from './cli.js';
