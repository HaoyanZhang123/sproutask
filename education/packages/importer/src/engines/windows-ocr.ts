/**
 * Windows OCR port: renders pages and recognizes text through Windows system
 * components (`Windows.Data.Pdf`, `Windows.Media.Ocr`), driven by a bundled
 * PowerShell script. No Tesseract/Ghostscript/Python, nothing to install.
 *
 * The script is invoked once per page batch and writes one JSON file per page,
 * so a batch killed by cancel still leaves the finished pages on disk.
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importerError } from '../errors.js';
import type { OcrAvailability, OcrLine, OcrOptions, OcrPage, OcrPageOutcome } from '../import/types.js';
import type { OcrPort, OcrRequest } from './ocr-port.js';

const DEFAULT_SCRIPT = fileURLToPath(new URL('./scripts/winrt-ocr.ps1', import.meta.url));

export interface WindowsOcrOptions {
  /** Override for tests or a packaged app copy of the script. */
  readonly scriptPath?: string;
  /** Override the PowerShell executable (defaults to Windows PowerShell 5.1). */
  readonly powerShellPath?: string;
  /** Per-batch timeout in milliseconds. */
  readonly batchTimeoutMs?: number;
}

export function resolvePowerShellPath(explicit?: string): string | null {
  if (explicit !== undefined) return existsSync(explicit) ? explicit : null;
  const systemRoot = process.env.SystemRoot ?? process.env.windir ?? 'C:\\Windows';
  const legacy = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (existsSync(legacy)) return legacy;
  return null;
}

interface RunResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly killed: boolean;
}

