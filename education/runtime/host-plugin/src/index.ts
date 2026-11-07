/**
 * Education host plugin for the fixed DSH runtime (phase B).
 *
 * Registers the real education composition (knowledge/learner/storage/tutor/
 * grading/host ports), exposes the education tools through `ctx.tools.register`
 * and adds two loopback-only host routes used by the runtime acceptance:
 *   GET  /edu/api/status          -> capabilities/auth status/tools/pack
 *   POST /edu/api/live-selftest   -> one real DSH model turn that must call the
 *                                    education tools (requires x-edu-selftest).
 *
 * The plugin is bundled to a single ESM file by scripts/build-education.mjs so
 * the DSH loader never has to resolve workspace TypeScript sources.
 */

import { spawnSync } from 'node:child_process';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServiceResult } from '@edu/domain';
import { createDeepSeekVisionClient, type VisionClient } from '@edu/visuals';
import {
  composeEducationRuntime,
  type EducationRuntimeComposition,
} from '../../src/runtime-composition.js';
import { G1Service } from '../../src/g1-service.js';

interface ToolDefinitionLike {
  readonly name: string;
  readonly description: string;
  readonly parameters: unknown;
  readonly output?: unknown;
  readonly execute: (args: unknown, context?: unknown) => Promise<unknown>;
}

interface ToolHostLike {
  register(definition: ToolDefinitionLike): void;
}

interface WebRouteLike {
  readonly kind: 'exact' | 'prefix';
  readonly path: string;
  readonly handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

interface WebServerLike {
  register(route: WebRouteLike): () => void;
}

interface HostContextLike {
  readonly tools: ToolHostLike;
  readonly agents?: unknown;
  readonly sessions?: unknown;
  readonly credentials?: CredentialsLike;
  readonly reflect?: { get(name: string, strict?: boolean): unknown };
  effect?(dispose: () => void, label: string): void;
}

interface CredentialsLike {
  readRecord(key: string): Promise<
    | {
        readonly kind: string;
        readonly payload?: { readonly version?: number; readonly secret?: string };
      }
    | undefined
  >;
}

const AUTH_RECORD_KEY = 'client-connection/browser-session';
const AUTH_COOKIE_PREFIX = 'dsh-auth-';

function base64url(value: Buffer): string {
  return value.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodeBase64url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) return null;
  const decoded = Buffer.from(value, 'base64url');
  return base64url(decoded) === value ? decoded : null;
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (header === undefined) return null;
  for (const segment of header.split(';')) {
    const at = segment.indexOf('=');
    if (at === -1 || segment.slice(0, at).trim() !== name) continue;
    return segment.slice(at + 1).trim();
  }
  return null;
}

/**
 * Verify the same signed browser-session cookie the DSH web carrier sets after
 * exchanging `?token=`. The secret lives in the DSH credentials record named
 * `client-connection/browser-session`; this function never returns or logs it.
 */
