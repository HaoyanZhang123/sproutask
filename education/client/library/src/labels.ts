/** Student-facing Chinese labels for library/import/source UI. */

import type {
  ImportStage,
  ImportStatus,
  ReviewState,
  SourceBlockType,
  SourceVerificationState,
} from '@edu/domain';
import type { LibraryMaterialState } from './types.js';

/** 学科名只用于封面，不在正文重复。 */
export const SUBJECT_LABELS: Readonly<Record<string, string>> = {
  biology: '生物学',
};

/** 换一本书时一行的状态词；不是 chip，也不重复“待核实”。 */
export const MATERIAL_STATE_WORDS: Record<LibraryMaterialState, string> = {
  baseline: '核对过的课本',
  candidate: '先当参考',
  unavailable: '打不开',
};

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  candidate: '还没核对',
  machine_checked: '程序看过，还没人核对',
  curator_checked: '人工核对过',
  published: '核对过',
  rejected: '不用这份',
};

export const SOURCE_VERIFICATION_LABELS: Record<SourceVerificationState, string> = {
  unverified: '页码还没核对',
  machine_matched: '按页码对得上',
  human_checked: '人工核对过',
  rejected: '不采用',
};

export const BLOCK_TYPE_LABELS: Record<SourceBlockType, string> = {
  heading: '标题',
  paragraph: '段落',
  caption: '图注',
  table: '表格',
  list: '列表',
};

export const STAGE_LABELS: Record<ImportStage, string> = {
  accepted: '准备开始',
  identify: '认出这本书',
  extract: '读出页面文字',
  structure: '整理章节',
  concepts: '整理知识点',
  validate: '检查内容',
  await_review: '等你确认',
  ready: '可以用了',
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
  paused: '暂停了',
  failed: '出错',
  cancelled: '已取消',
  completed: '完成',
};

export const STATUS_TONES: Record<ImportStatus, 'neutral' | 'progress' | 'attention' | 'danger' | 'positive'> = {
  queued: 'neutral',
  running: 'progress',
  paused: 'attention',
  failed: 'danger',
  cancelled: 'neutral',
  completed: 'positive',
};

export interface ImportErrorCopy {
  readonly title: string;
  readonly detail: string;
  readonly next: string;
}

