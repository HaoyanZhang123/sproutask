/**
 * T15 helper: minimal authenticated client for the isolated education web host.
 *
 * The host is started by runtime/scripts/start-education-web.mjs (real DSH web,
 * real education composition, API key injected by that script only). This module
 * performs the token→cookie exchange and JSON calls; it never sees a credential.
 */
import { readFileSync } from 'node:fs';

export async function openEducationHost(meta) {
  const base = new URL(meta.url);
  const tokenUrl = meta.url;
  const origin = `${base.protocol}//${base.host}`;

  // token exchange: 303 + signed HttpOnly cookie
  const exchange = await fetch(tokenUrl, { redirect: 'manual' });
  const cookies = exchange.headers.getSetCookie?.() ?? [];
  const cookieHeader = cookies.map((entry) => entry.split(';')[0]).join('; ');
  if (exchange.status !== 303 || cookieHeader.length === 0) {
    throw new Error(`token exchange failed: status=${exchange.status} cookies=${cookies.length}`);
  }

  const call = async (path, init = {}) => {
    const started = Date.now();
    const response = await fetch(`${origin}${path}`, {
      ...init,
      headers: { cookie: cookieHeader, 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { status: response.status, json, text, durationMs: Date.now() - started };
  };

  return {
    origin,
    cookiePresent: true,
    call,
    get: (path) => call(path, { method: 'GET' }),
    post: (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) }),
  };
}

/** Read the runtime audit log written by the education host plugin (JSONL). */
export function readAudit(path) {
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function hashText(value) {
  // stable, dependency-free digest for evidence correlation (not a security hash)
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 + code, 2654435761);
  }
  const part = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return `${part(h1)}${part(h2)}`;
}
