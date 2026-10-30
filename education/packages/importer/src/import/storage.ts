/**
 * Local persistence for imports: job state, page artifacts, per-(sha256,
 * parserVersion, page) cache, event log and published artifact files.
 *
 * Layout under the host-chosen root:
 *   jobs/<jobId>/job.json                  job state (atomic replace)
 *   jobs/<jobId>/pages/<page>.json         page extraction + blocks + figures
 *   jobs/<jobId>/artifacts/*.json|jsonl     consumer-facing artifacts
 *   jobs/<jobId>/events.jsonl              import.progress envelopes
 *   jobs/<jobId>/rejected-late-results.jsonl  proof that late results were dropped
 *   jobs/<jobId>/work/                     scratch (rendered pages, OCR batch)
 *   cache/<sha256>/<parserVersion>/pages/<page>.json   cross-job page cache
 *   assets/pages/...                       managed page images (content hash)
 *
 * No raw textbook bytes are ever written outside this root, and the root is
 * `.local/` in development so nothing lands in Git.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ImportEvent, ImportArtifacts, ImportStage, PageArtifacts, PageExtraction, StoredJob } from './types.js';
import { PARSER_VERSION } from './types.js';

/** Stable JSON so artifacts and job files diff cleanly between runs. */
export function stableStringify(value: unknown): string {
  const seen = new Set<object>();
  const walk = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input)) throw new Error('stableStringify: cycle detected');
    seen.add(input);
    if (Array.isArray(input)) {
      const mapped = input.map(walk);
      seen.delete(input);
      return mapped;
    }
    const entries = Object.entries(input as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, walk(item)] as const);
    seen.delete(input);
    return Object.fromEntries(entries);
  };
  return JSON.stringify(walk(value));
}

async function atomicWrite(absolutePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const temporary = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, contents, 'utf8');
  try {
    await rename(temporary, absolutePath);
  } catch {
    // Windows: replacing an existing file can race; remove then retry once.
    await rm(absolutePath, { force: true });
    await rename(temporary, absolutePath);
  }
}

export interface PageCacheKey {
  readonly sha256: string;
  readonly parserVersion: string;
  readonly page: number;
}