async function isAuthorized(ctx: HostContextLike, req: IncomingMessage): Promise<boolean> {
  if (!isLoopback(req)) return false;
  const host = req.headers.host;
  if (host === undefined) return false;
  let credentials: CredentialsLike | undefined;
  try {
    credentials = ctx.reflect?.get('credentials', false) as CredentialsLike | undefined;
  } catch {
    return false;
  }
  if (credentials === undefined) return false;
  let record: Awaited<ReturnType<CredentialsLike['readRecord']>>;
  try {
    record = await credentials.readRecord(AUTH_RECORD_KEY);
  } catch {
    return false;
  }
  if (record === undefined || record.kind !== 'grant' || record.payload?.version !== 1) return false;
  const secret = typeof record.payload.secret === 'string' ? decodeBase64url(record.payload.secret) : null;
  if (secret === null) return false;
  const name = `${AUTH_COOKIE_PREFIX}${base64url(createHash('sha256').update(host).digest())}`;
  const value = cookieValue(req.headers.cookie, name);
  if (value === null) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [version, body, encodedSignature] = parts;
  if ((version !== 'v1' && version !== 'v2') || body === undefined || encodedSignature === undefined) return false;
  const actualSignature = decodeBase64url(encodedSignature);
  if (actualSignature === null) return false;
  const expectedSignature = createHmac('sha256', secret).update(body).digest();
  if (
    actualSignature.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return false;
  }
  const bodyBytes = decodeBase64url(body);
  if (bodyBytes === null) return false;
  try {
    const payload = JSON.parse(bodyBytes.toString('utf8')) as {
      version?: number;
      authority?: string;
      expiresAt?: number;
    };
    return (
      (payload.version === 1 || payload.version === 2) &&
      version === `v${String(payload.version)}` &&
      payload.authority === host &&
      typeof payload.expiresAt === 'number' &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

export const inject = ['tools', 'agents', 'sessions'];

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, '..', '..', '..');
const runtimeLog = process.env['EDU_RUNTIME_LOG'] ?? path.join(workspaceRoot, '.local', 'cache', 'T01', 'runtime.log');

function log(record: Record<string, unknown>): void {
  try {
    mkdirSync(path.dirname(runtimeLog), { recursive: true });
    appendFileSync(
      runtimeLog,
      `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`,
      'utf8',
    );
  } catch {
    /* evidence logging must never break the runtime */
  }
}

let sharedComposition: Promise<ServiceResult<EducationRuntimeComposition>> | null = null;
let routesRegistered = false;
let g1Service: G1Service | null = null;

async function compositionFor(ctx: HostContextLike): Promise<ServiceResult<EducationRuntimeComposition>> {
  if (sharedComposition !== null) return sharedComposition;
  const dataRoot =
    process.env['EDU_DATA_ROOT'] ?? path.join(workspaceRoot, '.local', 'cache', 'T01', 'learner-data');
  sharedComposition = composeEducationRuntime({
    workspaceRoot,
    dataRoot,
    agents: ctx.agents as never,
    sessions: ctx.sessions as never,
    env: process.env,
    dshVersion: '0.2.1-rc.3',
    onAudit: (event) => log({ event: 'edu.audit', payload: event }),
  });
  return sharedComposition;
}

function wrapTool(definition: ToolDefinitionLike): ToolDefinitionLike {
  const output = definition.output as
    | { render?: (args: unknown, value: unknown) => readonly { type: string; text?: string }[] }
    | undefined;
  const originalRender = output?.render;
  return {
    ...definition,
    output:
      output === undefined
        ? undefined
        : {
            ...output,
            render(args: unknown, value: unknown) {
              const base = originalRender?.(args, value) ?? [];
              if (definition.name === 'edu_get_concept') {
                const concept = (value as { concept?: { sourceRefs?: unknown } } | null)?.concept;
                const refs = Array.isArray(concept?.sourceRefs)
                  ? concept.sourceRefs.filter((ref): ref is string => typeof ref === 'string')
                  : [];
                return [
                  ...base,
                  {
                    type: 'text',
                    text: `sourceRefs: ${refs.length > 0 ? refs.join(', ') : '(none)'}`,
                  },
                ];
              }
              if (definition.name === 'edu_progress_summary') {
                const concepts = (value as { concepts?: readonly { conceptId?: unknown }[] } | null)?.concepts ?? [];
                const ids = concepts
                  .map((concept) => concept.conceptId)
                  .filter((id): id is string => typeof id === 'string');
                return [
                  ...base,
                  {
                    type: 'text',
                    text: `conceptIds: ${ids.length > 0 ? ids.join(', ') : '(none)'}`,
                  },
                ];
              }
              if (definition.name === 'edu_list_activities') {
                const activities =
                  (value as { activities?: readonly { activityId?: unknown; sourceRefs?: unknown }[] } | null)
                    ?.activities ?? [];
                const ids = activities
                  .map((activity) => activity.activityId)
                  .filter((id): id is string => typeof id === 'string');
                const refs = activities.flatMap((activity) =>
                  Array.isArray(activity.sourceRefs)
                    ? activity.sourceRefs.filter((ref): ref is string => typeof ref === 'string')
                    : [],
                );
                return [
                  ...base,
                  {
                    type: 'text',
                    text: `activityIds: ${ids.length > 0 ? ids.join(', ') : '(none)'}; sourceRefs: ${
                      refs.length > 0 ? [...new Set(refs)].join(', ') : '(none)'
                    }`,
                  },
                ];
              }
              return base;
            },
          },
    async execute(args: unknown, context?: unknown): Promise<unknown> {
      log({ event: 'tool.call', name: definition.name, args });
      try {
        const value = await definition.execute(args, context);
        log({ event: 'tool.result', name: definition.name, value });
        return value;
      } catch (error) {
        log({ event: 'tool.error', name: definition.name, message: (error as Error).message });
        throw error;
      }
    },
  };
}

function registerTools(ctx: HostContextLike, composition: EducationRuntimeComposition): void {
  for (const definition of composition.tools.definitions) {
    ctx.tools.register(wrapTool(definition as ToolDefinitionLike));
  }
}

function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function studentDataRoot(): string {
  return (
    process.env['SPROUTASK_DATA_ROOT'] ??
    process.env['EDU_DATA_ROOT'] ??
    path.join(workspaceRoot, '.local')
  );
}

function modelKeyFile(): string {
  return path.join(studentDataRoot(), 'secrets', 'model-key.dat');
}

const PROTECT_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  'Add-Type -AssemblyName System.Security',
  '$plain=[Console]::In.ReadToEnd()',
  '$bytes=[Text.Encoding]::UTF8.GetBytes($plain)',
  '$p=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '[Convert]::ToBase64String($p)',
].join(';');

const UNPROTECT_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  'Add-Type -AssemblyName System.Security',
  '$b64=[Console]::In.ReadToEnd()',
  '$p=[Convert]::FromBase64String($b64)',
  '$b=[Security.Cryptography.ProtectedData]::Unprotect($p,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '[Text.Encoding]::UTF8.GetString($b)',
].join(';');

