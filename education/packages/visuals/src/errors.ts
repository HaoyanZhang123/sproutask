/**
 * Visuals error taxonomy.
 *
 * Every failure leaves this package as a stable English code plus a
 * student-facing Chinese message and a retryable flag (07 A19/A24/A29). No bare
 * exception crosses a public boundary, and no failure may be rendered as a
 * "wrong answer".
 */

export const VISUALS_ERROR_CODES = [
  'DIAGRAM_INVALID',
  'DIAGRAM_UNSAFE_TEXT',
  'DIAGRAM_DANGLING_REFERENCE',
  'DIAGRAM_BBOX_OUT_OF_RANGE',
  'DIAGRAM_EMPTY',
  'DIAGRAM_TOO_LARGE',
  'DIAGRAM_ALT_TEXT_MISSING',
  'ANSWER_INVALID',
  'ANSWER_TARGET_UNKNOWN',
  'ANSWER_OPTION_UNKNOWN',
  'ANSWER_EMPTY',
  'RUBRIC_MISMATCH',
  'EVIDENCE_REJECTED',
  'ATTEMPT_MISMATCH',
  'SOURCE_UNRESOLVED',
  'ASSISTANCE_MISMATCH',
  'MODEL_RUN_MISSING',
  'ASSET_INVALID',
  'ASSET_TOO_LARGE',
  'ASSET_UNSUPPORTED_FORMAT',
  'IMAGE_UNREADABLE',
  'IMAGE_BLANK',
  'IMAGE_BLURRY',
  'IMAGE_ROTATED',
  'VISION_UNAVAILABLE',
  'VISION_AUTH_FAILED',
  'VISION_QUOTA_EXCEEDED',
  'VISION_NETWORK_FAILED',
  'VISION_TIMEOUT',
  'VISION_RESPONSE_INVALID',
  'INJECTION_SUSPECTED',
  'CLARIFICATION_REQUIRED',
  'UNSUPPORTED',
] as const;

export type VisualsErrorCode = (typeof VISUALS_ERROR_CODES)[number];

export interface VisualsErrorInfo {
  readonly code: VisualsErrorCode;
  /** Student-facing Chinese message; never a stack, path or secret. */
  readonly message: string;
  readonly retryable: boolean;
  /** Local evidence reference, never a secret. */
  readonly detailsRef?: string;
}

