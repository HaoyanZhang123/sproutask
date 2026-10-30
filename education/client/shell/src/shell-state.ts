/** Shared shell state exposed read-only to pages. */

import type { ServiceError } from '@edu/domain';
import type {
  AuthKeyClearReceipt,
  AuthKeyResult,
  AuthKeySaveReceipt,
  AuthKeyStatus,
} from './key-port.js';
import type {
  DataResult,
  DeleteReceipt,
  DeleteScope,
  ExportReceipt,
  HomePayload,
  LearnedRangeClaim,
  RangeSaveInput,
  RangeSaveReceipt,
  RecordsPayload,
  ResumePayload,
  ShellSnapshot,
} from './data/types.js';

export type SaveState = 'saved' | 'saving' | 'failed' | 'unknown';

export interface BackTarget {
  readonly path: string;
  readonly label: string;
}

export interface EducationShellViewState {
  readonly currentPath: string;
  readonly currentPageTitle: string;
  readonly snapshot: ShellSnapshot | null;
  readonly home: HomePayload | null;
  readonly records: RecordsPayload | null;
  readonly dataStatus: 'idle' | 'loading' | 'ready' | 'error';
  readonly pageError: ServiceError | null;
  readonly fatalError: ServiceError | null;
  readonly offline: boolean;
  readonly saveState: SaveState;
  readonly resume: ResumePayload | null;
  readonly resumeError: ServiceError | null;
  readonly rangeClaim: LearnedRangeClaim | null;
  readonly backTarget: BackTarget | null;
  readonly diagnosticSkipped: boolean;
  readonly fontScale: 'standard' | 'large';
  /** Configured state is derived from host status, never from a stored key. */
  readonly keyStatus: 'unknown' | 'configured' | 'missing';
  /** Host-provided masked suffix only; null when unavailable. */
  readonly keySuffix: string | null;
}

export interface EducationShellApi {
  getState(): Readonly<EducationShellViewState>;
  navigate(path: string): Promise<void>;
  back(): Promise<void>;
  refresh(): Promise<void>;
  resumeLast(): Promise<DataResult<ResumePayload>>;
  saveRange(input: RangeSaveInput): Promise<DataResult<RangeSaveReceipt>>;
  retrySave(): Promise<void>;
  exportData(): Promise<DataResult<ExportReceipt>>;
  deleteData(scope: DeleteScope): Promise<DataResult<DeleteReceipt>>;
  setDiagnosticSkipped(skipped: boolean): void;
  setFontScale(scale: 'standard' | 'large'): void;
  loadKeyStatus(): Promise<AuthKeyResult<AuthKeyStatus>>;
  saveKey(apiKey: string): Promise<AuthKeyResult<AuthKeySaveReceipt>>;
  clearKey(): Promise<AuthKeyResult<AuthKeyClearReceipt>>;
}