function powershellExecutable(): string | null {
  const root = process.env['SystemRoot'] ?? process.env['windir'] ?? 'C:\\Windows';
  const candidates = [
    path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'pwsh.exe',
    'powershell.exe',
  ];
  return candidates.find((candidate) => (candidate.includes('\\') ? existsSync(candidate) : true)) ?? null;
}

function runPowerShell(script: string, input: string): { stdout: string | null; error: string | null } {
  const executable = powershellExecutable();
  if (executable === null) {
    return { stdout: null, error: '无法找到系统 PowerShell（DPAPI 加解密需要）' };
  }
  const result = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command', script], {
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, PATH: `${path.dirname(executable)};${process.env['PATH'] ?? ''}` },
  });
  if (result.status !== 0) {
    return { stdout: null, error: '系统 PowerShell DPAPI 调用失败' };
  }
  const output = result.stdout.trim();
  return output.length > 0 ? { stdout: output, error: null } : { stdout: null, error: 'DPAPI 返回空结果' };
}

function modelKeyConfigured(): boolean {
  try {
    return existsSync(modelKeyFile()) && statSync(modelKeyFile()).size > 0;
  } catch {
    return false;
  }
}

function readModelKey(): { key: string | null; error: string | null } {
  try {
    const protectedBase64 = readFileSync(modelKeyFile()).toString('utf8');
    const result = runPowerShell(UNPROTECT_SCRIPT, protectedBase64);
    return { key: result.stdout, error: result.error };
  } catch {
    return { key: null, error: '加密 Key 文件读取失败' };
  }
}

function maskKey(key: string): string {
  return `****${key.slice(-4)}`;
}