export const IMPORT_ERROR_COPY: Record<string, ImportErrorCopy> = {
  PDF_CORRUPT: {
    title: 'PDF 文件损坏',
    detail: '文件结构读不出来，没有发布不完整的页面。',
    next: '重新选择文件或从备份恢复；已经做过的本地步骤会保留。',
  },
  PDF_ENCRYPTED: {
    title: 'PDF 受密码保护',
    detail: '现在还读不了加了密的课本文件。',
    next: '解除文件保护，或换一个没加密的 PDF 再试。',
  },
  PDF_NO_PAGES: {
    title: '没有可导入的页面',
    detail: '这个 PDF 没有读到有效页，不会凭空建一本空课本。',
    next: '确认文件完整后重新选择；不会自动建空课本。',
  },
  PDF_READ_FAILED: {
    title: '读不了这个 PDF',
    detail: '文件可能正被其他程序占用、损坏或没有读取权限。',
    next: '关闭占用它的程序，确认能打开后重试。',
  },
  TEXT_LAYER_UNAVAILABLE: {
    title: '这些页面没有文字层',
    detail: '这一本像是扫描件，需要先识别图像上的字；这不是你答错了。',
    next: '本机识别组件可用时会继续识别；否则会说明哪几页读不到。',
  },
  OCR_ENGINE_UNAVAILABLE: {
    title: '本机的文字识别组件不可用',
    detail: '扫描页需要系统自带的文字识别组件。',
    next: '在系统组件里打开识别功能后重试；已经读出的文字不会丢。',
  },
  OCR_LANGUAGE_UNAVAILABLE: {
    title: '缺少中文识别语言包',
    detail: '本机有识别组件，但还没装中文语言包。',
    next: '在系统的语言设置里安装中文识别语言包后重试；已完成的页会保留。',
  },
  PAGE_RENDER_FAILED: {
    title: '有几页没能转成图片',
    detail: '个别页面没有成功渲染，所以没有去识别它们。',
    next: '重试这几页；其他已完成的页和来源会保留。',
  },
  PAGE_OCR_FAILED: {
    title: '有一页没认出来',
    detail: '这一页没有识别成功；没有编造页面文字。',
    next: '重试这一页，或稍后重新导入；已完成的页面不会重复。',
  },
  JOB_NOT_FOUND: {
    title: '找不到这次导入',
    detail: '它可能已经被清理，或者不属于当前这本课本。',
    next: '回到课本页重新选择文件；不会自动改用其他课本。',
  },
  JOB_CANCELLED: {
    title: '导入已取消',
    detail: '取消之后才回来的结果不会写进课本或记录。',
    next: '可以接着恢复这次导入，或重新选择文件。',
  },
  LATE_RESULT_REJECTED: {
    title: '迟到的结果没有采用',
    detail: '取消之后返回的页面结果没有发布，已保存的内容不受影响。',
    next: '如果要继续，请恢复这次导入或重新选一次文件。',
  },
  CHECKPOINT_CORRUPT: {
    title: '上次的进度记录坏了',
    detail: '本机保存的阶段信息没法安全接着用。',
    next: '重新开始导入；原来的课本和其他记录不受影响。',
  },
  CHECKPOINT_VERSION_MISMATCH: {
    title: '上次的进度记录版本对不上',
    detail: '上次是旧版本的程序保存的，不能直接接着用。',
    next: '重新开始导入，或先看看已经做好的那部分。',
  },
  CLOUD_EXTRACTION_PAUSED: {
    title: '联网的整理步骤先停了下来',
    detail: '本机的步骤已经做完，但现在没联网或还没配置模型服务；不会假装已经完成。',
    next: '网络或模型服务恢复后可以接着做；已经做好的本地内容仍然能看。',
  },
  CLOUD_AUTH_FAILED: {
    title: '模型服务没有完成授权',
    detail: '要继续整理知识点，需要可用的模型服务；本机的步骤已经保留。',
    next: '到设置里确认服务状态后重试，不会让你粘贴别人的密钥。',
  },
  CLOUD_RATE_LIMITED: {
    title: '模型服务请求太多',
    detail: '这次联网的步骤没有完成，已经做好的页面还在。',
    next: '稍后再试；不会重复花钱，也不会重复建课本。',
  },
  STORAGE_FULL: {
    title: '磁盘空间不足',
    detail: '这次导入的结果没有保存，本机原有记录没有被删除。',
    next: '清出一些磁盘空间后重试；已经完成的阶段可以接着做。',
  },
  STORAGE_WRITE_FAILED: {
    title: '写进本机存储失败',
    detail: '页面或进度没有保存成功，界面不会显示成已完成。',
    next: '检查磁盘权限和空间后重试；不会假装已经保存。',
  },
  ASSET_HANDLE_INVALID: {
    title: '文件引用无效',
    detail: '只能使用应用里选中的文件，不能直接读取电脑上的其他位置。',
    next: '重新用“选择本地 PDF”选一次文件。',
  },
  ASSET_PATH_OUTSIDE_ROOT: {
    title: '文件不在允许的目录里',
    detail: '为了保护本机文件，导入只接受应用管理的课本文件。',
    next: '重新选择课本文件；不会去读其他位置。',
  },
  ASSET_NOT_FOUND: {
    title: '找不到所选文件',
    detail: '文件可能被移动、改名或删除了。',
    next: '重新选择文件；已保存的个人记录不受影响。',
  },
  ASSET_NOT_A_FILE: {
    title: '选中的不是文件',
    detail: '文件夹或其他东西不能当作课本导入。',
    next: '重新选一个 PDF 文件。',
  },
  ASSET_HASH_MISMATCH: {
    title: '文件在选择之后变过',
    detail: '文件和选择时对不上，没有按原文件导入。',
    next: '重新选择一次这个文件再试。',
  },
  ASSET_METADATA_MISMATCH: {
    title: '填的文件信息对不上',
    detail: '填的页数或书名和实际文件不一致。',
    next: '核对信息或重新选择文件；不会把错误信息记到课本上。',
  },
  INPUT_MISSING: {
    title: '还没有选文件',
    detail: '没有收到文件，这次导入没有开始。',
    next: '先选一个本地 PDF，再确认开始导入。',
  },
  UNSUPPORTED: {
    title: '这种文件类型还不支持',
    detail: '现在只能导入 PDF；其他格式不会被当成课本。',
    next: '换一个 PDF 文件，或先看已有的课本。',
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
    detail: '出现了没有归类的问题；界面不会把没做完的事标成完成。',
    next: '可以重试或重新选择文件；已有的课本仍然能看。',
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '大小未知';
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
    if (jobStatus === 'failed') return '停在这一步';
    if (jobStatus === 'cancelled') return '已取消';
    if (stage === 'await_review') return '还在等你确认';
    if (stage === 'ready') return '已经可以用';
    return '正在做';
  }
  if (index < currentIndex) return '已经完成';
  return '还没开始';
}
