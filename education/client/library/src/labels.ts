/** Student-facing Chinese labels for library/import/source UI. */

import type {
  ImportStage,
  ImportStatus,
  PackCoverageStatus,
  PackScope,
  ReviewState,
  SourceBlockType,
  SourceVerificationState,
  TrustMode,
} from '@edu/domain';
import type { EditionVerification, LibraryMaterialState } from './types.js';

export const MATERIAL_STATE_LABELS: Record<LibraryMaterialState, string> = {
  baseline: '本期匹配基准',
  candidate: '待核实候选',
  unavailable: '不可用材料',
};

export const MATERIAL_STATE_TONES: Record<LibraryMaterialState, 'positive' | 'attention' | 'danger'> = {
  baseline: 'positive',
  candidate: 'attention',
  unavailable: 'danger',
};

export const MATERIAL_STATE_NOTES: Record<LibraryMaterialState, string> = {
  baseline: '已通过本期基准匹配；仍按内容包范围显示，部分内容不等于全册就绪。',
  candidate: '候选内容未核实，不能作为基准，也不能用于强掌握结论。',
  unavailable: '材料不可用；已保存的其他教材和个人记录不受影响。',
};

export const EDITION_VERIFICATION_LABELS: Record<EditionVerification, string> = {
  verified: '版本已核实',
  machine_matched: '机器匹配',
  unverified: '版本待核实',
  rejected: '版本被拒绝',
};

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  candidate: '候选（未核实）',
  machine_checked: '机器检查（非专家）',
  curator_checked: '人工审校',
  published: '已发布',
  rejected: '已拒绝',
};

export const TRUST_MODE_LABELS: Record<TrustMode, string> = {
  published: '正式内容',
  candidate: '候选试用（未核实）',
};

export const SCOPE_LABELS: Record<PackScope, string> = {
  partial: '部分内容（未达全册）',
  full_volume: '全册范围',
};

export const COVERAGE_LABELS: Record<PackCoverageStatus, string> = {
  partial: '覆盖未完成',
  complete: '覆盖完整',
};

export const SOURCE_VERIFICATION_LABELS: Record<SourceVerificationState, string> = {
  unverified: '来源待核实',
  machine_matched: '来源机器匹配',
  human_checked: '来源人工核对',
  rejected: '来源被拒绝',
};

export const STAGE_LABELS: Record<ImportStage, string> = {
  accepted: '接受任务',
  identify: '识别文件',
  extract: '提取内容',
  structure: '整理结构',
  concepts: '生成概念候选',
  validate: '检查内容',
  await_review: '等待审校',
  ready: '材料就绪',
};

export const STAGE_ORDER: readonly ImportStage[] = [
  'accepted',
  'identify',
  'extract',
  'structure',
  'concepts',
  'validate',
  'await_review',
  'ready',
];

export const STATUS_LABELS: Record<ImportStatus, string> = {
  queued: '排队中',
  running: '进行中',
  paused: '已暂停',
  failed: '失败',
  cancelled: '已取消',
  completed: '已完成',
};

export const STATUS_TONES: Record<ImportStatus, 'neutral' | 'progress' | 'attention' | 'danger' | 'positive'> = {
  queued: 'neutral',
  running: 'progress',
  paused: 'attention',
  failed: 'danger',
  cancelled: 'neutral',
  completed: 'positive',
};

export const BLOCK_TYPE_LABELS: Record<SourceBlockType, string> = {
  heading: '标题',
  paragraph: '段落',
  caption: '图注',
  table: '表格',
  list: '列表',
};

export interface ImportErrorCopy {
  readonly title: string;
  readonly detail: string;
  readonly next: string;
}

