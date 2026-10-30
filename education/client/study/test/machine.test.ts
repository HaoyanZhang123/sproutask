import { describe, expect, it } from 'vitest';
import { ActivityStateMachine, canTransition } from '../src/index.js';

describe('activity state machine', () => {
  it('allows only the documented draft/submitted/grading/feedback transitions', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'grading')).toBe(true);
    expect(canTransition('grading', 'feedback')).toBe(true);
    expect(canTransition('draft', 'feedback')).toBe(false);
    expect(canTransition('feedback', 'submitted')).toBe(false);
    expect(canTransition('cancelled', 'grading')).toBe(true);
    expect(canTransition('failed', 'draft')).toBe(true);
  });

  it('tracks the phase and refuses skipped transitions', () => {
    const machine = new ActivityStateMachine();
    expect(machine.phase).toBe('draft');
    expect(machine.transition('feedback')).toBe(false);
    expect(machine.phase).toBe('draft');
    expect(machine.transition('submitted')).toBe(true);
    expect(machine.transition('grading')).toBe(true);
    expect(machine.transition('feedback')).toBe(true);
    expect(machine.transition('draft')).toBe(true);
    expect(machine.phase).toBe('draft');
  });
});