const MESSAGES: Record<VisualsErrorCode, { message: string; retryable: boolean }> = {
  DIAGRAM_INVALID: {
    message: '这张示意图的结构不完整，暂时不能用来作答。',
    retryable: false,
  },
  DIAGRAM_UNSAFE_TEXT: {
    message: '示意图里含有不能执行的脚本或网页内容，已拒绝显示。',
    retryable: false,
  },
  DIAGRAM_DANGLING_REFERENCE: {
    message: '示意图中有连到不存在部位的标注，已拒绝显示。',
    retryable: false,
  },
  DIAGRAM_BBOX_OUT_OF_RANGE: {
    message: '示意图区域坐标超出画面范围，已拒绝显示。',
    retryable: false,
  },
  DIAGRAM_EMPTY: {
    message: '这张示意图没有可作答的部位。',
    retryable: false,
  },
  DIAGRAM_TOO_LARGE: {
    message: '示意图元素过多，超出可安全显示的范围。',
    retryable: false,
  },
  DIAGRAM_ALT_TEXT_MISSING: {
    message: '示意图缺少文字替代说明，无法保证可访问性。',
    retryable: false,
  },
  ANSWER_INVALID: {
    message: '这份作答格式不完整，请检查后重试。',
    retryable: true,
  },
  ANSWER_TARGET_UNKNOWN: {
    message: '作答里包含图中不存在的部位，请重新选择。',
    retryable: true,
  },
  ANSWER_OPTION_UNKNOWN: {
    message: '作答里包含不存在的选项，请重新选择。',
    retryable: true,
  },
  ANSWER_EMPTY: {
    message: '还没有填写作答内容。',
    retryable: true,
  },
  RUBRIC_MISMATCH: {
    message: '评分标准与这道题不匹配，暂时不能给出判断。',
    retryable: false,
  },
  EVIDENCE_REJECTED: {
    message: '这次作答的证据不足以形成判断，已保留原始作答等待复核。',
    retryable: true,
  },
  ATTEMPT_MISMATCH: {
    message: '反馈与当前作答对不上，已丢弃这次结果。',
    retryable: false,
  },
  SOURCE_UNRESOLVED: {
    message: '反馈引用的出处无法核实，暂不作为正式判断。',
    retryable: false,
  },
  ASSISTANCE_MISMATCH: {
    message: '作答是否使用提示与记录不一致，需要重新确认。',
    retryable: false,
  },
  MODEL_RUN_MISSING: {
    message: '模型反馈缺少可追溯的调用记录，暂不作为正式判断。',
    retryable: false,
  },
  ASSET_INVALID: {
    message: '图片资源无效或已失效，请重新选择图片。',
    retryable: false,
  },
  ASSET_TOO_LARGE: {
    message: '图片文件过大，暂时无法处理。请压缩或换一张更小的图片。',
    retryable: true,
  },
  ASSET_UNSUPPORTED_FORMAT: {
    message: '暂不支持这种图片格式。请使用 PNG 或 JPEG，或改用文字作答。',
    retryable: true,
  },
  IMAGE_UNREADABLE: {
    message: '这张图片看不清内容，可以重拍、换一张，或改成文字作答。',
    retryable: true,
  },
  IMAGE_BLANK: {
    message: '图片里几乎没有可识别的内容，请确认是否上传正确。',
    retryable: true,
  },
  IMAGE_BLURRY: {
    message: '图片比较模糊，部分内容可能识别不准。',
    retryable: true,
  },
  IMAGE_ROTATED: {
    message: '图片方向可能不正确，请旋转后重新上传。',
    retryable: true,
  },
  VISION_UNAVAILABLE: {
    message: '当前模型没有图像能力，已改为文字作答路径；不会因此判错。',
    retryable: false,
  },
  VISION_AUTH_FAILED: {
    message: '模型服务鉴权失败，图片反馈暂不可用。已保存你的图片与作答。',
    retryable: true,
  },
  VISION_QUOTA_EXCEEDED: {
    message: '模型服务额度不足或限流，请稍后重试；不会因此判错。',
    retryable: true,
  },
  VISION_NETWORK_FAILED: {
    message: '网络不可用，图片反馈没有完成；图片与作答已保存，可稍后重试。',
    retryable: true,
  },
  VISION_TIMEOUT: {
    message: '图片反馈超时，未产生判断；可以重试或改用文字作答。',
    retryable: true,
  },
  VISION_RESPONSE_INVALID: {
    message: '模型返回的内容无法解析，这次不形成判断。',
    retryable: true,
  },
  INJECTION_SUSPECTED: {
    message: '图片中的文字只是作答内容，不会被当作指令执行。',
    retryable: false,
  },
  CLARIFICATION_REQUIRED: {
    message: '这张图片还有不确定的地方，请确认或改正识别内容后再判断。',
    retryable: true,
  },
  UNSUPPORTED: {
    message: '暂不支持这项操作。',
    retryable: false,
  },
};

export function visualsError(
  code: VisualsErrorCode,
  options: { readonly retryable?: boolean; readonly detailsRef?: string } = {},
): VisualsErrorInfo {
  const base = MESSAGES[code];
  return {
    code,
    message: base.message,
    retryable: options.retryable ?? base.retryable,
    ...(options.detailsRef === undefined ? {} : { detailsRef: options.detailsRef }),
  };
}

export type VisualsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: VisualsErrorInfo };

export function ok<T>(value: T): VisualsResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: VisualsErrorInfo): VisualsResult<T> {
  return { ok: false, error };
}

export class VisualsFailure extends Error {
  readonly info: VisualsErrorInfo;

  constructor(info: VisualsErrorInfo) {
    super(`${info.code}: ${info.message}`);
    this.name = 'VisualsFailure';
    this.info = info;
  }

  static of(code: VisualsErrorCode, options?: { retryable?: boolean; detailsRef?: string }): VisualsFailure {
    return new VisualsFailure(visualsError(code, options));
  }
}
