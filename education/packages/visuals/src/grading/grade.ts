/**
 * Grading dispatch: one entry point for the four deterministic graders.
 *
 * The grader is chosen by the frozen `AnswerSchema.kind`, and the activity type
 * must agree with it. A mismatch is a content defect and never silently graded.
 */

import type { GradeResult } from '@edu/domain';

import { fail, ok, visualsError, type VisualsResult } from '../errors.js';
import { gradeChoice } from './choice.js';
import { gradeDiagramLabel } from './diagram-label.js';
import { gradeRelation } from './relation.js';
import { gradeText } from './text.js';
import type { GradingContext } from './types.js';

const EXPECTED_ACTIVITY_TYPE: Record<string, readonly string[]> = {
  text: ['recall', 'explain', 'transfer', 'image_review'],
  choice: ['choice'],
  diagram_label: ['diagram_label'],
  relation: ['relation'],
};

export function gradeAttempt(context: GradingContext): VisualsResult<GradeResult> {
  const schemaKind = context.activity.answerSchema.kind;
  if (context.answer.kind !== schemaKind) return fail(visualsError('ANSWER_INVALID'));
  const allowed = EXPECTED_ACTIVITY_TYPE[schemaKind] ?? [];
  if (!allowed.includes(context.activity.type)) {
    return fail(visualsError('ANSWER_INVALID', { detailsRef: `activity-type:${context.activity.type}` }));
  }
  switch (schemaKind) {
    case 'diagram_label':
      return gradeDiagramLabel(context);
    case 'choice':
      return gradeChoice(context);
    case 'relation':
      return gradeRelation(context);
    case 'text':
      return gradeText(context);
    default:
      return fail(visualsError('UNSUPPORTED'));
  }
}

export { gradeChoice, gradeDiagramLabel, gradeRelation, gradeText };
export { ok, fail };