export class ImportStorage {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  /**
   * Filesystem-safe directory name for an opaque job id. Contract ids may
   * contain characters Windows forbids in file names (`:`), so the directory
   * is sanitized plus a short hash of the id.
   */
  private jobDirName(jobId: string): string {
    const safe = jobId.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 48);
    return `${safe}-${createHash('sha256').update(jobId).digest('hex').slice(0, 8)}`;
  }

  jobDir(jobId: string): string {
    return path.join(this.rootDir, 'jobs', this.jobDirName(jobId));
  }

  pagePath(jobId: string, page: number): string {
    return path.join(this.jobDir(jobId), 'pages', `${String(page).padStart(4, '0')}.json`);
  }

  artifactsDir(jobId: string): string {
    return path.join(this.jobDir(jobId), 'artifacts');
  }

  workDir(jobId: string): string {
    return path.join(this.jobDir(jobId), 'work');
  }

  cachePath(key: PageCacheKey): string {
    return path.join(
      this.rootDir,
      'cache',
      key.sha256.slice(0, 16),
      key.parserVersion,
      'pages',
      `${String(key.page).padStart(4, '0')}.json`,
    );
  }

  async readJob(jobId: string): Promise<StoredJob | null> {
    try {
      const text = await readFile(path.join(this.jobDir(jobId), 'job.json'), 'utf8');
      return JSON.parse(text) as StoredJob;
    } catch {
      return null;
    }
  }

  private async readJobByDir(dirName: string): Promise<StoredJob | null> {
    try {
      const text = await readFile(path.join(this.rootDir, 'jobs', dirName, 'job.json'), 'utf8');
      return JSON.parse(text) as StoredJob;
    } catch {
      return null;
    }
  }

  async writeJob(job: StoredJob): Promise<void> {
    await atomicWrite(path.join(this.jobDir(job.job.id), 'job.json'), `${stableStringify(job)}\n`);
  }

  async listJobs(): Promise<StoredJob[]> {
    const dir = path.join(this.rootDir, 'jobs');
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const jobs: StoredJob[] = [];
    for (const entry of entries) {
      if (entry.endsWith('.json') || entry.endsWith('.jsonl')) continue;
      const job = await this.readJobByDir(entry);
      if (job !== null) jobs.push(job);
    }
    return jobs;
  }

  async writePageArtifacts(jobId: string, page: PageArtifacts): Promise<void> {
    await atomicWrite(this.pagePath(jobId, page.extraction.page), `${stableStringify(page)}\n`);
  }

  async readPageArtifacts(jobId: string, page: number): Promise<PageArtifacts | null> {
    try {
      const text = await readFile(this.pagePath(jobId, page), 'utf8');
      return JSON.parse(text) as PageArtifacts;
    } catch {
      return null;
    }
  }

  async readPages(jobId: string): Promise<PageArtifacts[]> {
    const dir = path.join(this.jobDir(jobId), 'pages');
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const pages: PageArtifacts[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.json')) continue;
      try {
        pages.push(JSON.parse(await readFile(path.join(dir, entry), 'utf8')) as PageArtifacts);
      } catch {
        /* skip unreadable page file; the job state records what completed */
      }
    }
    return pages.sort((left, right) => left.extraction.page - right.extraction.page);
  }

  async hasPage(jobId: string, page: number): Promise<boolean> {
    try {
      await readFile(this.pagePath(jobId, page), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  async readCache(key: PageCacheKey): Promise<PageExtraction | null> {
    try {
      const text = await readFile(this.cachePath(key), 'utf8');
      const parsed = JSON.parse(text) as PageExtraction;
      if (parsed.parserVersion !== key.parserVersion) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async writeCache(extraction: PageExtraction): Promise<void> {
    const key: PageCacheKey = {
      sha256: extraction.sha256,
      parserVersion: extraction.parserVersion,
      page: extraction.page,
    };
    await atomicWrite(this.cachePath(key), `${stableStringify(extraction)}\n`);
  }

  /** Number of pages already extracted for this (sha256, parserVersion). */
  async countCachedPages(sha256: string, parserVersion = PARSER_VERSION): Promise<number> {
    const dir = path.join(this.rootDir, 'cache', sha256.slice(0, 16), parserVersion, 'pages');
    try {
      const entries = await readdir(dir);
      return entries.filter((entry) => entry.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  async clearCachePage(sha256: string, page: number, parserVersion = PARSER_VERSION): Promise<void> {
    await rm(this.cachePath({ sha256, parserVersion, page }), { force: true });
  }

  async appendEvent(jobId: string, event: ImportEvent): Promise<void> {
    const file = path.join(this.jobDir(jobId), 'events.jsonl');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(event)}\n`, { encoding: 'utf8', flag: 'a' });
  }

  /**
   * Ledger for results that arrived after a cancel. Page results carry the page
   * number; stage results (cloud concepts / final publish) carry the stage and a
   * null page. Nothing logged here is ever published into the job or artifacts.
   */
  async appendLateResult(
    jobId: string,
    record: {
      readonly page: number | null;
      readonly stage: ImportStage;
      readonly at: string;
      readonly reason: string;
    },
  ): Promise<void> {
    const file = path.join(this.jobDir(jobId), 'rejected-late-results.jsonl');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' });
  }

  async writeArtifacts(jobId: string, artifacts: ImportArtifacts): Promise<void> {
    const dir = this.artifactsDir(jobId);
    await mkdir(dir, { recursive: true });
    const blocksJsonl = artifacts.blocks
      .map((row) => JSON.stringify({ sourceRef: row.sourceRef, block: row.block }))
      .join('\n');
    await atomicWrite(path.join(dir, 'blocks.jsonl'), blocksJsonl.length === 0 ? '' : `${blocksJsonl}\n`);
    await atomicWrite(
      path.join(dir, 'figures.json'),
      `${stableStringify(artifacts.figures.map((row) => ({ sourceRef: row.sourceRef, figure: row.figure })))}\n`,
    );
    await atomicWrite(path.join(dir, 'toc-candidates.json'), `${stableStringify(artifacts.tocCandidates)}\n`);
    await atomicWrite(path.join(dir, 'page-map.json'), `${stableStringify(artifacts.pageMap)}\n`);
    await atomicWrite(path.join(dir, 'revisions.jsonl'), artifacts.revisions.length === 0 ? '' : `${artifacts.revisions.map((row) => JSON.stringify(row)).join('\n')}\n`);
    await atomicWrite(
      path.join(dir, 'manifest.json'),
      `${stableStringify({
        schemaVersion: 1,
        jobId: artifacts.jobId,
        bookInstanceId: artifacts.bookInstanceId,
        baselineSourceId: artifacts.baselineSourceId,
        pageCount: artifacts.pageMap.length,
        blockCount: artifacts.blocks.length,
        figureCount: artifacts.figures.length,
        revisionCount: artifacts.revisions.length,
        tocCandidates: artifacts.tocCandidates.length,
        parserVersion: PARSER_VERSION,
        writtenAt: new Date().toISOString(),
      })}\n`,
    );
  }

  async readArtifacts(jobId: string): Promise<ImportArtifacts | null> {
    const dir = this.artifactsDir(jobId);
    try {
      const pageMap = JSON.parse(await readFile(path.join(dir, 'page-map.json'), 'utf8')) as ImportArtifacts['pageMap'];
      const tocCandidates = JSON.parse(
        await readFile(path.join(dir, 'toc-candidates.json'), 'utf8'),
      ) as ImportArtifacts['tocCandidates'];
      const figures = JSON.parse(
        await readFile(path.join(dir, 'figures.json'), 'utf8'),
      ) as ImportArtifacts['figures'];
      const revisions = (await readFile(path.join(dir, 'revisions.jsonl'), 'utf8'))
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as ImportArtifacts['revisions'][number]);
      const blocks = (await readFile(path.join(dir, 'blocks.jsonl'), 'utf8'))
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as ImportArtifacts['blocks'][number]);
      const job = await this.readJob(jobId);
      return {
        jobId,
        blocks,
        figures,
        tocCandidates,
        pageMap,
        revisions,
        bookInstanceId: job?.bookInstanceId ?? null,
        baselineSourceId: job?.baselineSourceId ?? null,
      };
    } catch {
      return null;
    }
  }

  async removeWorkDir(jobId: string): Promise<void> {
    await rm(this.workDir(jobId), { recursive: true, force: true });
  }

  /** Content-hash id for deterministic managed assets. */
  static contentId(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
  }
}
