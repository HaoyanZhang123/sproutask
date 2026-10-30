/**
 * Import job projection used by the UI.
 *
 * T03 owns the real persistence and cancellation guarantees. The UI still
 * refuses non-monotonic or late updates so a delayed response can never make a
 * cancelled/failed job look complete on screen.
 */

import { applyImportProgress, type ImportJob } from '@edu/domain';

export function reduceJobUpdate(current: ImportJob | null, next: ImportJob): ImportJob {
  if (current === null) return next;
  if (current.id !== next.id) return current;
  if (
    current.status === 'cancelled' &&
    (next.status !== 'cancelled' || next.stage !== current.stage)
  ) {
    return current;
  }
  if (current.status === 'completed' && next.status !== 'completed') return current;

  const result = applyImportProgress(current, {
    stage: next.stage,
    status: next.status,
    completedUnits: next.completedUnits,
    totalUnits: next.totalUnits,
    checkpoint: next.checkpoint,
    error: next.error,
    retryable: next.retryable,
    updatedAt: next.updatedAt,
  });
  return result.ok ? result.value : current;
}

export function canCancel(job: ImportJob): boolean {
  return job.status === 'running' || job.status === 'paused' || job.status === 'queued';
}

export function canResume(job: ImportJob): boolean {
  return job.status === 'paused' || job.status === 'cancelled' || job.status === 'failed';
}

export function canRetry(job: ImportJob): boolean {
  return job.status === 'failed' && job.retryable;
}
