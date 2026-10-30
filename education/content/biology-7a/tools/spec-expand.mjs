/**
 * T14 spec expansion: compact per-section concept specs -> domain Concept /
 * Activity / Rubric entities. Boilerplate (ids, schema versions, rubric
 * bindings, answer schemas) is generated so the hand-authored specs stay
 * focused on the subject matter.
 *
 * Spec shape (one file per chapter):
 * {
 *   "section": "u1ch2s2",
 *   "tocNodeId": "toc.bio7a.u1.ch2.s2",
 *   "concepts": [{
 *     "slug": "plant-cell-structure",
 *     "title": "...",
 *     "objectives": ["...", "..."],
 *     "explanation": "...",
 *     "misconceptions": [["wrong", "correction"], ...],
 *     "refs": ["sec.u1ch2s2.heading", "sec.u1ch2s2.obj1", ...],
 *     "basic": { "stem": "...", "options": ["a", "b", "c"], "correct": 0 },
 *     "variant": "情境/迁移题干",
 *     "criteria": [{ "description": "...", "evidence": ["..."], "misconceptions": ["..."], "counter": ["..."], "transfer": ["..."] }]
 *   }]
 * }
 */

const OPTION_IDS = ['option.a', 'option.b', 'option.c', 'option.d'];

/**
 * @param {any} spec
 * @param {Set<string>} refIds
 * @returns {{ concepts: any[], activities: any[], rubrics: any[], problems: string[] }}
 */
export function expandSpec(spec, refIds = new Set()) {
  const problems = [];
  const concepts = [];
  const activities = [];
  const rubrics = [];
  const defaultSection = String(spec.section);
  const defaultTocNodeId = spec.tocNodeId ?? null;
  if (!Array.isArray(spec.concepts) || spec.concepts.length === 0) {
    problems.push(`${defaultSection}: no concepts`);
    return { concepts, activities, rubrics, problems };
  }
  for (const item of spec.concepts) {
    const section = String(item.section ?? defaultSection);
    const tocNodeId = item.tocNodeId ?? defaultTocNodeId;
    if (typeof tocNodeId !== 'string') {
      problems.push(`${section}/${item.slug}: missing tocNodeId`);
      continue;
    }
    const conceptId = `concept.bio7a.${section}.${item.slug}`;
    const rubricId = `rubric.bio7a.${section}.${item.slug}`;
    const basicId = `activity.bio7a.${section}.${item.slug}.basic`;
    const variantId = `activity.bio7a.${section}.${item.slug}.variant`;
    const refKeys = Array.isArray(item.refs) ? item.refs : [];
    const refIdsForConcept = refKeys.map((key) => `source.bio7a.${key}`);
    for (const ref of refIdsForConcept) {
      if (!refIds.has(ref)) problems.push(`${conceptId}: missing source ref ${ref}`);
    }
    if (typeof item.explanation !== 'string' || item.explanation.length < 30) {
      problems.push(`${conceptId}: explanation too short`);
    }
    if (!Array.isArray(item.objectives) || item.objectives.length === 0) {
      problems.push(`${conceptId}: no objectives`);
    }
    if (!Array.isArray(item.criteria) || item.criteria.length < 2) {
      problems.push(`${conceptId}: needs 2 rubric criteria`);
    }
    const basic = item.basic ?? {};
    if (!Array.isArray(basic.options) || basic.options.length < 3 || typeof basic.correct !== 'number') {
      problems.push(`${conceptId}: basic choice activity incomplete`);
    }
    if (typeof item.variant !== 'string' || item.variant.length < 10) {
      problems.push(`${conceptId}: variant stem missing`);
    }
    if (!Array.isArray(item.misconceptions) || item.misconceptions.length === 0) {
      problems.push(`${conceptId}: no misconception`);
    }

    const misconceptions = (item.misconceptions ?? []).map(([statement, correction]) => ({
      statement,
      correction,
      sourceRefs: refIdsForConcept.slice(0, 2),
    }));

    concepts.push({
      schemaVersion: 1,
      id: conceptId,
      courseEditionId: 'course.biology-7a',
      title: item.title,
      aliases: item.aliases ?? [],
      placements: [tocNodeId],
      learningObjectives: item.objectives,
      explanation: item.explanation,
      misconceptions,
      sourceRefs: refIdsForConcept,
      rubricIds: [rubricId],
      activityIds: [basicId, variantId],
      reviewState: 'machine_checked',
    });

    activities.push({
      schemaVersion: 1,
      id: basicId,
      version: '1',
      courseEditionId: 'course.biology-7a',
      conceptIds: [conceptId],
      type: 'choice',
      stem: basic.stem,
      sourceRefs: refIdsForConcept,
      renderSpec: null,
      answerSchema: {
        kind: 'choice',
        selection: 'single',
        options: basic.options.map((label, index) => ({ id: OPTION_IDS[index], label })),
        correctOptionIds: [OPTION_IDS[basic.correct]],
      },
      rubricId,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    });

    activities.push({
      schemaVersion: 1,
      id: variantId,
      version: '1',
      courseEditionId: 'course.biology-7a',
      conceptIds: [conceptId],
      type: 'transfer',
      stem: item.variant,
      sourceRefs: refIdsForConcept,
      renderSpec: null,
      answerSchema: { kind: 'text', maxLength: 800 },
      rubricId,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    });

    rubrics.push({
      schemaVersion: 1,
      id: rubricId,
      version: '1',
      courseEditionId: 'course.biology-7a',
      conceptIds: [conceptId],
      criteria: (item.criteria ?? []).map((criterion, index) => ({
        criterionId: `criterion.bio7a.${section}.${item.slug}.${index + 1}`,
        description: criterion.description,
        acceptableEvidence: criterion.evidence,
        commonMisconceptions: criterion.misconceptions ?? [],
        counterExamples: criterion.counter ?? [],
        transferItems: criterion.transfer ?? [],
        feedbackSourceRefs: refIdsForConcept.slice(0, 3),
      })),
      reviewState: 'machine_checked',
    });
  }
  return { concepts, activities, rubrics, problems };
}