export const IMPORT_ERROR_COPY: Record<string, ImportErrorCopy> = {
  PDF_CORRUPT: {
    title: 'PDF 文件损坏',
    detail: '文件结构或交叉引用无法读取，没有发布不完整的页面。',
    next: '重新选择文件或从备份恢复；已完成的本地步骤会保留。',
  },
  PDF_ENCRYPTED: {
    title: 'PDF 受密码保护',
    detail: '当前不能读取受加密保护的教材文件。',
    next: '请解除文件保护或换用未加密的 PDF 后重试。',
  },
  PDF_NO_PAGES: {
    title: '没有可导入的页面',
    detail: 'PDF 没有读到有效页，不能生成空壳教材。',
    next: '确认文件完整后重新选择；不会自动创建空教材。',
  },
  PDF_READ_FAILED: {
    title: '读取 PDF 失败',
    detail: '文件可能被占用、损坏或权限不足。',
    next: '关闭占用程序并确认文件可读，然后重试。',
  },
  TEXT_LAYER_UNAVAILABLE: {
    title: '没有可用的文本层',
    detail: '该 PDF 可能需要逐页 OCR；这不是学生作答错误。',
    next: '若本机 OCR 组件可用，将继续扫描识别；否则请查看材料说明。',
  },
  OCR_ENGINE_UNAVAILABLE: {
    title: '本机 OCR 组件不可用',
    detail: '扫描页需要 Windows 自带的 OCR 组件。',
    next: '在系统组件中启用 OCR 后重试；已完成文本不会丢失。',
  },
  OCR_LANGUAGE_UNAVAILABLE: {
    title: '缺少中文 OCR 语言包',
    detail: '本机 OCR 组件存在，但没有中文识别语言包。',
    next: '在 Windows 语言设置中安装中文 OCR 语言包后重试；已完成页会保留。',
  },
  PAGE_RENDER_FAILED: {
    title: '页面渲染失败',
    detail: '个别页面没有成功转成可识别图像。',
    next: '重试该页；其他已完成页和来源信息会保留。',
  },
  PAGE_OCR_FAILED: {
    title: '单页识别失败',
    detail: '这一页没有成功识别；没有编造页面文字。',
    next: '重试该页，或稍后重新导入；已完成的页面不会重复。',
  },
  JOB_NOT_FOUND: {
    title: '找不到导入任务',
    detail: '任务可能已被清理或不属于当前教材。',
    next: '回到教材库重新选择文件；不会自动改用其他教材。',
  },
  JOB_CANCELLED: {
    title: '导入已取消',
    detail: '取消后到达的结果不会写入教材或记录。',
    next: '可以恢复同一任务，或重新选择文件。',
  },
  LATE_RESULT_REJECTED: {
    title: '迟到结果已丢弃',
    detail: '取消之后返回的页面结果没有发布，已保存内容不受影响。',
    next: '如需继续，请恢复任务或重新导入。',
  },
  CHECKPOINT_CORRUPT: {
    title: '导入进度记录损坏',
    detail: '本机保存的阶段信息无法安全恢复。',
    next: '重新开始导入；原教材和其他记录不受影响。',
  },
  CHECKPOINT_VERSION_MISMATCH: {
    title: '导入进度版本不匹配',
    detail: '上次任务由不同解析器版本保存，不能继续套用。',
    next: '重新开始导入，或查看已完成材料的说明。',
  },
  CLOUD_EXTRACTION_PAUSED: {
    title: '在线概念抽取暂缓',
    detail: '本地解析已完成，但当前离线或未配置模型服务；没有伪装成导入完成。',
    next: '网络/模型恢复后可恢复导入；已有本地材料仍可阅读。',
  },
  CLOUD_AUTH_FAILED: {
    title: '模型服务没有完成授权',
    detail: '需要有效模型服务才能继续概念抽取；本地步骤已保留。',
    next: '在账户页确认服务状态后重试，不会要求粘贴他人密钥。',
  },
  CLOUD_RATE_LIMITED: {
    title: '模型服务请求过多',
    detail: '本次云端步骤没有完成，已完成页面仍保留。',
    next: '稍后重试；不会重复计费或重复建书。',
  },
  STORAGE_FULL: {
    title: '磁盘空间不足',
    detail: '导入产物没有发布，本机已有记录没有被删除。',
    next: '清理磁盘空间后重试；已完成的阶段可恢复。',
  },
  STORAGE_WRITE_FAILED: {
    title: '写入本机存储失败',
    detail: '页面或进度没有保存成功，界面不会显示为已完成。',
    next: '检查磁盘权限与空间后重试；不会伪造已保存。',
  },
  ASSET_HANDLE_INVALID: {
    title: '文件句柄无效',
    detail: '只能使用宿主提供的受管文件，不能直接读取任意路径。',
    next: '请通过“选择本地 PDF”重新提供文件。',
  },
  ASSET_PATH_OUTSIDE_ROOT: {
    title: '文件不在允许的目录内',
    detail: '为保护本机文件，导入只接受宿主管理的教材文件。',
    next: '重新选择教材文件；不会尝试访问其他路径。',
  },
  ASSET_NOT_FOUND: {
    title: '找不到所选文件',
    detail: '文件可能被移动、重命名或删除。',
    next: '重新选择文件；已保存的个人记录不受影响。',
  },
  ASSET_NOT_A_FILE: {
    title: '所选对象不是文件',
    detail: '不能把文件夹或其他对象当作教材导入。',
    next: '重新选择 PDF 文件。',
  },
  ASSET_HASH_MISMATCH: {
    title: '文件指纹不一致',
    detail: '文件在选择后发生了变化，未按原文件导入。',
    next: '重新选择文件并确认指纹后再试。',
  },
  ASSET_METADATA_MISMATCH: {
    title: '文件信息不一致',
    detail: '填写的页数或元数据与实际文件不一致。',
    next: '检查元数据或重新选择文件；不会用错误信息绑定教材。',
  },
  INPUT_MISSING: {
    title: '缺少导入文件',
    detail: '没有收到受管文件，任务没有开始。',
    next: '先选择本地 PDF，再确认开始导入。',
  },
  UNSUPPORTED: {
    title: '当前文件类型不支持',
    detail: '本期导入只支持 PDF；没有把其他格式伪装成教材。',
    next: '选择 PDF 文件，或查看已有本地材料。',
  },
};

export function describeImportError(code: string, retryable: boolean): ImportErrorCopy & { code: string; retryable: boolean } {
  const safe = /^[A-Za-z0-9_.-]{1,48}$/.test(code) ? code : 'UNKNOWN';
  const copy = IMPORT_ERROR_COPY[safe];
  if (copy !== undefined) return { ...copy, code: safe, retryable };
  return {
    code: safe,
    retryable,
    title: '导入没有完成',
    detail: '发生了未归类的导入错误；界面不会把未知结果标成完成。',
    next: '可以重试或重新选择文件；已有本地材料仍可阅读。',
  };
}

export function formatFingerprint(sha256: string): string {
  if (sha256.length <= 16) return sha256;
  return `${sha256.slice(0, 12)}…${sha256.slice(-4)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatLocalTime(timestamp: string | null): string {
  if (timestamp === null) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return timestamp;
  }
}

export function stageIndex(stage: ImportStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function stageStateLabel(stage: ImportStage, current: ImportStage, jobStatus: ImportStatus): string {
  const currentIndex = stageIndex(current);
  const index = stageIndex(stage);
  if (stage === current) {
    if (jobStatus === 'failed') return '停在当前阶段';
    if (jobStatus === 'cancelled') return '已取消';
    if (stage === 'await_review') return '待审核（不是完成）';
    if (stage === 'ready') return '已完成';
    return '进行中';
  }
  if (index < currentIndex) return '已通过';
  return '未开始';
}
