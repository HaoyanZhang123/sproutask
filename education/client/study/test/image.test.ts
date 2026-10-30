import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupStudies,
  mountStudy,
  pageRoot,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupStudies);

function pngFile(width = 64, height = 48): File {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], 'answer.png', { type: 'image/png' });
}

function selectFile(container: HTMLElement, file: File): void {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('image file input not found');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function confirmButton(container: HTMLElement): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>('button[data-image-action="confirm-send"]');
  if (found === null) throw new Error('confirm button not found');
  return found;
}

async function prepareImage(scenario: 'image' | 'image-clarification' = 'image') {
  const mounted = await mountStudy({ scenario });
  buttonByAction(pageRoot(mounted.container), 'image-answer').click();
  await tick(10);
  return mounted;
}

describe('image answer entry', () => {
  it('offers a file input, previews locally and requires an explicit preview + confirm', async () => {
    const { container, study } = await prepareImage();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.accept).toBe('image/png,image/jpeg');
    expect(input?.getAttribute('aria-label')).toContain('拍照');
    expect(textOf(pageRoot(container))).toContain('选择不等于发送');
    expect(confirmButton(container).disabled).toBe(true);

    selectFile(container, pngFile());
    await tick(30);
    expect(container.querySelector('[data-testid="image-file-meta"]')?.textContent).toContain('64×48');
    expect(container.querySelector('[data-testid="image-preview"]')).toBeNull();
    expect(confirmButton(container).disabled).toBe(true);

    const preview = container.querySelector<HTMLButtonElement>('button[data-image-action="preview"]');
    expect(preview).not.toBeNull();
    preview?.click();
    await tick(10);
    const image = container.querySelector<HTMLImageElement>('[data-testid="image-preview"]');
    expect(image).not.toBeNull();
    expect(image?.src.startsWith('data:image/png;base64,')).toBe(true);
    expect(confirmButton(container).disabled).toBe(false);

    confirmButton(container).click();
    await tick(40);
    expect(study.controller.getState().phase).toBe('feedback');
    expect(container.querySelector('[data-testid="study-feedback-grade"]')).not.toBeNull();
    expect(textOf(container)).toContain('本次图片判分');
    expect(textOf(container)).toContain('评分版本：fixture-rule-v1');
  });

  it('shows the quality-gate clarification as pending and never as a wrong answer', async () => {
    const { container, study } = await prepareImage('image-clarification');
    selectFile(container, pngFile());
    await tick(30);
    container.querySelector<HTMLButtonElement>('button[data-image-action="preview"]')?.click();
    await tick(10);
    confirmButton(container).click();
    await tick(40);

    expect(study.controller.getState().phase).toBe('feedback');
    expect(study.controller.getState().feedback?.requiresClarification).toBe(true);
    const result = container.querySelector('[data-testid="image-result"]');
    expect(result).not.toBeNull();
    expect(result?.textContent).toContain('模糊');
    expect(result?.textContent).toContain('倾斜');
    expect(result?.textContent).toContain('只记为待澄清');
    expect(result?.textContent).toContain('不会写入成绩');
    expect(result?.textContent).toContain('评分版本：fixture-rule-v1');
  });

  it('rejects a non-image file with a Chinese error and allows a retake', async () => {
    const { container } = await prepareImage();
    selectFile(container, new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    await tick(30);
    expect(container.querySelector('[data-testid="image-file-error"]')?.textContent).toContain('只支持 PNG 或 JPEG');

    selectFile(container, pngFile());
    await tick(30);
    container.querySelector<HTMLButtonElement>('button[data-action="image-retake"]')?.click();
    await tick(10);
    expect(container.querySelector('[data-testid="image-file-meta"]')).toBeNull();
    expect(confirmButton(container).disabled).toBe(true);
    expect(textOf(container)).toContain('还没有选择图片');
  });

  it('can cancel the image mode and return to the text form', async () => {
    const { container, study } = await prepareImage();
    selectFile(container, pngFile());
    await tick(30);
    container.querySelector<HTMLButtonElement>('button[data-action="image-cancel"]')?.click();
    await tick(10);
    expect(study.controller.getState().phase).toBe('draft');
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('textarea')).not.toBeNull();
  });
});
