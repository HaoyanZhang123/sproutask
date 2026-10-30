/**
 * Coverage ledger audit (05 §4 CoverageManifest; A09/A10 contributions,
 * publication gate input).
 *
 * The frozen domain validator already rejects the obvious shapes; this audit is
 * the service level report used by the publication gate and the content CLI:
 * totals must agree with the per chapter entries, every declared target must
 * have exactly one section entry, and every exclusion must carry a reason.
 */

import type { ContentPack, CoverageSection, Id } from '@edu/domain';
import { knowledgeIssue, type KnowledgeIssue } from './knowledge-errors.js';

export interface CoverageSectionAudit {
  readonly tocNodeId: Id;
  readonly status: CoverageSection['status'];
  readonly conceptCount: number;
  readonly sourceRefCount: number;
}

export interface CoverageAudit {
  readonly ok: boolean;
  readonly packId: Id;
  readonly packVersion: string;
  readonly scope: ContentPack['scope'];
  readonly coverageStatus: ContentPack['coverageStatus'];
  readonly targetSections: number;
  readonly sectionEntries: number;
  readonly coveredSections: number;
  readonly distinctConceptIds: number;
  readonly declaredConceptCount: number;
  readonly exclusionCount: number;
  readonly sections: readonly CoverageSectionAudit[];
  readonly issues: readonly KnowledgeIssue[];
}

