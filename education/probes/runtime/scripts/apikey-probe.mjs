/**
 * T00 addendum — Direct DeepSeek API-key capability probe (no key ever printed).
 *
 * Usage: node scripts/apikey-probe.mjs --key-file <path> --out <evidence dir> [--model <id>]
 *
 * Requests (default three, two of which are billable):
 *   1. GET  /models           catalog only, no model tokens
 *   2. POST /chat/completions  minimal text turn (max_tokens small)
 *   3. POST /chat/completions  minimal image_url turn (capability/error matrix only)
 *
 * Every response body is written to <out>/; the OK/error summary is sanitized so the
 * credential can never appear in a log, report or screenshot.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const keyFile = arg('key-file');
const out = arg('out');
const modelOverride = arg('model');
if (!keyFile || !out) {
  console.error('usage: apikey-probe.mjs --key-file <path> --out <dir> [--model <id>]');
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const key = readFileSync(keyFile, 'utf8').replace(/^\uFEFF/, '').trim();
if (key.length < 20) {
  console.error('credential file does not look like an API key (too short)');
  process.exit(2);
}
const sanitize = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.split(key).join('***');
};
const summary = {
  generatedAt: new Date().toISOString(),
  credential: { present: true, length: key.length, prefixShape: 'sk-***' },
  requests: [],
};

const BASE = 'https://api.deepseek.com';
const TIMEOUT_MS = 45000;

async function call(label, path, init) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let status = null;
  let headers = {};
  let bodyText = '';
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    status = response.status;
    headers = Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie'));
    bodyText = await response.text();
  } catch (error) {
    bodyText = `TRANSPORT_ERROR: ${error?.name ?? 'Error'}: ${error?.message ?? ''}`;
  } finally {
    clearTimeout(timer);
  }
  const durationMs = Date.now() - started;
  const safeText = sanitize(bodyText);
  writeFileSync(join(out, `${label}.response.txt`), safeText, 'utf8');
  let parsed = null;
  try {
    parsed = JSON.parse(safeText);
  } catch {
    /* non-JSON error body stays as text */
  }
  const record = {
    label,
    method: init?.method ?? 'GET',
    path,
    status,
    durationMs,
    error: parsed?.error ?? null,
    bodyKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : [],
  };
  summary.requests.push(record);
  return { record, parsed, safeText, headers };
}

// 1. catalog (no model tokens billed)
const models = await call('01-models', '/models', { method: 'GET' });
const modelIds = Array.isArray(models.parsed?.data) ? models.parsed.data.map((entry) => entry.id) : [];
summary.catalog = { status: models.record.status, models: modelIds };

const model = modelOverride ?? (modelIds.includes('deepseek-chat') ? 'deepseek-chat' : modelIds[0]);

// 2. minimal text turn
const textCall = await call('02-chat-text', '/chat/completions', {
  method: 'POST',
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    max_tokens: 8,
    stream: false,
  }),
});
summary.textRoute = {
  model,
  status: textCall.record.status,
  durationMs: textCall.record.durationMs,
  usage: textCall.parsed?.usage ?? null,
  finishReason: textCall.parsed?.choices?.[0]?.finish_reason ?? null,
  replyShape:
    typeof textCall.parsed?.choices?.[0]?.message?.content === 'string'
      ? `len=${textCall.parsed.choices[0].message.content.length}`
      : null,
  error: textCall.record.error,
};

// 3. image capability / error matrix only (1x1 PNG data URI)
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const imageCall = await call('03-chat-image', '/chat/completions', {
  method: 'POST',
  body: JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'One word: what color is this pixel?' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${PIXEL_PNG}` } },
        ],
      },
    ],
    max_tokens: 8,
    stream: false,
  }),
});
summary.imageRoute = {
  model,
  status: imageCall.record.status,
  durationMs: imageCall.record.durationMs,
  usage: imageCall.parsed?.usage ?? null,
  error: imageCall.record.error,
  judgment:
    imageCall.record.status === 200
      ? 'supported (accepted image_url content; effect quality NOT assessed here)'
      : imageCall.record.status === 400 || imageCall.record.status === 422
        ? 'unsupported-by-this-route (request rejected; see recorded error body)'
        : 'error (see recorded status/body)',
};

writeFileSync(join(out, 'apikey-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify({
    catalogStatus: summary.catalog.status,
    models: summary.catalog.models,
    textStatus: summary.textRoute.status,
    textUsage: summary.textRoute.usage,
    imageStatus: summary.imageRoute.status,
    imageJudgment: summary.imageRoute.judgment,
    credentialLength: summary.credential.length,
  }),
);
