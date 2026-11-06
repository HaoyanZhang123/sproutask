/**
 * Teaching decision engine (T07, product contract §3 "教学模式/教学方式",
 * acceptance §4 twelve teaching classes).
 *
 * Design rules enforced here:
 *  - guidance first, but explanations, demonstrations and corrections are
 *    always available on request — there is no "never answer" guardrail;
 *  - an actual answer / worked solution is marked `disclosure`, which the
 *    attempt pipeline turns into non-independent evidence;
 *  - two consecutive unresolved failures force a step-by-step demonstration
 *    and a difficulty reduction instead of an endless probe loop;
 *  - facts must cite resolvable source refs; the message composer never invents
 *    a page number or a textbook quotation;
 *  - review starts with recall and then moves to discriminate / transfer /
 *    prerequisite repair according to the answer, not a fixed script.
 *
 * Semantic interpretation of free text belongs to the model (`signals`). This
 * engine only consumes the validated signal envelope plus deterministic
 * evidence (grade, attempt history, session state).
 */

import type { GradeCriterion, HelpKind, Id } from '@edu/domain';
import type {
  DifficultyDirection,
  GuidanceLevel,
  PedagogicalActionKind,
  PedagogicalDecision,
  ReviewStage,
  TutorAnswerQuality,
  TutorIntent,
  TutorPedagogyPolicy,
  TutorSessionState,
  TutorSignals,
} from './types.js';
import { DEFAULT_PEDAGOGY_POLICY, DEFAULT_TUTOR_SIGNALS } from './types.js';

export interface GradeSummary {
  readonly correct: 'yes' | 'no' | 'unclear';
  readonly coreMisconception: boolean;
  readonly termOnly: boolean;
  readonly requiresClarification: boolean;
  readonly criteria: readonly GradeCriterion[];
}

export interface PedagogyInput {
  readonly mode: 'learn' | 'review';
  readonly turnIndex: number;
  readonly signals: TutorSignals;
  readonly grade: GradeSummary | null;
  readonly helpRequest: HelpKind | null;
  readonly state: TutorSessionState;
  readonly attemptSubmitted: boolean;
  readonly prerequisiteConceptId: Id | null;
  readonly prerequisiteTitle: string | null;
  readonly conceptSourceRefs: readonly Id[];
  readonly activitySourceRefs: readonly Id[];
  readonly conflictSourceRefs: readonly Id[];
  readonly policy?: TutorPedagogyPolicy;
}

const INTENTS: readonly TutorIntent[] = [
  'none',
  'wants_answer',
  'requests_explanation',
  'requests_hint',
  'requests_example',
  'frustrated',
  'confused',
  'off_topic',
  'textbook_conflict',
  'transfer_question',
  'skip',
  'end',
];

const ANSWER_QUALITIES: readonly TutorAnswerQuality[] = [
  'correct',
  'partial',
  'incorrect',
  'term_only',
  'unclear',
  'not_answered',
];

function asStringEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Validates a model-supplied signal envelope. Unknown keys are ignored (the
 * model is untrusted input, not an authority); invalid values fall back to the
 * conservative default instead of widening behaviour.
 */
export function readTutorSignals(value: unknown): TutorSignals {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0;
  const imageQuality =
    raw.imageQuality === 'clear' || raw.imageQuality === 'blurry' || raw.imageQuality === 'unreadable'
      ? raw.imageQuality
      : null;
  return {
    intent: asStringEnum(raw.intent, INTENTS, 'none'),
    confidence,
    answerQuality: asStringEnum(raw.answerQuality, ANSWER_QUALITIES, 'not_answered'),
    coreMisconception: asBoolean(raw.coreMisconception, false),
    missingPrerequisite: asBoolean(raw.missingPrerequisite, false),
    textbookConflict: asBoolean(raw.textbookConflict, false),
    imageQuality,
    crossChapter: asBoolean(raw.crossChapter, false),
    answerDisclosed: asBoolean(raw.answerDisclosed, asBoolean(raw.disclosure, false)),
  };
}

/**
 * T15 F6: conservative detector for "the model already disclosed the answer".
 *
 * The structured envelope is model output and may simply omit the flag (the T15
 * probes saw full explanations delivered under `decision.action=probe_question,
 * disclosure=false`). These markers are unambiguous disclosure phrasing, not a
 * semantic judgement of arbitrary prose: a hint that does not reveal the answer
 * never matches them.
 */