export function checkCoverageManifest(pack: ContentPack): CoverageAudit {
  const issues: KnowledgeIssue[] = [];
  const manifest = pack.coverageManifest;
  const conceptIds = new Set(pack.concepts.map((concept) => concept.id));
  const tocIds = new Set(pack.toc.map((node) => node.id));

  if (manifest.courseEditionId !== pack.courseEditionId) {
    issues.push(
      knowledgeIssue(
        'INVALID_REFERENCE',
        '$.coverageManifest.courseEditionId',
        'coverage manifest belongs to another course edition',
      ),
    );
  }

  const targets = new Set<Id>();
  for (const targetId of manifest.targetTocNodeIds) {
    if (targets.has(targetId)) {
      issues.push(
        knowledgeIssue('DUPLICATE_ID', '$.coverageManifest.targetTocNodeIds', `duplicate target ${targetId}`),
      );
    }
    targets.add(targetId);
    if (!tocIds.has(targetId)) {
      issues.push(
        knowledgeIssue(
          'COVERAGE_REFERENCE_INVALID',
          '$.coverageManifest.targetTocNodeIds',
          `target toc node ${targetId} does not exist in this pack`,
        ),
      );
    }
  }

  const sectionsByToc = new Map<Id, CoverageSection>();
  for (const section of manifest.sections) {
    if (sectionsByToc.has(section.tocNodeId)) {
      issues.push(
        knowledgeIssue(
          'COVERAGE_REFERENCE_INVALID',
          `$.coverageManifest.sections.${section.tocNodeId}`,
          'duplicate coverage section entry',
        ),
      );
    }
    sectionsByToc.set(section.tocNodeId, section);
    if (!targets.has(section.tocNodeId)) {
      issues.push(
        knowledgeIssue(
          'COVERAGE_REFERENCE_INVALID',
          `$.coverageManifest.sections.${section.tocNodeId}`,
          'coverage section is not listed in targetTocNodeIds',
        ),
      );
    }
    for (const conceptId of section.conceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.push(
          knowledgeIssue(
            'DANGLING_REFERENCE',
            `$.coverageManifest.sections.${section.tocNodeId}.conceptIds`,
            `concept ${conceptId} does not exist in this pack`,
          ),
        );
      }
    }
    if (section.status === 'covered' && (section.conceptIds.length === 0 || section.sourceRefs.length === 0)) {
      issues.push(
        knowledgeIssue(
          'COVERAGE_INCOMPLETE',
          `$.coverageManifest.sections.${section.tocNodeId}`,
          'a covered section needs at least one concept and one source ref',
        ),
      );
    }
  }

  for (const targetId of targets) {
    if (!sectionsByToc.has(targetId)) {
      issues.push(
        knowledgeIssue(
          'COVERAGE_TARGET_MISSING_SECTION',
          `$.coverageManifest.sections.${targetId}`,
          'every target toc node needs exactly one chapter level coverage entry',
        ),
      );
    }
  }

  const distinctConceptIds = new Set<Id>();
  for (const section of manifest.sections) {
    for (const conceptId of section.conceptIds) distinctConceptIds.add(conceptId);
  }
  const coveredSections = manifest.sections.filter((section) => section.status === 'covered').length;

  if (manifest.totals.targetSections !== manifest.targetTocNodeIds.length) {
    issues.push(
      knowledgeIssue(
        'COVERAGE_TOTALS_MISMATCH',
        '$.coverageManifest.totals.targetSections',
        `declared ${manifest.totals.targetSections} targets but listed ${manifest.targetTocNodeIds.length}`,
      ),
    );
  }
  if (manifest.totals.coveredSections !== coveredSections) {
    issues.push(
      knowledgeIssue(
        'COVERAGE_TOTALS_MISMATCH',
        '$.coverageManifest.totals.coveredSections',
        `declared ${manifest.totals.coveredSections} covered sections but counted ${coveredSections}`,
      ),
    );
  }
  if (manifest.totals.conceptCount !== distinctConceptIds.size) {
    issues.push(
      knowledgeIssue(
        'COVERAGE_TOTALS_MISMATCH',
        '$.coverageManifest.totals.conceptCount',
        `declared ${manifest.totals.conceptCount} concepts but chapter entries reference ${distinctConceptIds.size}`,
      ),
    );
  }
  if (pack.concepts.length !== distinctConceptIds.size) {
    issues.push(
      knowledgeIssue(
        'COVERAGE_TOTALS_MISMATCH',
        '$.concepts',
        `${pack.concepts.length} concepts in the pack but chapter entries reference ${distinctConceptIds.size}`,
      ),
    );
  }

  const seenItems = new Set<string>();
  for (const [index, exclusion] of manifest.exclusions.entries()) {
    if (exclusion.item.trim().length === 0) {
      issues.push(
        knowledgeIssue(
          'INVALID_FORMAT',
          `$.coverageManifest.exclusions[${index}].item`,
          'an exclusion must name the item it excludes',
        ),
      );
    }
    if (exclusion.reason.trim().length === 0) {
      issues.push(
        knowledgeIssue(
          'COVERAGE_EXCLUSION_REASON_MISSING',
          `$.coverageManifest.exclusions[${index}].reason`,
          'an exclusion must state why the item is out of scope',
        ),
      );
    }
    const key = exclusion.item.trim();
    if (seenItems.has(key)) {
      issues.push(
        knowledgeIssue(
          'COVERAGE_EXCLUSION_DUPLICATE',
          `$.coverageManifest.exclusions[${index}].item`,
          `exclusion ${key} is listed more than once`,
        ),
      );
    }
    seenItems.add(key);
  }

  if (pack.scope === 'partial' && pack.coverageStatus === 'complete') {
    issues.push(
      knowledgeIssue(
        'PACK_SCOPE_INVALID',
        '$.coverageStatus',
        'a partial scope cannot claim complete volume coverage',
      ),
    );
  }
  if (pack.coverageStatus === 'complete') {
    for (const targetId of targets) {
      const section = sectionsByToc.get(targetId);
      if (section === undefined || section.status !== 'covered') {
        issues.push(
          knowledgeIssue(
            'COVERAGE_INCOMPLETE',
            `$.coverageManifest.sections.${targetId}`,
            'coverageStatus=complete requires every target section to be covered',
          ),
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    packId: pack.id,
    packVersion: pack.version,
    scope: pack.scope,
    coverageStatus: pack.coverageStatus,
    targetSections: manifest.targetTocNodeIds.length,
    sectionEntries: manifest.sections.length,
    coveredSections,
    distinctConceptIds: distinctConceptIds.size,
    declaredConceptCount: manifest.totals.conceptCount,
    exclusionCount: manifest.exclusions.length,
    sections: manifest.sections.map((section) => ({
      tocNodeId: section.tocNodeId,
      status: section.status,
      conceptCount: section.conceptIds.length,
      sourceRefCount: section.sourceRefs.length,
    })),
    issues,
  };
}
