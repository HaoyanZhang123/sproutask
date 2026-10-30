/**
 * Framework-free image answer flow UI (02 §3.6, 07 A20/A29).
 *
 * Selection is not sending. The preview, the explicit cloud-send confirmation,
 * the recognition review, the student revision and the clarification actions are
 * distinct states; the UI never auto-resends and never shows a fake verdict for
 * an unclear image.
 */

export type ImageFlowStage =
  | 'selected'
  | 'previewed'
  | 'send_confirmed'
  | 'recognized'
  | 'clarification_required'
  | 'degraded_text'
  | 'graded'
  | 'cancelled';

export interface ImageFlowLike {
  readonly stage: ImageFlowStage;
  readonly asset: {
    readonly assetId: string;
    readonly width: number;
    readonly height: number;
    readonly mime: string;
    /** Local base64 of the selected image; only sent after explicit confirmation. */
    readonly base64?: string | null;
  };
  readonly recognition: { readonly text: string } | null;
  readonly revision: { readonly text: string } | null;
  readonly clarification: {
    readonly reasons: readonly string[];
    readonly message: string;
    readonly actions: readonly string[];
  } | null;
  readonly degradedMessage?: string | null;
  readonly injectionNotice?: string | null;
}

export interface ImageFlowOptions {
  readonly flow: ImageFlowLike;
  /** Local object URL for the preview; never a remote URL. */
  readonly previewUrl?: string | null;
  readonly onPreview: () => void;
  readonly onConfirmSend: () => void;
  readonly onRevise: (text: string) => void;
  readonly onClarificationAction: (action: string) => void;
  readonly onTextFallback: () => void;
  readonly onCancel: () => void;
}

export interface ImageFlowController {
  readonly element: HTMLElement;
  unmount(): void;
}

export function mountImageFlow(container: HTMLElement, options: ImageFlowOptions): ImageFlowController {
  const { flow } = options;
  const root = document.createElement('section');
  root.className = 'edu-visual-image-flow';
  root.dataset['eduVisual'] = 'image-flow';
  root.dataset['stage'] = flow.stage;

  const heading = document.createElement('h3');
  heading.textContent = '上传图片作答';
  root.append(heading);

  const info = document.createElement('p');
  info.className = 'edu-visual-image-info';
  info.textContent =
    flow.asset.width > 0 && flow.asset.height > 0
      ? `已选图片：${flow.asset.width}×${flow.asset.height}（${flow.asset.mime}）。选择不等于发送。`
      : '还没有选择图片。选好并预览后，再确认发送给模型识别。';
  root.append(info);

  if (options.previewUrl !== null && options.previewUrl !== undefined) {
    const image = document.createElement('img');
    image.src = options.previewUrl;
    image.alt = '待发送的作答图片预览';
    image.className = 'edu-visual-preview';
    root.append(image);
  } else {
    const placeholder = document.createElement('p');
    placeholder.className = 'edu-visual-preview-placeholder';
    placeholder.textContent = '图片预览仅在本机显示。';
    root.append(placeholder);
  }

  const actions = document.createElement('div');
  actions.className = 'edu-visual-actions';
  const addButton = (label: string, action: () => void, data: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset['imageAction'] = data;
    button.addEventListener('click', action);
    actions.append(button);
    return button;
  };

  if (flow.stage === 'selected' || flow.stage === 'previewed' || flow.stage === 'send_confirmed') {
    addButton('预览图片', options.onPreview, 'preview');
    const send = addButton('确认发送给模型识别', options.onConfirmSend, 'confirm-send');
    send.disabled = flow.stage === 'selected';
    send.title = flow.stage === 'selected' ? '请先预览再确认发送' : '将把这张图片发送给模型服务识别';
  }

  const notice = document.createElement('p');
  notice.className = 'edu-visual-cloud-notice';
  if (flow.stage !== 'selected') {
    notice.textContent =
      '发送说明：图片会通过模型服务识别，用于给出反馈；不会上传整本教材或其他学习记录。发送前可以随时取消。';
    root.append(notice);
  }

  if (flow.stage === 'send_confirmed') {
    const waiting = document.createElement('p');
    waiting.textContent = '正在识别图片，请稍候……可以取消本次识别。';
    root.append(waiting);
  }

  if (flow.injectionNotice !== null && flow.injectionNotice !== undefined) {
    const injection = document.createElement('p');
    injection.className = 'edu-visual-injection';
    injection.setAttribute('role', 'note');
    injection.textContent = flow.injectionNotice;
    root.append(injection);
  }

  if (flow.stage === 'recognized') {
    const label = document.createElement('label');
    label.textContent = '识别到的作答（可能不准，请确认或改正）：';
    const textarea = document.createElement('textarea');
    textarea.rows = 4;
    textarea.value = flow.revision?.text ?? flow.recognition?.text ?? '';
    textarea.setAttribute('aria-label', '识别到的作答文字');
    label.append(textarea);
    root.append(label);
    addButton('确认识别内容', () => options.onRevise(textarea.value), 'revise');
    addButton('改用文字作答', options.onTextFallback, 'text-fallback');
  }

  if (flow.stage === 'clarification_required') {
    const clarification = document.createElement('div');
    clarification.className = 'edu-visual-clarify';
    const message = document.createElement('p');
    message.textContent = flow.clarification?.message ?? '这张图片还有不确定的地方。';
    clarification.append(message);
    if (flow.clarification !== null) {
      const list = document.createElement('ul');
      for (const reason of flow.clarification.reasons) {
        const item = document.createElement('li');
        item.textContent = reason;
        list.append(item);
      }
      clarification.append(list);
      for (const action of flow.clarification.actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset['clarificationAction'] = action;
        button.textContent = actionLabel(action);
        button.addEventListener('click', () => options.onClarificationAction(action));
        clarification.append(button);
      }
    }
    root.append(clarification);
  }

  if (flow.stage === 'degraded_text') {
    const degraded = document.createElement('div');
    degraded.className = 'edu-visual-degraded';
    const message = document.createElement('p');
    message.textContent =
      flow.degradedMessage ?? '当前模型没有图像能力，已改为文字作答路径；不会因此判你答错。';
    degraded.append(message);
    const fallback = document.createElement('button');
    fallback.type = 'button';
    fallback.textContent = '用文字作答';
    fallback.dataset['imageAction'] = 'text-fallback';
    fallback.addEventListener('click', options.onTextFallback);
    degraded.append(fallback);
    root.append(degraded);
  }

  addButton('取消本次作答', options.onCancel, 'cancel');
  root.append(actions);

  container.append(root);
  return {
    element: root,
    unmount() {
      root.remove();
    },
  };
}

function actionLabel(action: string): string {
  switch (action) {
    case 'retake':
      return '重新拍一张';
    case 'rotate':
      return '旋转后重试';
    case 'edit_text':
      return '改正识别文字';
    case 'text_fallback':
      return '改用文字作答';
    case 'retry_later':
      return '稍后再试';
    default:
      return action;
  }
}