function runPowerShell(
  executable: string,
  args: readonly string[],
  options: { readonly timeoutMs: number; readonly shouldStop?: () => boolean },
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(executable, [...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const append = (target: string, chunk: Buffer): string =>
      target.length > 200_000 ? target : target + chunk.toString('utf8');

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    const timer = setTimeout(() => {
      killed = true;
      child.kill();
    }, options.timeoutMs);
    const poll = options.shouldStop
      ? setInterval(() => {
          if (options.shouldStop?.() === true) {
            killed = true;
            child.kill();
          }
        }, 250)
      : null;
    const finish = (code: number | null): void => {
      clearTimeout(timer);
      if (poll !== null) clearInterval(poll);
      resolve({ code, stdout, stderr, killed });
    };
    child.on('error', (error) => {
      stderr = `${stderr}\nspawn-error: ${error.message}`;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}

interface PageFile {
  readonly page: number;
  readonly ok: boolean;
  readonly error: string | null;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly renderMs: number;
  readonly ocrMs: number;
  readonly pngSaved: boolean;
  readonly lines: readonly { readonly text: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
}

export class WindowsOcrPort implements OcrPort {
  readonly id = 'windows-media-ocr';
  private readonly options: WindowsOcrOptions;
  private availabilityCache: OcrAvailability | null = null;

  constructor(options: WindowsOcrOptions = {}) {
    this.options = options;
  }

  async availability(): Promise<OcrAvailability> {
    if (this.availabilityCache !== null) return this.availabilityCache;
    if (process.platform !== 'win32') {
      this.availabilityCache = {
        available: false,
        engine: null,
        language: null,
        reason: 'NOT_WINDOWS',
      };
      return this.availabilityCache;
    }
    const executable = resolvePowerShellPath(this.options.powerShellPath);
    const script = this.options.scriptPath ?? DEFAULT_SCRIPT;
    if (executable === null || !existsSync(script)) {
      this.availabilityCache = {
        available: false,
        engine: null,
        language: null,
        reason: 'ENGINE_MISSING',
      };
      return this.availabilityCache;
    }
    const result = await runPowerShell(
      executable,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-Probe',
        '-Language',
        'zh-Hans-CN',
      ],
      { timeoutMs: 30_000 },
    );
    const line = result.stdout.trim().split(/\r?\n/).pop() ?? '';
    try {
      const parsed = JSON.parse(line) as { available?: boolean; engine?: string; language?: string; reason?: string };
      if (parsed.available === true) {
        this.availabilityCache = {
          available: true,
          engine: parsed.engine ?? 'Windows.Media.Ocr',
          language: parsed.language ?? 'zh-Hans-CN',
          reason: null,
        };
        return this.availabilityCache;
      }
      this.availabilityCache = {
        available: false,
        engine: null,
        language: null,
        reason: parsed.reason === 'LANGUAGE_MISSING' ? 'LANGUAGE_MISSING' : 'ENGINE_MISSING',
      };
      return this.availabilityCache;
    } catch {
      this.availabilityCache = {
        available: false,
        engine: null,
        language: null,
        reason: result.code === 3 ? 'LANGUAGE_MISSING' : 'ENGINE_MISSING',
      };
      return this.availabilityCache;
    }
  }

  async ocrPages(
    request: OcrRequest,
    onPage: (outcome: OcrPageOutcome) => void,
  ): Promise<{ readonly availability: OcrAvailability; readonly unprocessedPages: readonly number[] }> {
    const availability = await this.availability();
    if (!availability.available) {
      for (const page of request.pages) {
        onPage({
          ok: false,
          page,
          error: importerError(availability.reason === 'LANGUAGE_MISSING' ? 'OCR_LANGUAGE_UNAVAILABLE' : 'OCR_ENGINE_UNAVAILABLE'),
        });
      }
      return { availability, unprocessedPages: [] };
    }
    const executable = resolvePowerShellPath(this.options.powerShellPath);
    const script = this.options.scriptPath ?? DEFAULT_SCRIPT;
    if (executable === null) {
      for (const page of request.pages) {
        onPage({ ok: false, page, error: importerError('OCR_ENGINE_UNAVAILABLE') });
      }
      return { availability, unprocessedPages: [] };
    }
    const batchDir = path.join(request.workDir, 'ocr');
    await mkdir(batchDir, { recursive: true });
    const pageFiles = request.pages.map((page) => {
      const jsonPath = path.join(batchDir, `page-${String(page).padStart(4, '0')}.json`);
      const renderPath = request.assetFor(page).absolutePath;
      return { page, jsonPath, pngPath: renderPath };
    });
    const manifestPath = path.join(batchDir, `batch-${Date.now()}-${request.pages[0] ?? 0}.json`);
    await writeFile(
      manifestPath,
      JSON.stringify({
        pdf: request.absolutePath,
        pages: pageFiles.map((entry) => ({ page: entry.page, json: entry.jsonPath, png: entry.pngPath })),
      }),
      'utf8',
    );
    const timeoutMs = this.options.batchTimeoutMs ?? Math.max(120_000, request.pages.length * 30_000);
    const started = Date.now();
    const result = await runPowerShell(
      executable,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-Manifest',
        manifestPath,
        '-Language',
        request.options.language,
        '-Width',
        String(request.options.targetWidth),
      ],
      { timeoutMs, shouldStop: request.shouldStop },
    );

    const unprocessed: number[] = [];
    for (const entry of pageFiles) {
      if (!existsSync(entry.jsonPath)) {
        unprocessed.push(entry.page);
        continue;
      }
      let parsed: PageFile | null = null;
      try {
        parsed = JSON.parse(await readFile(entry.jsonPath, 'utf8')) as PageFile;
      } catch {
        parsed = null;
      }
      if (parsed === null) {
        onPage({
          ok: false,
          page: entry.page,
          error: importerError('PAGE_OCR_FAILED', {
            detailsRef: `elapsedMs:${Date.now() - started}`,
          }),
        });
        continue;
      }
      if (!parsed.ok) {
        const code = result.code === 3 ? 'OCR_LANGUAGE_UNAVAILABLE' : 'PAGE_OCR_FAILED';
        onPage({
          ok: false,
          page: entry.page,
          error: importerError(code, { detailsRef: truncate(parsed.error) }),
        });
        continue;
      }
      onPage({ ok: true, page: this.toPage(entry.page, parsed, entry.pngPath) });
    }

    if (result.code === 3) {
      this.availabilityCache = {
        available: false,
        engine: null,
        language: null,
        reason: 'LANGUAGE_MISSING',
      };
    }
    return { availability, unprocessedPages: unprocessed };
  }

  private toPage(page: number, parsed: PageFile, pngPath: string | null): OcrPage {
    const lines: OcrLine[] = parsed.lines.map((line) => ({
      text: line.text,
      box: { x: line.x, y: line.y, width: line.width, height: line.height },
    }));
    return {
      page,
      lines,
      imageWidth: parsed.imageWidth,
      imageHeight: parsed.imageHeight,
      engine: 'Windows.Media.Ocr',
      language: this.availabilityCache?.language ?? 'zh-Hans-CN',
      renderMs: parsed.renderMs,
      ocrMs: parsed.ocrMs,
      pageImagePath: parsed.pngSaved ? pngPath : null,
    };
  }
}

function truncate(text: string | null): string | undefined {
  if (text === null || text.length === 0) return undefined;
  return text.slice(0, 200);
}

/** Removes the temporary render directory of a finished job. */
export async function cleanWorkDir(workDir: string): Promise<void> {
  await rm(workDir, { recursive: true, force: true });
}

export type { OcrOptions };
