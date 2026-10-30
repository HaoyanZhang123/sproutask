/** Evidence card and evidence/assessment rationale detail. */

import type { Assessment, Evidence } from '@edu/domain';
import { h } from '../dom.js';
import {
  ASSISTANCE_LABELS,
  EVIDENCE_KIND_LABELS,
  UNDERSTANDING_LABELS,
  VALIDITY_LABELS,
  formatDateTime,
} from '../labels.js';
import { button } from './button.js';
import { statusChip } from './status-chip.js';

export function renderEvidenceCard(
  evidence: Evidence,
  options: { readonly onOpen?: () => void } = {},
): HTMLElement {
  const card = h('article', {
    class: 'edu-evidence',
    'data-evidence-id': evidence.id,
    'data-evidence-kind': evidence.kind,
  });
  card.append(
    h(
      'div',
      { class: 'edu-evidence__head' },
      h('h3', { class: 'edu-evidence__title' }, `${EVIDENCE_KIND_LABELS[evidence.kind]}证据`),
      h(
        'div',
        { class: 'edu-inline-actions' },
        statusChip(ASSISTANCE_LABELS[evidence.assistance], evidence.assistance === 'assisted' ? 'attention' : 'neutral'),
        statusChip(VALIDITY_LABELS[evidence.validity], evidence.validity === 'current' ? 'positive' : 'attention'),
      ),
    ),
    h('p', { class: 'edu-evidence__text' }, evidence.observation),
    h(
      'dl',
      { class: 'edu-kv' },
      h('dt', {}, '记录时间'),
      h('dd', {}, h('time', { datetime: evidence.createdAt }, formatDateTime(evidence.createdAt))),
      h('dt', {}, '内容版本'),
      h('dd', {}, evidence.packVersion),
      h('dt', {}, '出处'),
      h('dd', {}, evidence.sourceRefs.length > 0 ? evidence.sourceRefs.join('、') : '未记录出处'),
    ),
  );
  if (options.onOpen !== undefined) {
    card.append(
      h(
        'div',
        { class: 'edu-inline-actions' },
        button('查看依据', options.onOpen, { small: true, dataAction: 'evidence-open' }),
      ),
    );
  }
  return card;
}

export interface EvidenceDetailInput {
  readonly conceptTitle: string;
  readonly assessment: Assessment | null;
  readonly evidence: readonly Evidence[];
}

export function renderEvidenceDetail(input: EvidenceDetailInput): HTMLElement {
  const container = h('div', { class: 'edu-evidence-detail', 'data-testid': 'edu-evidence-detail' });
  container.append(h('h3', { class: 'edu-section__title' }, `判断依据：${input.conceptTitle}`));
  if (input.assessment === null) {
    container.append(
      h('p', { class: 'edu-muted' }, '当前还没有形成理解判断，因此没有可展开的判断理由。'),
    );
  } else {
    const assessment = input.assessment;
    container.append(
      h(
        'dl',
        { class: 'edu-kv', 'data-testid': 'edu-assessment-rationale' },
        h('dt', {}, '判断'),
        h('dd', {}, statusChip(UNDERSTANDING_LABELS[assessment.state], assessmentTone(assessment))),
        h('dt', {}, '理由'),
        h('dd', {}, assessment.rationale),
        h('dt', {}, '判断时间'),
        h('dd', {}, h('time', { datetime: assessment.assessedAt }, formatDateTime(assessment.assessedAt))),
        h('dt', {}, '评分标准版本'),
        h('dd', {}, assessment.rubricVersion),
        h('dt', {}, '判断器版本'),
        h('dd', {}, assessment.evaluatorVersion),
        h('dt', {}, '内容包版本'),
        h('dd', {}, assessment.packVersion),
        h('dt', {}, '有效性'),
        h('dd', {}, VALIDITY_LABELS[assessment.validity]),
      ),
    );
  }

  if (input.evidence.length === 0) {
    container.append(h('p', { class: 'edu-muted' }, '这次判断没有关联证据。'));
  } else {
    const list = h('div', { class: 'edu-list', 'data-testid': 'edu-evidence-list' });
    for (const evidence of input.evidence) list.append(renderEvidenceCard(evidence));
    container.append(h('h4', { class: 'edu-card__title' }, `关联证据（${input.evidence.length} 条）`), list);
  }
  return container;
}

function assessmentTone(assessment: Assessment): 'positive' | 'attention' | 'progress' {
  if (assessment.state === 'supported') return 'positive';
  if (assessment.state === 'needs_support') return 'attention';
  return 'progress';
}
