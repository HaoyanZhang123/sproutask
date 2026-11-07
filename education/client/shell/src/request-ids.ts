/**
 * Request ids for live data sources.
 *
 * A per-page counter (`request.study.1, .2, …`) restarts at 1 on every reload,
 * and the journal dedupes by requestId. A reloaded page therefore re-used ids
 * that the journal had already seen, the append was silently treated as a
 * retry, and the answer never reached the journal — the student saw
 * "提交没有完成 / 找不到这项内容". Ids must be unique across reloads, tabs and
 * process restarts, so they carry a boot-unique prefix.
 */

/** One random prefix per document load; independent of counters and clocks. */
const BOOT_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const counters = new Map<string, number>();

export function nextRequestId(prefix: string): string {
  const key = prefix.trim().length > 0 ? prefix.trim() : 'request';
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return `${key}.${BOOT_ID}.${next}`;
}

/** Test hook: a fresh document would get a new boot id. */
export function requestBootId(): string {
  return BOOT_ID;
}