const DISCLOSURE_TEXT_PATTERNS: readonly RegExp[] = [
  /完整答案|参考答案|标准答案|答案如下|答案是|答案为|正确答案是/,
  /完整讲解|完整解释|详细讲解|完整步骤|分步示范|完整示范|逐步示范/,
  /已标记为看过答案|直接披露|标记(?:为|成)?\s*\*{0,2}\s*disclosure|disclosure\s*[:：（]/i,
  /披露/,
  /直接给(你)?(答案|完整|术语|结论)|直接告诉你(答案|结论)/,
  /第[一二三四五1-5]步[:：]/,
];

export function detectAnswerDisclosure(text: string): boolean {
  if (typeof text !== 'string' || text.trim().length === 0) return false;
  return DISCLOSURE_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

const SOURCE_ID_RUN = /source\.[a-z0-9][a-z0-9._-]*(?:\s*[、,，]\s*source\.[a-z0-9][a-z0-9._-]*)*/gi;
const ACTIVITY_ID = /activity\.[a-z0-9][a-z0-9._-]*/gi;

/**
 * Student-visible text must not contain internal source/activity ids. The model
 * keeps echoing them from tool results even when instructed not to, so the ids
 * are replaced deterministically at the boundary instead of hoping for prompt
 * compliance. Page numbers and readable references are untouched.
 */
export function sanitizeStudentText(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return text;
  return text
    .replace(SOURCE_ID_RUN, '本节的出处')
    .replace(ACTIVITY_ID, '本项活动');
}

/** Merges the model-flag and the text detector; the flag is never downgraded. */
export function withAnswerDisclosure(signals: TutorSignals, text: string): TutorSignals {
  if (signals.answerDisclosed) return signals;
  return detectAnswerDisclosure(text) ? { ...signals, answerDisclosed: true } : signals;
}

export const EMPTY_SIGNALS = DEFAULT_TUTOR_SIGNALS;

export function summarizeGrade(
  grade: {
    readonly criteria: readonly GradeCriterion[];
    readonly requiresClarification: boolean;
  },
  signals: TutorSignals,
): GradeSummary {
  const criteria = grade.criteria;
  const anyNotMet = criteria.some((criterion) => criterion.met === 'no');
  const allMet = criteria.length > 0 && criteria.every((criterion) => criterion.met === 'yes');
  const anyUnclear = criteria.some((criterion) => criterion.met === 'unclear');
  const correct = anyNotMet ? 'no' : anyUnclear ? 'unclear' : allMet ? 'yes' : 'unclear';
  return {
    correct,
    // Only the semantic reading marks a *core* misconception; a generic rubric
    // failure is handled as an ordinary wrong answer (hint first).
    coreMisconception: signals.coreMisconception,
    termOnly: signals.answerQuality === 'term_only',
    requiresClarification: grade.requiresClarification,
    criteria,
  };
}

function uniqueIds(ids: readonly Id[], limit = 6): readonly Id[] {
  return [...new Set(ids.filter((id) => id.length > 0))].slice(0, limit);
}

function decision(
  action: PedagogicalActionKind,
  rationale: string,
  guidance: GuidanceLevel,
  options: {
    readonly disclosure?: boolean;
    readonly difficulty?: DifficultyDirection;
    readonly representationChanged?: boolean;
    readonly factualClaims?: boolean;
    readonly sourceRefs?: readonly Id[];
    readonly reviewStage?: ReviewStage | null;
  } = {},
): PedagogicalDecision {
  return {
    action,
    rationale,
    guidance,
    disclosure: options.disclosure ?? false,
    difficulty: options.difficulty ?? 'same',
    representationChanged: options.representationChanged ?? false,
    factualClaims: options.factualClaims ?? false,
    sourceRefs: options.sourceRefs ?? [],
    reviewStage: options.reviewStage ?? null,
  };
}

function stageAfterReviewDecision(
  current: ReviewStage | null,
  correct: boolean,
  missingPrerequisite: boolean,
): ReviewStage {
  if (missingPrerequisite) return 'prerequisite';
  if (current === null || current === 'prerequisite') {
    return correct ? 'discriminate' : 'discriminate';
  }
  if (current === 'recall') return correct ? 'discriminate' : 'prerequisite';
  if (current === 'discriminate') return correct ? 'transfer' : 'prerequisite';
  return 'transfer';
}

/**
 * Chooses exactly one teaching action for this turn.
 * Deterministic: same state + signals + grade ⇒ same decision (offline replay).
 *
 * T15 F6: the action chosen from the learner's request is kept, but if the model
 * actually disclosed the complete answer/steps (envelope flag or unambiguous
 * prose), the decision is marked `disclosure` so the next attempt is recorded as
 * assisted/non-independent evidence instead of silently counting as unaided.
 */
export function decidePedagogy(input: PedagogyInput): PedagogicalDecision {
  const decision = decideCore(input);
  const answered = input.signals.answerDisclosed;
  if (!answered) return decision;
  // A probing prefix must never precede a full answer: when the reply already
  // disclosed the answer/steps while the decision was still "probe", the student
  // would see "先用一句话说说你的理解：" followed by the complete answer.
  const action =
    decision.action === 'probe_question' || decision.action === 'hint'
      ? 'layered_explanation'
      : decision.action;
  return {
    ...decision,
    action,
    disclosure: true,
    factualClaims: decision.factualClaims || action === 'layered_explanation',
    sourceRefs: action === 'layered_explanation' ? uniqueIds([...decision.sourceRefs, ...input.conceptSourceRefs]) : decision.sourceRefs,
    rationale: `${decision.rationale}; the model reply actually disclosed the answer or complete steps (answerDisclosed)`,
  };
}

function decideCore(input: PedagogyInput): PedagogicalDecision {
  const policy = input.policy ?? DEFAULT_PEDAGOGY_POLICY;
  const signals = input.signals;
  const grade = input.grade;
  const help = input.helpRequest;
  const conceptSources = uniqueIds(input.conceptSourceRefs);
  const activitySources = uniqueIds([...input.activitySourceRefs, ...conceptSources]);
  const conflictSources = uniqueIds([...input.conflictSourceRefs, ...conceptSources]);
  const failuresAfter =
    input.state.consecutiveFailures + (grade !== null && grade.correct === 'no' ? 1 : 0);
  const probesAfter = input.state.consecutiveProbes + 1;

  /* 1. An unreadable answer must not be judged wrong and must not produce evidence. */
  if (
    input.attemptSubmitted &&
    (signals.imageQuality === 'blurry' ||
      signals.imageQuality === 'unreadable' ||
      grade?.requiresClarification === true)
  ) {
    return decision('clarify_image', 'answer recognition is uncertain; no judgement is recorded', 'none', {
      factualClaims: false,
      sourceRefs: [],
    });
  }

  /* 2. Explicit help requests are honoured immediately (never mechanically refused). */
  if (help === 'answer') {
    return decision('answer_disclosure', 'student explicitly asked for the answer', 'answer', {
      disclosure: true,
      factualClaims: true,
      sourceRefs: activitySources,
    });
  }
  if (help === 'worked_solution') {
    return decision('worked_example', 'student requested a worked solution', 'demonstration', {
      disclosure: true,
      difficulty: 'reduced',
      representationChanged: true,
      factualClaims: true,
      sourceRefs: activitySources,
    });
  }
  if (help === 'explanation') {
    return decision('layered_explanation', 'student requested a full explanation', 'explanation', {
      factualClaims: true,
      sourceRefs: conceptSources,
    });
  }
  if (help === 'example') {
    return decision('example', 'student requested an example', 'explanation', {
      factualClaims: true,
      sourceRefs: conceptSources,
    });
  }
  if (help === 'hint') {
    return decision('hint', 'student requested a hint', 'hint', {
      difficulty: 'reduced',
    });
  }

  /* 3. A prose request for the answer is also honoured and marked as disclosure. */
  if (signals.intent === 'wants_answer') {
    return decision('answer_disclosure', 'student asked for the answer in prose', 'answer', {
      disclosure: true,
      factualClaims: true,
      sourceRefs: activitySources,
    });
  }

  /* 4. Answer already shown this round: confirmation only, never a mastery claim. */
  if (input.state.disclosure && input.attemptSubmitted) {
    return decision(
      'confirm_understanding',
      'answer was disclosed in this round; this attempt is assisted evidence only',
      'none',
      { difficulty: 'same' },
    );
  }

  /* 5. Wrong answer handling: explicit correction, then demonstration, never endless probing. */
  if (grade !== null && grade.correct === 'no') {
    if (failuresAfter >= policy.escalateAfterFailures) {
      return decision(
        'worked_example',
        `${failuresAfter} consecutive unresolved failures: switch representation and demonstrate step by step`,
        'demonstration',
        {
          disclosure: true,
          difficulty: 'reduced',
          representationChanged: true,
          factualClaims: true,
          sourceRefs: activitySources,
        },
      );
    }
    if (grade.coreMisconception) {
      return decision(
        'explicit_correction',
        'the answer contains a core misconception; correct it explicitly before moving on',
        'explanation',
        { factualClaims: true, sourceRefs: conceptSources },
      );
    }
    return decision('hint', 'first unsuccessful attempt: give a scaffolded hint', 'hint', {
      difficulty: 'reduced',
    });
  }

  /* 6. Textbook conflict: show both claims with their sources; do not invent authority. */
  if (signals.textbookConflict || signals.intent === 'textbook_conflict') {
    return decision(
      'source_conflict',
      'student statement conflicts with the material; separate the claims and cite sources',
      'explanation',
      { factualClaims: true, sourceRefs: conflictSources },
    );
  }

  /* 7. Missing prerequisite: offer the prerequisite, never lock the target concept. */
  if ((signals.missingPrerequisite || signals.intent === 'confused') && input.prerequisiteConceptId !== null) {
    return decision(
      'prerequisite_support',
      'the current answer suggests a missing prerequisite; offer it without locking the target',
      'explanation',
      {
        difficulty: 'reduced',
        factualClaims: true,
        sourceRefs: conceptSources,
        reviewStage: input.mode === 'review' ? 'prerequisite' : null,
      },
    );
  }

  /* 8. Review mode: recall first, then discriminate / transfer / prerequisite repair. */
  if (input.mode === 'review') {
    const stage = input.state.reviewStage;
    if (!input.attemptSubmitted && input.turnIndex === 0) {
      return decision('review_recall', 'review starts with an unaided recall attempt', 'probe', {
        reviewStage: 'recall',
      });
    }
    if (!input.attemptSubmitted) {
      if (stage === 'transfer') {
        return decision('review_transfer', 'continue the transfer stage', 'probe', {
          factualClaims: true,
          sourceRefs: conceptSources,
          reviewStage: 'transfer',
        });
      }
      return decision('review_recall', 'keep the recall attempt open; hints are available', 'probe', {
        reviewStage: stage ?? 'recall',
      });
    }
    const correct = grade !== null && grade.correct === 'yes';
    const nextStage = stageAfterReviewDecision(stage, correct, signals.missingPrerequisite);
    if (correct && nextStage === 'transfer') {
      return decision('review_transfer', 'recall/discrimination succeeded; move to transfer', 'probe', {
        factualClaims: true,
        sourceRefs: conceptSources,
        reviewStage: 'transfer',
      });
    }
    if (correct && stage === 'transfer') {
      return decision('confirm_understanding', 'transfer evidence collected; close the review turn', 'none', {
        difficulty: 'increased',
        reviewStage: 'transfer',
      });
    }
    if (correct) {
      return decision(
        'review_discriminate',
        'recall succeeded; discriminate against a common misconception',
        'probe',
        { factualClaims: true, sourceRefs: conceptSources, reviewStage: nextStage },
      );
    }
    if (nextStage === 'prerequisite') {
      return decision(
        'review_prerequisite',
        'unsuccessful review answer points at a prerequisite gap',
        'explanation',
        {
          difficulty: 'reduced',
          factualClaims: true,
          sourceRefs: conceptSources,
          reviewStage: 'prerequisite',
        },
      );
    }
    return decision(
      'review_discriminate',
      'recall was unsuccessful; change the representation to a discrimination task',
      'hint',
      { difficulty: 'reduced', representationChanged: true, factualClaims: true, sourceRefs: conceptSources, reviewStage: nextStage },
    );
  }

  /* 9. Term recitation: ask for an own-words explanation, but cap the probing. */
  if (grade !== null && grade.correct !== 'no' && signals.answerQuality === 'term_only') {
    if (probesAfter > policy.maxConsecutiveProbes) {
      return decision(
        'layered_explanation',
        'repeated term-only answers: explain the meaning instead of asking again',
        'explanation',
        { factualClaims: true, sourceRefs: conceptSources },
      );
    }
    return decision('probe_question', 'answer repeats terms without meaning: probe once for own words', 'probe');
  }

  /* 10. Correct answer: confirm and continue without inventing a mastery claim. */
  if (grade !== null && grade.correct === 'yes') {
    return decision('confirm_understanding', 'answer met the rubric criteria', 'none', {
      difficulty: input.state.difficulty === 'reduced' ? 'same' : input.state.difficulty === 'standard' ? 'increased' : 'same',
    });
  }

  /* 11. Cross-chapter transfer question. */
  if (signals.crossChapter || signals.intent === 'transfer_question') {
    return decision('transfer_bridge', 'student asks for a cross-chapter connection', 'explanation', {
      factualClaims: true,
      sourceRefs: conceptSources,
    });
  }

  /* 12. Frustration without two failures: explain and reduce pressure (not another probe). */
  if (signals.intent === 'frustrated') {
    return decision('layered_explanation', 'student is frustrated; lower pressure and explain', 'explanation', {
      difficulty: 'reduced',
      factualClaims: true,
      sourceRefs: conceptSources,
    });
  }

  /* 13. Unclear/partial answer without a specific signal: scaffold, then explain when capped. */
  if (input.attemptSubmitted && grade !== null) {
    if (probesAfter > policy.maxConsecutiveProbes) {
      return decision('layered_explanation', 'probe cap reached; give a layered explanation', 'explanation', {
        factualClaims: true,
        sourceRefs: conceptSources,
      });
    }
    return decision('hint', 'answer is partial/unclear: give a scaffolded hint', 'hint', {
      difficulty: 'reduced',
    });
  }

  /* 14. Opening turn: guidance-first probe, with an explicit offer of explanation. */
  if (input.turnIndex === 0) {
    return decision('probe_question', 'start with a short diagnostic question about the concept', 'probe');
  }

  if (probesAfter > policy.maxConsecutiveProbes) {
    return decision('layered_explanation', 'probe cap reached; give a layered explanation', 'explanation', {
      factualClaims: true,
      sourceRefs: conceptSources,
    });
  }

  return decision('hint', 'continue with a scaffolded hint', 'hint', { difficulty: 'reduced' });
}

/* ------------------------------------------------------------- messages */

export interface MessageParams {
  readonly conceptTitle: string;
  readonly activityStem: string | null;
  readonly referenceAnswer: string | null;
  readonly prerequisiteTitle: string | null;
  readonly conflictNote: string | null;
  readonly sourceRefs: readonly Id[];
  readonly sourceMissing: boolean;
  readonly evidenceNote: string | null;
}

const ACTION_PREFIX: Readonly<Record<PedagogicalActionKind, string>> = {
  probe_question: '先用一句话说说你的理解：',
  hint: '给你一个提示，不用急着答完整：',
  layered_explanation: '可以，我先分层讲清楚：',
  example: '举个例子帮助理解：',
  worked_example: '我带你一步步做一遍：',
  explicit_correction: '这里需要明确更正一个常见误解：',
  confirm_understanding: '你的回答抓住了关键：',
  answer_disclosure: '这是本题的完整答案（已标记为看过答案）：',
  clarify_image: '这张图片我无法确认，先不把它当作答错。请重传清晰图片，或用文字描述你看到的部位。',
  prerequisite_support: '这道题会用到前置概念，先补这一块更稳：',
  source_conflict: '你提到的说法和材料不完全一致，我把两边的依据分开列出：',
  transfer_bridge: '换个章节也能用同一条原理：',
  review_recall: '复习先不看材料，试着回忆：',
  review_discriminate: '现在做一次辨析：',
  review_transfer: '把这条原理迁移到新情境：',
  review_prerequisite: '复习卡住的地方可能缺前置，先看这个：',
  skip: '好，这次先跳过；不会记为完成，也不会判错。',
  end: '本次学习结束。',
};

/** Composes the student-facing message; never invents page numbers or quotes. */
export function composeStudentMessage(
  decision: PedagogicalDecision,
  modelText: string,
  params: MessageParams,
): string {
  const lines: string[] = [];
  // 披露答案时不能还挂着"只给你提示，不用急着答完整"的前缀：学生要的是答案，
  // 这句话会自相矛盾（线上实测：要答案的回复开头仍是"给你一个提示"）。
  // 分层讲解等动作本身的引导语已经贴合，保持不变。
  const discloseOverride =
    decision.disclosure && (decision.action === 'hint' || decision.action === 'probe_question');
  const prefix = discloseOverride
    ? '这次直接说给你听（已标记为看过答案）：'
    : ACTION_PREFIX[decision.action];
  const body = modelText.trim();
  if (decision.action === 'answer_disclosure') {
    const reference =
      params.referenceAnswer !== null && params.referenceAnswer.length > 0
        ? params.referenceAnswer
        : '这道题没有核定的标准答案记录，下面给出评分要点与概念解释。';
    lines.push(`${prefix}${reference}`);
    if (body.length > 0) lines.push(body);
  } else if (
    decision.action === 'skip' ||
    decision.action === 'end' ||
    decision.action === 'clarify_image'
  ) {
    lines.push(prefix);
    if (body.length > 0) lines.push(body);
  } else {
    lines.push(`${prefix}${body.length > 0 ? ` ${body}` : ''}`);
  }

  if (decision.action === 'source_conflict' && params.conflictNote !== null) {
    lines.push(params.conflictNote);
  }
  if (decision.action === 'prerequisite_support' || decision.action === 'review_prerequisite') {
    if (params.prerequisiteTitle !== null) {
      lines.push(`前置概念：${params.prerequisiteTitle}（是否先学由你决定，不会锁定当前概念）。`);
    }
  }
  if (decision.action === 'probe_question' && params.activityStem !== null) {
    lines.push(`当前任务：${params.activityStem}`);
  }

  if (decision.factualClaims) {
    if (params.sourceRefs.length > 0) {
      // 只给可读引用；内部 sourceRef id 属于证据层，不给学生看。
      lines.push('参考：课本原文（点“查看出处”可看页码）。');
    } else if (params.sourceMissing) {
      lines.push('这一点我还没有核对到课本原文，先不下结论。');
    }
  }

  if (params.evidenceNote !== null) {
    lines.push(params.evidenceNote);
  }
  return lines.join('\n');
}

/* --------------------------------------------------------------- helpers */

export function helpKindsForAction(action: PedagogicalActionKind): readonly HelpKind[] {
  switch (action) {
    case 'hint':
      return ['hint'];
    case 'example':
      return ['example'];
    case 'layered_explanation':
    case 'explicit_correction':
    case 'source_conflict':
    case 'prerequisite_support':
    case 'transfer_bridge':
    case 'review_prerequisite':
      return ['explanation'];
    case 'worked_example':
      return ['worked_solution'];
    case 'answer_disclosure':
      return ['answer'];
    default:
      return [];
  }
}

/** Review stage implied by a review action, or null for non-review actions. */
export function reviewStageOfAction(action: PedagogicalActionKind): ReviewStage | null {
  switch (action) {
    case 'review_recall':
      return 'recall';
    case 'review_discriminate':
      return 'discriminate';
    case 'review_transfer':
      return 'transfer';
    case 'review_prerequisite':
      return 'prerequisite';
    default:
      return null;
  }
}

/** Activity types preferred for a review stage (order is deterministic). */
export function activityTypesForStage(stage: ReviewStage | null): readonly string[] {
  switch (stage) {
    case 'recall':
      return ['recall'];
    case 'discriminate':
      return ['choice', 'relation', 'diagram_label'];
    case 'transfer':
      return ['transfer', 'explain'];
    case 'prerequisite':
      return ['recall', 'explain'];
    default:
      return ['explain', 'recall', 'choice'];
  }
}

export function difficultyLabel(direction: DifficultyDirection): string {
  return direction === 'reduced' ? '降低' : direction === 'increased' ? '提高' : '保持';
}
