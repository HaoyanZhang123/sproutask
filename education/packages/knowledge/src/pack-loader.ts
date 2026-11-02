/**
 * Pack loader: one place that turns untrusted content JSON into an indexed,
 * validated snapshot (frozen domain validation + TOC index + graph index +
 * coverage audit + publication gate).
 */

import { validateContentPack, type ContentPack } from '@edu/domain';
import {
  failBuild,
  issuesFromDomain,
  type BuildResult,
  type KnowledgeIssue,
} from './knowledge-errors.js';
import { buildTocIndex, type TocIndex } from './toc-index.js';
import { buildKnowledgeGraph, type KnowledgeGraph } from './graph-index.js';
import { checkCoverageManifest, type CoverageAudit } from './coverage.js';
import { evaluatePublication, validatePublication, type PublicationGate, type PublicationValidation } from './publication.js';

export interface PackSnapshot {
  readonly pack: ContentPack;
  readonly toc: TocIndex;
  readonly graph: KnowledgeGraph;
  readonly coverage: CoverageAudit;
  readonly publication: PublicationGate;
  readonly validation: PublicationValidation;
}

export interface PackLoadOptions {
  /**
   * Extra known source ref ids (from the source catalogue). When provided,
   * concept source refs are checked for dangling ids as well.
   */
  readonly sourceRefIds?: ReadonlySet<string>;
}

export function loadPack(input: unknown, options: PackLoadOptions = {}): BuildResult<PackSnapshot> {
  const validated = validateContentPack(input, {
    sourceRefIds: options.sourceRefIds,
  });
  if (!validated.ok) return failBuild(issuesFromDomain(validated.issues));
  const pack = validated.value;

  const toc = buildTocIndex(pack);
  if (!toc.ok) return failBuild(toc.issues);
  const graph = buildKnowledgeGraph(pack);
  if (!graph.ok) return failBuild(graph.issues);

  const coverage = checkCoverageManifest(pack);
  const validation = validatePublication(pack);
  return {
    ok: true,
    value: {
      pack,
      toc: toc.value,
      graph: graph.value,
      coverage,
      publication: evaluatePublication(pack),
      validation,
    },
  };
}

export interface PackValidationSummary {
  /** Structural + graph + coverage coherence (candidate packs can pass this). */
  readonly ok: boolean;
  /** Publication gate: only a published pack inside an honest scope passes. */
  readonly publicationReady: boolean;
  readonly issues: readonly KnowledgeIssue[];
  readonly publicationIssues: readonly KnowledgeIssue[];
  readonly packId: string | null;
  readonly version: string | null;
  readonly scope: string | null;
  readonly coverageStatus: string | null;
  readonly status: string | null;
  readonly conceptCount: number;
  readonly relationCount: number;
  readonly tocNodeCount: number;
  readonly fullVolumeReady: boolean;
}

/** CLI/readiness helper: validation report without throwing on bad content. */
export function validatePack(input: unknown, options: PackLoadOptions = {}): PackValidationSummary {
  const loaded = loadPack(input, options);
  if (!loaded.ok) {
    const pack = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
    const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
    return {
      ok: false,
      publicationReady: false,
      issues: loaded.issues,
      publicationIssues: loaded.issues,
      packId: asString(pack['id']),
      version: asString(pack['version']),
      scope: asString(pack['scope']),
      coverageStatus: asString(pack['coverageStatus']),
      status: asString(pack['status']),
      conceptCount: Array.isArray(pack['concepts']) ? pack['concepts'].length : 0,
      relationCount: Array.isArray(pack['relations']) ? pack['relations'].length : 0,
      tocNodeCount: Array.isArray(pack['toc']) ? pack['toc'].length : 0,
      fullVolumeReady: false,
    };
  }
  const snapshot = loaded.value;
  const coverageKeys = new Set(
    snapshot.coverage.issues.map((issue) => `${issue.code}|${issue.path}|${issue.message}`),
  );
  const publicationIssues = snapshot.validation.issues.filter(
    (issue) => !coverageKeys.has(`${issue.code}|${issue.path}|${issue.message}`),
  );
  const coverageCoherent = snapshot.coverage.ok;
  return {
    ok: coverageCoherent,
    publicationReady: snapshot.validation.ok,
    issues: snapshot.coverage.issues,
    publicationIssues,
    packId: snapshot.pack.id,
    version: snapshot.pack.version,
    scope: snapshot.pack.scope,
    coverageStatus: snapshot.pack.coverageStatus,
    status: snapshot.pack.status,
    conceptCount: snapshot.pack.concepts.length,
    relationCount: snapshot.pack.relations.length,
    tocNodeCount: snapshot.pack.toc.length,
    fullVolumeReady: snapshot.publication.fullVolumeReady,
  };
}
