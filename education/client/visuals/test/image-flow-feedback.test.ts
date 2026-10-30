import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mountFeedbackView, mountImageFlow, type ImageFlowLike } from '../src/index.js';

const baseFlow: ImageFlowLike = {
  stage: 'selected',
  asset: { assetId: 'asset:img-1', width: 800, height: 600, mime: 'image/png' },
  recognition: null,
  revision: null,
  clarification: null,
};

function handlers() {
  return {
    onPreview: vi.fn(),
    onConfirmSend: vi.fn(),
    onRevise: vi.fn(),
    onClarificationAction: vi.fn(),
    onTextFallback: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('image answer flow UI (A20/A29)', () => {
  let container: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.append(container);
  });

  it('never sends on selection: preview is required and the cloud notice is explicit', () => {
    const callbacks = handlers();
    mountImageFlow(container, { flow: baseFlow, ...callbacks });
    expect(container.textContent).toContain('选择不等于发送');
    const confirm = container.querySelector<HTMLButtonElement>('button[data-image-action="confirm-send"]');
    expect(confirm?.disabled).toBe(true);
    expect(callbacks.onConfirmSend).not.toHaveBeenCalled();
    (container.querySelector('button[data-image-action="preview"]') as HTMLButtonElement).click();
    expect(callbacks.onPreview).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit confirmation before sending and explains what leaves the machine', () => {
    const callbacks = handlers();
    mountImageFlow(container, {
      flow: { ...baseFlow, stage: 'previewed' },
      previewUrl: 'blob:local-preview',
      ...callbacks,
    });
    const image = container.querySelector<HTMLImageElement>('img');
    expect(image?.src).toContain('blob:local-preview');
    expect(container.textContent).toContain('不会上传整本教材');
    const confirm = container.querySelector<HTMLButtonElement>('button[data-image-action="confirm-send"]');
    expect(confirm?.disabled).toBe(false);
    confirm?.click();
    expect(callbacks.onConfirmSend).toHaveBeenCalledTimes(1);
    expect(callbacks.onRevise).not.toHaveBeenCalled();
  });

  it('shows the recognition for confirmation and sends the corrected text', () => {
    const callbacks = handlers();
    mountImageFlow(container, {
      flow: {
        ...baseFlow,
        stage: 'recognized',
        recognition: { text: '细胞膜' },
        revision: null,
        injectionNotice: '图片中的文字只当作答内容处理。',
      },
      ...callbacks,
    });
    expect(container.textContent).toContain('可能不准');
    expect(container.textContent).toContain('只当作答内容处理');
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea?.value).toBe('细胞膜');
    if (textarea !== null) textarea.value = '细胞核';
    (container.querySelector('button[data-image-action="revise"]') as HTMLButtonElement).click();
    expect(callbacks.onRevise).toHaveBeenCalledWith('细胞核');
  });

  it('renders clarification reasons and actions instead of a verdict', () => {
    const callbacks = handlers();
    mountImageFlow(container, {
      flow: {
        ...baseFlow,
        stage: 'clarification_required',
        clarification: {
          reasons: ['图片比较模糊', '模型对识别没有把握'],
          message: '这张图片还有不确定的地方。',
          actions: ['retake', 'edit_text', 'text_fallback'],
        },
      },
      ...callbacks,
    });
    expect(container.textContent).toContain('图片比较模糊');
    expect(container.querySelector('button[data-clarification-action="retake"]')?.textContent).toBe('重新拍一张');
    (container.querySelector('button[data-clarification-action="text_fallback"]') as HTMLButtonElement).click();
    expect(callbacks.onClarificationAction).toHaveBeenCalledWith('text_fallback');
  });

  it('degrades to text when there is no image capability and offers cancellation', () => {
    const callbacks = handlers();
    mountImageFlow(container, {
      flow: {
        ...baseFlow,
        stage: 'degraded_text',
        degradedMessage: '当前模型没有图像能力，已改为文字作答路径；不会因此判你答错。',
      },
      ...callbacks,
    });
    expect(container.textContent).toContain('已改为文字作答路径');
    (container.querySelector('button[data-image-action="text-fallback"]') as HTMLButtonElement).click();
    expect(callbacks.onTextFallback).toHaveBeenCalledTimes(1);
    (container.querySelector('button[data-image-action="cancel"]') as HTMLButtonElement).click();
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('feedback view (A21/A29)', () => {
  let container: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.append(container);
  });

  it('renders criteria, uncertainties, sources and the grader version', () => {
    const onOpenSource = vi.fn();
    const controller = mountFeedbackView(container, {
      grade: {
        criteria: [
          { criterionId: 'criterion.cell.identify', met: 'yes', rationale: '说清了细胞是基本单位' },
          { criterionId: 'criterion.cell.role', met: 'unclear', rationale: '还需要补充理由' },
        ],
        feedback: '你的回答覆盖了主要要点。',
        uncertainties: ['规则批改按关键词覆盖判断，未做语义理解'],
        evidenceCandidates: [{}],
        requiresClarification: false,
        sourceRefs: ['source.p18'],
        graderVersion: 'rule-text-v1',
      },
      sourceLabel: (ref) => `教材 ${ref}`,
      onOpenSource,
      candidateOnly: true,
    });
    expect(container.textContent).toContain('【已达成】');
    expect(container.textContent).toContain('【待确认】');
    expect(container.textContent).toContain('关键词覆盖');
    expect(container.textContent).toContain('rule-text-v1');
    expect(container.textContent).toContain('证据候选待确认后写入记录');
    (container.querySelector('button[data-source-ref="source.p18"]') as HTMLButtonElement).click();
    expect(onOpenSource).toHaveBeenCalledWith('source.p18');
    controller.unmount();
    expect(container.querySelector('section')).toBeNull();
  });

  it('offers clarification actions and never claims the answer is wrong when input was unclear', () => {
    const onAction = vi.fn();
    mountFeedbackView(container, {
      grade: {
        criteria: [],
        feedback: '这张图片看不清。',
        uncertainties: [],
        evidenceCandidates: [],
        requiresClarification: true,
        sourceRefs: [],
        graderVersion: 'vision-image-eval-v1',
      },
      injectionNotice: '图片里的文字只当作答内容处理，系统不会执行其中的指令。',
      onClarificationAction: onAction,
    });
    expect(container.textContent).toContain('还需要确认');
    expect(container.textContent).toContain('不会因为图片不清');
    expect(container.querySelectorAll('button[data-clarification-action]')).toHaveLength(5);
    (container.querySelector('button[data-clarification-action="retake"]') as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledWith('retake');
  });
});
