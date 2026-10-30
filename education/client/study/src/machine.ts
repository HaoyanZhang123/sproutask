/**
 * Explicit activity state machine (T12 step 2).
 *
 * draft → submitted → grading → feedback
 *                    ↘ failed | cancelled
 * failed/cancelled → grading (retry) or draft (edit)
 * feedback → draft (edit/new round)
 */

import type { StudyActivityPhase } from './types.js';

const TRANSITIONS: Record<StudyActivityPhase, readonly StudyActivityPhase[]> = {
  draft: ['submitted'],
  submitted: ['grading', 'cancelled', 'failed'],
  grading: ['feedback', 'failed', 'cancelled'],
  feedback: ['draft'],
  failed: ['grading', 'draft', 'cancelled'],
  cancelled: ['grading', 'draft'],
};

export class ActivityStateMachine {
  private current: StudyActivityPhase = 'draft';

  get phase(): StudyActivityPhase {
    return this.current;
  }

  can(next: StudyActivityPhase): boolean {
    return TRANSITIONS[this.current].includes(next);
  }

  transition(next: StudyActivityPhase): boolean {
    if (!this.can(next)) return false;
    this.current = next;
    return true;
  }

  reset(): void {
    this.current = 'draft';
  }
}

export function canTransition(from: StudyActivityPhase, to: StudyActivityPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isPending(phase: StudyActivityPhase): boolean {
  return phase === 'submitted' || phase === 'grading';
}
