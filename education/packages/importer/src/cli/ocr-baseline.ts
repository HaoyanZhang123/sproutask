/**
 * Real-textbook OCR baseline runner (T03 layer 2).
 *
 * Runs the importer package itself (not a one-off script) over a real PDF and
 * writes evidence into `education/.local/evidence/T03/<run>/`:
 *   jobs/<jobId>/artifacts/blocks.jsonl      per-page text blocks (source of truth)
 *   jobs/<jobId>/artifacts/page-map.json     per-page method, printed page, quality
 *   jobs/<jobId>/artifacts/toc-candidates.json
 *   jobs/<jobId>/artifacts/figures.json
 *   jobs/<jobId>/artifacts/revisions.jsonl   OCR clean-up ledger (原稿不可覆盖)
 *   assets/pages/...                         rendered page images (managed assets)
 *   baseline-summary.json / baseline.log     anonymous statistics, no textbook text
 *
 * Usage (from the education workspace):
 *   node --import ./packages/importer/bin/ts-js-resolve.mjs \
 *     packages/importer/src/cli/ocr-baseline.ts --pdf <abs pdf> --pages 1-12
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { FileAssetStore, sha256File } from '../assets.js';
import { PdfDocumentBackend } from '../engines/pdf-backend.js';
import { WindowsOcrPort } from '../engines/windows-ocr.js';
import { createImporter } from '../importer.js';
import { PARSER_VERSION, DEFAULT_OCR_OPTIONS, type ImportEvent } from '../import/types.js';
import { ImportStorage } from '../import/storage.js';
import { buildEngineStatus } from '../materials.js';

interface BaselineSummary {
  readonly runId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly elapsedMs: number;
  readonly source: {
    readonly absolutePath: string;
    readonly sha256: string;
    readonly bytes: number;
    readonly probedPageCount: number;
    readonly headerVersion: string;
    readonly recoveredXref: boolean;
  };
  readonly parserVersion: string;
  readonly backendId: string;
  readonly ocrOptions: typeof DEFAULT_OCR_OPTIONS;
  readonly ocr: unknown;
  readonly job: {
    readonly id: string;
    readonly stage: string;
    readonly status: string;
    readonly completedUnits: number;
    readonly totalUnits: number;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
  };
  readonly pages: {
    readonly total: number;
    readonly ocr: number;
    readonly textLayer: number;
    readonly emptyText: number;
    readonly failed: number;
    readonly avgRenderMs: number;
    readonly avgOcrMs: number;
    readonly totalRenderMs: number;
    readonly totalOcrMs: number;
    readonly slowestPages: readonly { readonly page: number; readonly ms: number }[];
    /** Decorative top-margin OCR noise excluded from the content blocks. */
    readonly headerArtifactPages: number;
    readonly headerArtifactLines: number;
  };
  readonly chars: {
    readonly total: number;
    readonly avg: number;
    readonly median: number;
    readonly min: number;
    readonly max: number;
    readonly cjkTotal: number;
  };
  readonly quality: {
    readonly avgScore: number;
    readonly lowQualityPages: readonly number[];
    readonly flagCounts: Record<string, number>;
  };
  readonly emptyTextPages: readonly number[];
  readonly tocCandidates: readonly {
    readonly pdfPage: number;
    readonly title: string;
    readonly entries: number;
    readonly confidence: number;
    readonly printedPages: readonly (string | null)[];
  }[];
  readonly printedPageMapping: {
    readonly pagesWithLabel: number;
    readonly pagesWithoutLabel: number;
    readonly dominantOffset: number | null;
    readonly offsets: readonly { readonly offset: number; readonly count: number }[];
    readonly consistent: boolean;
    readonly outlierPages: readonly number[];
  };
  readonly knownIssues: readonly {
    readonly page: number;
    readonly issue: string;
    readonly evidence: string;
  }[];
  readonly artifacts: {
    readonly jobRoot: string;
    readonly blocksJsonl: string;
    readonly pageMap: string;
    readonly tocCandidates: string;
    readonly figures: string;
    readonly revisions: string;
    readonly pageImageAssetDir: string;
  };
}

function isoNow(): string {
  return new Date().toISOString();
}

