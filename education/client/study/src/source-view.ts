/** Source popover: PDF page order and printed page label are never mixed. */

import {
  Modal,
  h,
  statusChip,
} from '../../shell/src/index.js';
import type { StudySource } from './types.js';

const VERIFICATION_LABELS: Record<StudySource['verification'], string> = {
  unverified: '来源待核实',
  machine_matched: '来源机器匹配',
  human_checked: '来源人工核对',
  rejected: '来源被拒绝',
};

export function openSourcePopover(
  parent: HTMLElement,
  trigger: HTMLElement,
  sources: readonly StudySource[],
  sourceRefId: string,
): void {
  const source = sources.find((entry) => entry.sourceRefId === sourceRefId) ?? null;
  const content = h('div', { 'data-testid': 'study-source-popover' });
  if (source === null) {
    content.append(
      h('h3', { class: 'edu-card__title' }, '出处暂时不可用'),
      h(
        'p',
        { class: 'edu-state__body' },
        '没有找到这个来源的页码信息；不会跳到任意页面，也不会编造教材引用。',
      ),
    );
  } else {
    // 学生界面只报"这页在课本第几页"。"PDF 页序""1 基""印刷页码"是内部定位
    // 术语（红线禁词），学生看不懂也不该看到。没有课本页码就如实说没有。
    content.append(
      h(
        'div',
        { class: 'edu-study-source-grid' },
        h(
          'div',
          { class: 'edu-study-source-box', 'data-testid': 'study-source-printed' },
          h('p', { class: 'edu-muted' }, '在课本里的位置'),
          h(
            'p',
            { class: 'edu-study-source-value' },
            source.printedPage === null
              ? '这一处没有标注课本页码'
              : `课本第 ${source.printedPage} 页`,
          ),
        ),
      ),
      h(
        'p',
        { class: 'edu-muted' },
        '页码来自课本页脚；没有标注时不猜、也不换算出别的页码。',
      ),
      h(
        'p',
        { class: 'edu-inline-actions' },
        statusChip(
          VERIFICATION_LABELS[source.verification],
          source.verification === 'human_checked' ? 'positive' : 'attention',
        ),
        h('span', { class: 'edu-muted' }, `这一处是${sourceKindLabel(source)}`),
      ),
      h(
        'p',
        { class: 'edu-muted' },
        '查看出处不会提交作答、不会完成活动；关闭后焦点返回刚才的出处按钮。',
      ),
    );
  }
  const modal = new Modal('出处', content, '关闭出处');
  modal.open(trigger, parent);
}

/** 数据里的 label 末尾可能带内部标识；这里只留学生能看懂的那一段。 */
function sourceKindLabel(source: StudySource): string {
  const head = source.label.split('·')[0]?.trim() ?? '';
  const looksInternal = /^[A-Za-z0-9._-]+$/.test(head) && head.includes('.');
  return head.length > 0 && !looksInternal ? head : '课本正文';
}
