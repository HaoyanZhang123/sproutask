/**
 * Recognition quality and clarification rules (02 §3.6, 07 A20).
 *
 * Blank / blurry / unreadable / low-confidence recognitions must ask the student
 * to confirm, retake or switch to text. They must never become a "wrong answer"
 * or a stable understanding judgement.
 */

import type { Clarification, ClarificationAction } from './types.js';

export interface QualityInput {
  readonly readable: boolean;
  readonly recognizedText: string;
  readonly matchesExpected: boolean | null;
  readonly uncertainty: number | null;
  readonly regionCount: number;
  readonly rotationDegrees: number;
  readonly injectionSuspected: boolean;
}

export interface QualityDecision {
  readonly clarify: boolean;
  readonly flags: readonly string[];
  readonly clarification: Clarification | null;
}

const MIN_TEXT_CHARS = 2;

export function assessRecognitionQuality(input: QualityInput): QualityDecision {
  const flags: string[] = [];
  const reasons: string[] = [];
  const actions = new Set<ClarificationAction>();

  const visibleChars = [...input.recognizedText.replace(/\s/g, '')].length;
  if (!input.readable) {
    flags.push('UNREADABLE');
    reasons.push('模型表示这张图片无法清楚辨认');
    actions.add('retake').add('text_fallback');
  }
  // No answer text at all means there is nothing to judge, even if the model
  // reports regions (a blank answer area is a region too).
  if (visibleChars === 0) {
    flags.push('BLANK');
    reasons.push('图片里几乎没有可识别的内容');
    actions.add('retake').add('edit_text');
  }
  if (visibleChars > 0 && visibleChars < MIN_TEXT_CHARS) {
    flags.push('LOW_TEXT');
    reasons.push('识别到的文字太少，可能不完整');
    actions.add('edit_text');
  }
  if (input.uncertainty === null || input.uncertainty > 0.5) {
    flags.push('LOW_CONFIDENCE');
    reasons.push('模型对这次识别/判断没有把握');
    actions.add('edit_text').add('retake');
  }
  if (input.rotationDegrees !== 0 && (visibleChars === 0 || !input.readable)) {
    flags.push('ROTATION_HINT');
    reasons.push('图片方向可能不对，旋转后重试更可靠');
    actions.add('rotate');
  }
  if (input.injectionSuspected) {
    flags.push('INJECTION_SUSPECTED');
    // Not a reason to block grading the content, but must be surfaced and the
    // evidence must stay uncertain (handled by the evaluator).
  }

  const mustClarify =
    flags.includes('UNREADABLE') ||
    flags.includes('BLANK') ||
    flags.includes('LOW_CONFIDENCE') ||
    flags.includes('LOW_TEXT');

  if (!mustClarify) {
    return { clarify: false, flags, clarification: null };
  }
  return {
    clarify: true,
    flags,
    clarification: {
      reasons,
      message: [
        '这张图片还有不确定的地方：',
        ...reasons.map((reason) => `· ${reason}`),
        '你可以确认或改正识别文字、重拍/旋转后重新上传，或直接改用文字作答。系统不会因为图片不清而判你答错。',
      ].join('\n'),
      actions: [...actions],
    },
  };
}