function parsePageRange(value: string | undefined, pageCount: number): number[] {
  if (value === undefined) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>();
  for (const part of value.split(',')) {
    const range = /^(\d+)-(\d+)$/.exec(part.trim());
    if (range !== null) {
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }
    const single = Number.parseInt(part.trim(), 10);
    if (Number.isFinite(single)) pages.add(single);
  }
  return [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}


async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      pdf: { type: 'string' },
      out: { type: 'string' },
      pages: { type: 'string' },
      width: { type: 'string' },
      batch: { type: 'string' },
      'no-images': { type: 'boolean', default: false },
      'fail-fast': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  const pdfArgument = values.pdf;
  if (pdfArgument === undefined) {
    console.error('usage: ocr-baseline.ts --pdf <path> [--out <dir>] [--pages 1-12] [--width 2400] [--batch 10]');
    process.exit(2);
  }
  const pdfPath = path.resolve(pdfArgument);
  const pdfStat = await stat(pdfPath);
  if (!pdfStat.isFile()) throw new Error(`not a file: ${pdfPath}`);

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '');
  const runDir = path.resolve(values.out ?? path.join('education', '.local', 'evidence', 'T03', `run-${stamp}`));
  await mkdir(runDir, { recursive: true });
  const logLines: string[] = [];
  const log = (line: string): void => {
    const entry = `${new Date().toISOString()} ${line}`;
    logLines.push(entry);
    console.log(entry);
  };

  const sha256 = await sha256File(pdfPath);
  log(`source=${pdfPath} bytes=${pdfStat.size} sha256=${sha256}`);
  log(`runDir=${runDir}`);

  const store = new FileAssetStore({ rootDir: runDir, allowedRoots: [path.dirname(pdfPath)] });
  const assetId = `asset:src-${sha256.slice(0, 16)}`;
  store.register(assetId, pdfPath);

  const storage = new ImportStorage(runDir);
  const ocrPort = new WindowsOcrPort();
  const backend = new PdfDocumentBackend({ ocr: ocrPort });
  const engineStatus = buildEngineStatus({
    backendId: backend.id,
    ocr: await backend.ocrAvailability(),
    ocrOptions: DEFAULT_OCR_OPTIONS,
  });
  log(`ocr.available=${String(engineStatus.ocr.available)} engine=${engineStatus.ocr.engine ?? '-'} language=${engineStatus.ocr.language ?? '-'}`);

  const probe = await backend.probePdf(pdfPath);
  log(`probe pages=${probe.pageCount} encrypted=${String(probe.encrypted)} recovered=${String(probe.recoveredXref)} header=${probe.headerVersion}`);
  const pages = parsePageRange(values.pages, probe.pageCount);
  const pageSet = new Set(pages);
  log(`pages selected=${pages.length} (${pages[0] ?? '-'}..${pages[pages.length - 1] ?? '-'})`);

  const width = values.width === undefined ? 2400 : Number.parseInt(values.width, 10);
  const batchSize = values.batch === undefined ? 10 : Number.parseInt(values.batch, 10);
  const runStarted = Date.now();
  const startedAt = isoNow();

  const events: ImportEvent[] = [];
  const importer = createImporter({
    assets: store,
    backend,
    paths: { rootDir: runDir },
    clock: { now: isoNow },
    ids: { next: (prefix: string) => `${prefix}:${randomUUID().replace(/-/g, '').slice(0, 12)}` },
    binding: {
      async bind() {
        return { bookInstanceId: null, baselineSourceId: `baseline:bio7a-${sha256.slice(0, 12)}` };
      },
    },
    network: { status: 'unavailable' },
    ocr: {
      targetWidth: width,
      savePageImages: values['no-images'] !== true,
      batchSize,
      language: 'zh-Hans-CN',
    },
    onProgress: (event) => {
      events.push(event);
      if (event.payload.page !== null) {
        log(`progress stage=${event.stage} status=${event.status} unit=${event.completedUnits}/${event.totalUnits}`);
      }
    },
  });

  // Import the whole file (the pipeline caches every page); the page selection
  // only controls the statistics if a subset was requested.
  const result = await importer.start(
    { requestId: `baseline-${stamp}`, learnerId: 'learner:baseline', now: startedAt },
    {
      file: { assetId, sha256, originalName: path.basename(pdfPath) },
      confirmedMetadata: {
        title: path.basename(pdfPath).replace(/\.pdf$/i, ''),
        publisher: null,
        editionLabel: null,
        pageCount: probe.pageCount,
      },
    },
  );
  const endedAt = isoNow();
  const elapsedMs = Date.now() - runStarted;
  if (!result.ok) {
    log(`import failed: ${result.error.code} ${result.error.message}`);
    await writeFile(path.join(runDir, 'baseline.log'), `${logLines.join('\n')}\n`, 'utf8');
    process.exit(values['fail-fast'] === true ? 1 : 3);
  }
  const job = result.data;
  log(`job id=${job.id} stage=${job.stage} status=${job.status} units=${job.completedUnits}/${job.totalUnits} error=${job.error?.code ?? '-'}`);

  const artifacts = await importer.artifacts({ requestId: 'baseline-read', learnerId: 'learner:baseline', now: endedAt }, job.id);
  if (!artifacts.ok) {
    log(`artifacts unreadable: ${artifacts.error.code}`);
    process.exit(1);
  }
  const pageMap = artifacts.data.pageMap.filter((row) => pageSet.has(row.page));
  const jobDir = storage.jobDir(job.id);
  const artifactsDir = storage.artifactsDir(job.id);

  const blocks = artifacts.data.blocks;
  const charsPerPage = new Map<number, number>();
  const cjkPerPage = new Map<number, number>();
  for (const row of blocks) {
    const text = row.block.revisedText ?? row.block.originalText;
    charsPerPage.set(row.sourceRef.pdfPage, (charsPerPage.get(row.sourceRef.pdfPage) ?? 0) + text.replace(/\s/g, '').length);
    const cjk = [...text].filter((char) => /[\u3400-\u4dbf\u4e00-\u9fff]/.test(char)).length;
    cjkPerPage.set(row.sourceRef.pdfPage, (cjkPerPage.get(row.sourceRef.pdfPage) ?? 0) + cjk);
  }
  const charValues = pageMap.map((row) => charsPerPage.get(row.page) ?? 0);
  const emptyTextPages = pageMap.filter((row) => (charsPerPage.get(row.page) ?? 0) === 0).map((row) => row.page);
  const flagCounts: Record<string, number> = {};
  for (const row of pageMap) for (const flag of row.flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;

  const labelled = pageMap.filter((row) => row.printedPage !== null);
  const offsetCounts = new Map<number, number>();
  for (const row of labelled) {
    const printed = Number.parseInt(row.printedPage ?? '', 10);
    if (Number.isFinite(printed)) offsetCounts.set(printed - row.page, (offsetCounts.get(printed - row.page) ?? 0) + 1);
  }
  const offsets = [...offsetCounts.entries()]
    .map(([offset, count]) => ({ offset, count }))
    .sort((left, right) => left.offset - right.offset);
  const dominantOffset = offsets.length === 0 ? null : [...offsets].sort((a, b) => b.count - a.count)[0].offset;
  const outlierPages = labelled
    .filter((row) => {
      const printed = Number.parseInt(row.printedPage ?? '', 10);
      return Number.isFinite(printed) && dominantOffset !== null && printed - row.page !== dominantOffset;
    })
    .map((row) => row.page);

  const slowest = [...pageMap]
    .map((row) => ({ page: row.page, ms: row.renderMs + row.ocrMs }))
    .sort((left, right) => right.ms - left.ms)
    .slice(0, 10);

  const knownIssues: { page: number; issue: string; evidence: string }[] = [];
  for (const page of outlierPages.slice(0, 10)) {
    knownIssues.push({
      page,
      issue: 'footer page label does not match the dominant PDF->printed offset',
      evidence: `jobs/${path.basename(jobDir)}/artifacts/page-map.json`,
    });
  }
  for (const row of pageMap.filter((entry) => entry.flags.includes('LOW_CHARS')).slice(0, 10)) {
    knownIssues.push({
      page: row.page,
      issue: 'very few characters recognized on a scanned page',
      evidence: `jobs/${path.basename(jobDir)}/artifacts/page-map.json`,
    });
  }
  for (const row of pageMap.filter((entry) => entry.flags.includes('UNDECODABLE_GLYPHS')).slice(0, 10)) {
    knownIssues.push({
      page: row.page,
      issue: 'engine produced undecodable glyphs',
      evidence: `jobs/${path.basename(jobDir)}/artifacts/page-map.json`,
    });
  }
  for (const page of emptyTextPages.slice(0, 10)) {
    knownIssues.push({
      page,
      issue: 'no text recognized (possible blank page or OCR failure)',
      evidence: `jobs/${path.basename(jobDir)}/artifacts/page-map.json`,
    });
  }
  const flagged = pageMap.filter((row) => row.flags.includes('ENGINE_SPACE_ARTIFACTS'));
  if (flagged.length > 0) {
    knownIssues.push({
      page: flagged[0].page,
      issue: 'engine inserts spaces between CJK characters (normalized into revisedText; originalText kept)',
      evidence: `jobs/${path.basename(jobDir)}/artifacts/revisions.jsonl`,
    });
  }

  const summary: BaselineSummary = {
    runId: path.basename(runDir),
    startedAt,
    endedAt,
    elapsedMs,
    source: {
      absolutePath: pdfPath,
      sha256,
      bytes: pdfStat.size,
      probedPageCount: probe.pageCount,
      headerVersion: probe.headerVersion,
      recoveredXref: probe.recoveredXref,
    },
    parserVersion: PARSER_VERSION,
    backendId: backend.id,
    ocrOptions: DEFAULT_OCR_OPTIONS,
    ocr: engineStatus.ocr,
    job: {
      id: job.id,
      stage: job.stage,
      status: job.status,
      completedUnits: job.completedUnits,
      totalUnits: job.totalUnits,
      errorCode: job.error?.code ?? null,
      errorMessage: job.error?.message ?? null,
    },
    pages: {
      total: pageMap.length,
      ocr: pageMap.filter((row) => row.method === 'ocr').length,
      textLayer: pageMap.filter((row) => row.method === 'text_layer').length,
      emptyText: emptyTextPages.length,
      failed: job.totalUnits - job.completedUnits,
      avgRenderMs: Math.round(pageMap.reduce((sum, row) => sum + row.renderMs, 0) / Math.max(1, pageMap.length)),
      avgOcrMs: Math.round(pageMap.reduce((sum, row) => sum + row.ocrMs, 0) / Math.max(1, pageMap.length)),
      totalRenderMs: pageMap.reduce((sum, row) => sum + row.renderMs, 0),
      totalOcrMs: pageMap.reduce((sum, row) => sum + row.ocrMs, 0),
      slowestPages: slowest,
      headerArtifactPages: pageMap.filter((row) => row.headerArtifactCount > 0).length,
      headerArtifactLines: pageMap.reduce((sum, row) => sum + row.headerArtifactCount, 0),
    },
    chars: {
      total: charValues.reduce((sum, value) => sum + value, 0),
      avg: Math.round(charValues.reduce((sum, value) => sum + value, 0) / Math.max(1, charValues.length)),
      median: median(charValues),
      min: charValues.length === 0 ? 0 : Math.min(...charValues),
      max: charValues.length === 0 ? 0 : Math.max(...charValues),
      cjkTotal: [...cjkPerPage.values()].reduce((sum, value) => sum + value, 0),
    },
    quality: {
      avgScore: Number(
        (pageMap.reduce((sum, row) => sum + row.qualityScore, 0) / Math.max(1, pageMap.length)).toFixed(3),
      ),
      lowQualityPages: pageMap.filter((row) => row.qualityScore < 0.6).map((row) => row.page),
      flagCounts,
    },
    emptyTextPages,
    tocCandidates: artifacts.data.tocCandidates.map((candidate) => ({
      pdfPage: candidate.pdfPage,
      title: candidate.title,
      entries: candidate.entries.length,
      confidence: candidate.confidence,
      printedPages: candidate.entries.map((entry) => entry.printedPage).slice(0, 20),
    })),
    printedPageMapping: {
      pagesWithLabel: labelled.length,
      pagesWithoutLabel: pageMap.length - labelled.length,
      dominantOffset,
      offsets,
      consistent: offsets.length === 1,
      outlierPages,
    },
    knownIssues,
    artifacts: {
      jobRoot: jobDir,
      blocksJsonl: path.join(artifactsDir, 'blocks.jsonl'),
      pageMap: path.join(artifactsDir, 'page-map.json'),
      tocCandidates: path.join(artifactsDir, 'toc-candidates.json'),
      figures: path.join(artifactsDir, 'figures.json'),
      revisions: path.join(artifactsDir, 'revisions.jsonl'),
      pageImageAssetDir: path.join(runDir, 'assets', 'pages'),
    },
  };

  // Per-page anonymous table (no textbook text, only counts/timings/flags).
  const table = pageMap
    .map(
      (row) =>
        `${String(row.page).padStart(3, '0')}\t${row.method}\tchars=${row.charCount}\tprinted=${row.printedPage ?? '-'}\t` +
        `renderMs=${row.renderMs}\tocrMs=${row.ocrMs}\tquality=${row.qualityScore}\tflags=${row.flags.join('|')}`,
    )
    .join('\n');
  await writeFile(path.join(runDir, 'baseline-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(path.join(runDir, 'baseline-pages.tsv'), `${table}\n`, 'utf8');
  await writeFile(path.join(runDir, 'baseline.log'), `${logLines.join('\n')}\n`, 'utf8');
  log(`summary written: ${path.join(runDir, 'baseline-summary.json')}`);
  log(`pages=${summary.pages.total} ocr=${summary.pages.ocr} empty=${summary.emptyTextPages.length} elapsedMs=${elapsedMs}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