/** Same model route the tutor uses; the key never leaves this process. */
const IMAGE_MODEL = 'deepseek-flash';

function imageModelAvailable(): boolean {
  if ((process.env['DEEPSEEK_API_KEY'] ?? '').trim().length > 0) return true;
  return modelKeyConfigured();
}

/**
 * F7: build the key-backed vision client on demand (only when a gate-passed
 * image is graded). The key comes from the process env or the DPAPI record; it
 * is never logged, returned to the client or written to evidence.
 */
function visionClientForModel(): VisionClient | null {
  const envKey = (process.env['DEEPSEEK_API_KEY'] ?? '').trim();
  const key = envKey.length > 0 ? envKey : readModelKey().key;
  const trimmed = (key ?? '').trim();
  if (trimmed.length === 0) return null;
  return createDeepSeekVisionClient({
    apiKey: trimmed,
    model: IMAGE_MODEL,
    maxTokens: 2500,
    timeoutMs: 120_000,
  });
}

function json(res: ServerResponse, status: number, value: unknown): void {
  const body = `${JSON.stringify(value)}\n`;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function requestIdOf(req: IncomingMessage, prefix: string): string {
  const value = req.headers['x-edu-request-id'];
  return typeof value === 'string' && value.trim().length > 0 ? value : `${prefix}.${String(Date.now())}`;
}

/**
 * 让学生用系统自带的文件夹选择框选一个导出目录。
 *
 * 这里刻意不用 DSH 的 `ctx.directoryPicker`：那个插件会连带挂载一个客户端侧
 * 插件，而它依赖 `ui-workspace`——产品的学生界面把 DSH 侧栏/工作区都禁用了，
 * 结果整个 Web 启动会报 "1 entry did not activate"。宿主自己拉起 PowerShell
 * 的 FolderBrowserDialog，和读密钥是同一条已验证路径，不引入新依赖。
 */
async function pickExportDirectory(_ctx: HostContextLike): Promise<string | null> {
  const script = [
    "$ErrorActionPreference='Stop'",
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$d.Description = '选择芽问学习记录的保存位置'",
    "$d.UseDescriptionForTitle = $true",
    'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }',
  ].join(';');
  const systemRoot = process.env['SystemRoot'] ?? process.env['windir'] ?? 'C:\\Windows';
  const absolutePowerShell = path.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const powerShell = existsSync(absolutePowerShell) ? absolutePowerShell : 'powershell.exe';
  const result = spawnSync(powerShell, ['-NoProfile', '-STA', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5 * 60 * 1000,
  });
  if (result.status !== 0) return null;
  const chosen = (result.stdout ?? '').trim();
  if (chosen.length === 0 || !path.isAbsolute(chosen)) return null;
  return chosen;
}

async function readBody(
  req: IncomingMessage,
  maxBytes = 1024 * 1024,
): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) return null;
    chunks.push(buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function registerRoutes(ctx: HostContextLike, composition: EducationRuntimeComposition): void {
  if (routesRegistered) return;
  let webServer: WebServerLike | undefined;
  try {
    webServer = ctx.reflect?.get('webServer', false) as WebServerLike | undefined;
  } catch {
    webServer = undefined;
  }
  if (webServer === undefined || typeof webServer.register !== 'function') {
    log({ event: 'route.skipped', reason: 'webServer service not present (headless profile)' });
    return;
  }
  routesRegistered = true;
  webServer.register({
    kind: 'exact',
    path: '/edu/api/status',
    async handler(req, res) {
      if (!isLoopback(req)) {
        json(res, 403, { ok: false, error: 'loopback only' });
        return;
      }
      if (!(await isAuthorized(ctx, req))) {
        json(res, 401, { ok: false, error: 'authentication required' });
        return;
      }
      const capabilities = await composition.host.capabilities({
        requestId: 'route.status',
        learnerId: 'learner.local.default',
        now: composition.clock.now(),
      });
      const auth = await composition.host.authStatus({
        requestId: 'route.status',
        learnerId: 'learner.local.default',
        now: composition.clock.now(),
      });
      const keyConfigured = modelKeyConfigured();
      json(res, 200, {
        ok: true,
        status: composition.status,
        blockers: composition.blockers,
        capabilities: capabilities.ok ? capabilities.data : null,
        auth:
          auth.ok && auth.data !== null
            ? {
                ...auth.data,
                method: keyConfigured ? 'api_key' : auth.data.method,
                status: keyConfigured ? 'available' : auth.data.status,
              }
            : null,
        pack: composition.packKey,
        tools: composition.tools.names,
        pages: composition.pages.list().map((page) => ({ id: page.id, path: page.path })),
        dto: composition.dto.shellBootstrap(),
      });
    },
  });
  webServer.register({
    kind: 'exact',
    path: '/edu/api/auth/key',
    async handler(req, res) {
      if (!isLoopback(req)) {
        json(res, 403, { ok: false, error: 'loopback only' });
        return;
      }
      if (!(await isAuthorized(ctx, req))) {
        json(res, 401, { ok: false, error: 'authentication required' });
        return;
      }
      if (req.method === 'GET') {
        if (!existsSync(modelKeyFile())) {
          json(res, 200, { ok: true, status: 'missing' });
          return;
        }
        const decrypted = readModelKey();
        if (decrypted.key === null) {
          json(res, 500, {
            ok: false,
            error: 'INTERNAL',
            message: decrypted.error ?? '无法解密已保存的 Key',
          });
          return;
        }
        json(res, 200, {
          ok: true,
          status: 'configured',
          maskedSuffix: maskKey(decrypted.key),
          lastCheckedAt: new Date(statSync(modelKeyFile()).mtimeMs).toISOString(),
        });
        return;
      }
      if (req.method === 'DELETE') {
        try {
          if (existsSync(modelKeyFile())) unlinkSync(modelKeyFile());
          json(res, 200, { ok: true, status: 'missing' });
        } catch {
          json(res, 500, { ok: false, error: 'INTERNAL' });
        }
        return;
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const raw = typeof body?.['apiKey'] === 'string' ? body['apiKey'] : '';
        if (Buffer.byteLength(raw, 'utf8') > 4096) {
          json(res, 400, { ok: false, error: 'INVALID_FORMAT' });
          return;
        }
        const key = raw.trim();
        if (!/^sk-[A-Za-z0-9_-]{16,200}$/u.test(key)) {
          json(res, 400, { ok: false, error: 'INVALID_FORMAT' });
          return;
        }
        const protectedResult = runPowerShell(PROTECT_SCRIPT, key);
        if (protectedResult.stdout === null) {
          json(res, 500, {
            ok: false,
            error: 'INTERNAL',
            message: protectedResult.error ?? '无法调用系统 PowerShell 加密 Key',
          });
          return;
        }
        const protectedBase64 = protectedResult.stdout;
        try {
          const directory = path.dirname(modelKeyFile());
          mkdirSync(directory, { recursive: true });
          writeFileSync(modelKeyFile(), protectedBase64, 'utf8');
          json(res, 200, {
            ok: true,
            status: 'configured',
            restartRequired: true,
            message: 'Key 已加密保存。重启 SproutAsk 后生效；当前进程不会热加载模型凭据。',
          });
        } catch {
          json(res, 500, { ok: false, error: 'INTERNAL' });
        }
        return;
      }
      json(res, 405, { ok: false, error: 'method not allowed' });
    },
  });
  webServer.register({
    kind: 'exact',
    path: '/edu/api/live-selftest',
    async handler(req, res) {
      if (!isLoopback(req)) {
        json(res, 403, { ok: false, error: 'loopback only' });
        return;
      }
      if (req.method !== 'POST' || req.headers['x-edu-selftest'] !== '1') {
        json(res, 403, { ok: false, error: 'POST with x-edu-selftest: 1 required' });
        return;
      }
      if (!(await isAuthorized(ctx, req))) {
        json(res, 401, { ok: false, error: 'authentication required' });
        return;
      }
      const result = await composition.liveSelftest();
      json(res, result.ok ? 200 : 502, {
        ok: result.ok,
        ...(result.ok
          ? { text: result.data.text, sessionId: result.data.sessionId }
          : { error: result.error }),
      });
    },
  });

  const g1 = new G1Service(composition, workspaceRoot, {
    visionClient: () => visionClientForModel(),
    imageAvailable: () => imageModelAvailable(),
    modelName: IMAGE_MODEL,
  });
  g1Service = g1;
  webServer.register({
    kind: 'prefix',
    path: '/edu/api/g1',
    async handler(req, res) {
      if (!isLoopback(req)) {
        json(res, 403, { ok: false, error: 'loopback only' });
        return;
      }
      if (!(await isAuthorized(ctx, req))) {
        json(res, 401, { ok: false, error: 'authentication required' });
        return;
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const pathname = url.pathname;
      if (pathname === '/edu/api/g1/library' && req.method === 'GET') {
        json(res, 200, g1.library());
        return;
      }
      if (pathname === '/edu/api/g1/map' && req.method === 'GET') {
        json(res, 200, await g1.map());
        return;
      }
      if (pathname === '/edu/api/g1/sources' && req.method === 'GET') {
        json(res, 200, await g1.sourceSummaries());
        return;
      }
      if (pathname === '/edu/api/g1/source' && req.method === 'GET') {
        const sourceRefId = url.searchParams.get('sourceRefId') ?? '';
        if (sourceRefId.length === 0) {
          json(res, 400, { ok: false, error: 'sourceRefId required' });
          return;
        }
        json(res, 200, await g1.source(sourceRefId));
        return;
      }
      if (pathname === '/edu/api/g1/resume' && req.method === 'GET') {
        const sessionId = url.searchParams.get('sessionId') ?? '';
        if (sessionId.length === 0) {
          json(res, 400, { ok: false, error: 'sessionId required' });
          return;
        }
        json(res, 200, await g1.resumeSession(sessionId));
        return;
      }
      if (pathname === '/edu/api/g1/snapshot' && req.method === 'GET') {
        json(res, 200, await g1.snapshot());
        return;
      }
      if (pathname === '/edu/api/g1/home' && req.method === 'GET') {
        json(res, 200, await g1.home());
        return;
      }
      if (pathname === '/edu/api/g1/records' && req.method === 'GET') {
        json(res, 200, await g1.records());
        return;
      }
      if (pathname === '/edu/api/g1/records/export' && req.method === 'POST') {
        // 导出学习记录：先让学生（或系统）选定目标目录，再落盘。
        const body = await readBody(req);
        const targetDir =
          typeof body?.['targetDir'] === 'string' && path.isAbsolute(body['targetDir'])
            ? body['targetDir']
            : await pickExportDirectory(ctx);
        if (targetDir === null) {
          json(res, 200, {
            ok: false,
            error: { code: 'CANCELLED', message: 'export cancelled: no folder selected', retryable: true },
          });
          return;
        }
        const requestId = requestIdOf(req, 'g1.records.export');
        const exported = g1.exportRecords(requestId, targetDir);
        json(res, 200, exported);
        return;
      }
      if (pathname === '/edu/api/g1/records' && req.method === 'DELETE') {
        // 删除学习记录：先按学生要求导出备份，再删除。
        const body = await readBody(req);
        const backupDir =
          typeof body?.['backupDir'] === 'string' && path.isAbsolute(body['backupDir'])
            ? body['backupDir']
            : await pickExportDirectory(ctx);
        const requestId = requestIdOf(req, 'g1.records.delete');
        json(res, 200, g1.deleteRecords(requestId, backupDir));
        return;
      }
      if (pathname === '/edu/api/g1/image' && req.method === 'POST') {
        // Images are much larger than JSON turns; the route still rejects a
        // base64 payload above 8 MiB after parsing.
        const body = await readBody(req, 12 * 1024 * 1024);
        if (body === null || typeof body['base64'] !== 'string' || typeof body['mime'] !== 'string') {
          json(res, 400, { ok: false, error: 'base64 and mime required' });
          return;
        }
        if (Buffer.byteLength(body['base64'], 'utf8') > 8 * 1024 * 1024) {
          json(res, 400, { ok: false, error: 'image too large' });
          return;
        }
        json(
          res,
          200,
          await g1.imageQuality(requestIdOf(req, 'g1.image'), {
            base64: body['base64'],
            mime: body['mime'],
            width: typeof body['width'] === 'number' ? body['width'] : 0,
            height: typeof body['height'] === 'number' ? body['height'] : 0,
            activityId: typeof body['activityId'] === 'string' ? body['activityId'] : null,
            sessionId: typeof body['sessionId'] === 'string' ? body['sessionId'] : null,
          }),
        );
        return;
      }
      if (pathname === '/edu/api/g1/tutor/start' && req.method === 'POST') {
        const body = await readBody(req);
        if (body === null || typeof body['conceptId'] !== 'string') {
          json(res, 400, { ok: false, error: 'conceptId required' });
          return;
        }
        const requestId = requestIdOf(req, 'g1.tutor.start');
        json(
          res,
          200,
          await g1.startTutor(requestId, {
            conceptId: body['conceptId'],
            mode: body['mode'] === 'review' ? 'review' : 'learn',
            activityId: typeof body['activityId'] === 'string' ? body['activityId'] : null,
            ...(typeof body['sessionId'] === 'string' ? { sessionId: body['sessionId'] } : {}),
          }),
        );
        return;
      }
      const tutorActions: Record<string, (requestId: string, body: Record<string, unknown>) => Promise<ServiceResult<unknown>>> = {
        '/edu/api/g1/tutor/turn': (id, body) => g1.tutorTurn(id, body),
        '/edu/api/g1/tutor/skip': (id, body) => g1.tutorSkip(id, body),
        '/edu/api/g1/tutor/end': (id, body) => g1.tutorEnd(id, body),
        '/edu/api/g1/tutor/retry': (id, body) => g1.tutorRetry(id, body),
        '/edu/api/g1/tutor/finish-learning': (id, body) => g1.finishLearning(id, body),
        '/edu/api/g1/tutor/finish-review': (id, body) => g1.finishReview(id, body),
      };
      const tutorAction = tutorActions[pathname];
      if (tutorAction !== undefined && req.method === 'POST') {
        const body = await readBody(req);
        if (body === null) {
          json(res, 400, { ok: false, error: 'invalid JSON body' });
          return;
        }
        json(res, 200, await tutorAction(requestIdOf(req, 'g1.tutor'), body));
        return;
      }
      if (pathname === '/edu/api/g1/draft/clear' && req.method === 'POST') {
        const body = await readBody(req);
        if (
          body === null ||
          typeof body['conceptId'] !== 'string' ||
          typeof body['activityId'] !== 'string'
        ) {
          json(res, 400, { ok: false, error: 'conceptId and activityId required' });
          return;
        }
        json(
          res,
          200,
          await g1.clearDraft({
            conceptId: body['conceptId'],
            mode: body['mode'] === 'review' ? 'review' : 'learn',
            activityId: body['activityId'],
          }),
        );
        return;
      }
      if (pathname === '/edu/api/g1/study' && req.method === 'GET') {
        const conceptId = url.searchParams.get('conceptId');
        if (conceptId === null) {
          json(res, 400, { ok: false, error: 'conceptId required' });
          return;
        }
        json(res, 200, await g1.study(conceptId, url.searchParams.get('activityId')));
        return;
      }
      if (pathname === '/edu/api/g1/progress' && req.method === 'GET') {
        const conceptId = url.searchParams.get('conceptId');
        if (conceptId === null) {
          json(res, 400, { ok: false, error: 'conceptId required' });
          return;
        }
        json(res, 200, await g1.progress(conceptId));
        return;
      }
      if (pathname === '/edu/api/g1/draft' && req.method === 'GET') {
        const conceptId = url.searchParams.get('conceptId');
        const mode = url.searchParams.get('mode');
        const activityId = url.searchParams.get('activityId');
        if (conceptId === null || mode === null || activityId === null) {
          json(res, 400, { ok: false, error: 'conceptId, mode and activityId required' });
          return;
        }
        json(
          res,
          200,
          await g1.loadDraft({
            conceptId,
            mode: mode === 'review' ? 'review' : 'learn',
            activityId,
          }),
        );
        return;
      }
      if (pathname === '/edu/api/g1/draft' && req.method === 'POST') {
        const body = await readBody(req);
        if (body === null) {
          json(res, 400, { ok: false, error: 'invalid JSON body' });
          return;
        }
        const requestId =
          typeof req.headers['x-edu-request-id'] === 'string'
            ? req.headers['x-edu-request-id']
            : `g1.draft.${Date.now()}`;
        json(res, 200, await g1.saveDraft(body as never, requestId));
        return;
      }
      if (pathname === '/edu/api/g1/self-report' && req.method === 'POST') {
        const body = await readBody(req);
        if (body === null) {
          json(res, 400, { ok: false, error: 'invalid JSON body' });
          return;
        }
        const requestId =
          typeof req.headers['x-edu-request-id'] === 'string'
            ? req.headers['x-edu-request-id']
            : `g1.self-report.${Date.now()}`;
        const conceptId = typeof body['conceptId'] === 'string' ? body['conceptId'] : '';
        const claimedState = body['claimedState'];
        if (
          conceptId.length === 0 ||
          (claimedState !== 'uncertain' &&
            claimedState !== 'basically_understood' &&
            claimedState !== 'can_explain')
        ) {
          json(res, 400, { ok: false, error: 'conceptId and claimedState required' });
          return;
        }
        json(res, 200, await g1.saveSelfReport(conceptId, claimedState, requestId));
        return;
      }
      json(res, 404, { ok: false, error: 'unknown G1 endpoint' });
    },
  });
  log({ event: 'route.registered', routes: ['/edu/api/status', '/edu/api/live-selftest', '/edu/api/g1/*'] });
}

export async function apply(ctx: HostContextLike): Promise<void> {
  const compositionResult = await compositionFor(ctx);
  if (!compositionResult.ok) {
    log({ event: 'composition.failed', error: compositionResult.error });
    throw new Error(`education composition failed: ${compositionResult.error.message}`);
  }
  const composition = compositionResult.data;
  registerTools(ctx, composition);
  registerRoutes(ctx, composition);
  log({
    event: 'plugin.ready',
    status: composition.status,
    blockers: composition.blockers,
    tools: composition.tools.names,
    pack: composition.packKey,
    authKeyPresent: (process.env['DEEPSEEK_API_KEY'] ?? '').length > 0,
  });
  ctx.effect?.(() => {
    log({ event: 'plugin.disposed' });
  }, 'edu: education host plugin');
}

/** Exported for diagnostics/tests; the plugin entry is `apply`. */
export function readRuntimeLock(): { version?: string; tarballSha256?: string } {
  try {
    const lock = JSON.parse(
      readFileSync(path.join(workspaceRoot, '..', 'docs', 'rebuild', 'runtime-lock.json'), 'utf8'),
    ) as { source?: { version?: string; tarballSha256?: string } };
    return { version: lock.source?.version, tarballSha256: lock.source?.tarballSha256 };
  } catch {
    return {};
  }
}

