/**
 * Equivalent answer paths for structural labelling (02 §7): the graphical
 * point-click path and the numbered list / typed-label path must produce the
 * same semantic answer, and neither may be graded differently.
 */

import { fail, ok, visualsError, type VisualsResult } from '../errors.js';
import type { DiagramRenderPlan } from './layout.js';

export interface DiagramTargetOption {
  readonly number: number;
  readonly nodeId: string;
  readonly label: string;
}

export function buildDiagramTargets(plan: DiagramRenderPlan): DiagramTargetOption[] {
  return plan.numberedTargets.map((target) => ({
    number: target.number,
    nodeId: target.nodeId,
    label: target.label,
  }));
}

export interface LabelSelectionInput {
  /** Either the node id (point-click path) ... */
  readonly targetId?: string;
  /** ... or the printed number (keyboard/list path). */
  readonly number?: number;
  readonly text: string;
}

export interface NormalizedLabelAnswer {
  readonly targetId: string;
  readonly text: string;
}

/** Normalizes text for rule comparison: width, case and whitespace insensitive. */
export function normalizeLabelText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[，。；、,.;]$/u, '')
    .toLowerCase();
}

/**
 * Resolves a selection to a node id and a canonical text answer.
 * Both the click path and the numbered path end up with the same shape.
 */
export function normalizeDiagramLabelAnswer(
  selections: readonly LabelSelectionInput[],
  targets: readonly DiagramTargetOption[],
): VisualsResult<readonly NormalizedLabelAnswer[]> {
  if (selections.length === 0) return fail(visualsError('ANSWER_EMPTY'));
  const byId = new Map(targets.map((target) => [target.nodeId, target]));
  const byNumber = new Map(targets.map((target) => [target.number, target]));
  const seen = new Set<string>();
  const out: NormalizedLabelAnswer[] = [];
  for (const selection of selections) {
    const target =
      selection.targetId !== undefined
        ? byId.get(selection.targetId)
        : selection.number !== undefined
          ? byNumber.get(selection.number)
          : undefined;
    if (target === undefined) return fail(visualsError('ANSWER_TARGET_UNKNOWN'));
    if (seen.has(target.nodeId)) return fail(visualsError('ANSWER_INVALID'));
    seen.add(target.nodeId);
    const text = normalizeLabelText(selection.text);
    if (text.length === 0) return fail(visualsError('ANSWER_EMPTY'));
    out.push({ targetId: target.nodeId, text });
  }
  return ok(out);
}

/** True when two labelling answers are semantically the same (both paths). */
export function sameDiagramLabelAnswer(
  left: readonly NormalizedLabelAnswer[],
  right: readonly NormalizedLabelAnswer[],
): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort((a, b) => (a.targetId < b.targetId ? -1 : 1));
  const sortedRight = [...right].sort((a, b) => (a.targetId < b.targetId ? -1 : 1));
  return sortedLeft.every(
    (entry, index) =>
      entry.targetId === sortedRight[index].targetId && entry.text === sortedRight[index].text,
  );
}
