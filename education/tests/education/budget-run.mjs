/**
 * T15 supplementary-budget verification — real product route driver.
 *
 * Boots the *installed* product (payload in %LOCALAPPDATA%\SproutAsk\current)
 * with an isolated SPROUTASK_DATA_ROOT, performs the token→cookie exchange and
 * runs one phase against the real /edu/api/g1/* routes.
 *
 * Phases:
 *   auth    — store the model key through the product endpoint (key is read from
 *             a file into memory only; it is never printed or written to evidence)
 *   review  — A20 quality-gate samples + A14 review session (recall → finish-review)
 *   anchors — restart check (review persisted) + 4 teaching scenarios + 1 chapter sample
 *
 * The API key file is only read in the auth phase. Everything else relies on the
 * launcher reading the DPAPI blob from the isolated data root.
 *
 * Usage:
 *   node education/tests/education/budget-run.mjs --phase auth|review|anchors \
 *     --evidence <dir> [--max-calls 12] [--key-file <path>]
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const INSTALL = path.join(process.env['LOCALAPPDATA'] ?? 'C:\\Users\\Public\\AppData\\Local', 'SproutAsk', 'current');
let bootChild = null;
const INSTALL_NODE = path.join(INSTALL, 'node', 'node.exe');
const START_SCRIPT = path.join(INSTALL, 'app', 'runtime', 'scripts', 'start-student-web.mjs');
const SETUP_SCRIPT = path.join(INSTALL, 'app', 'runtime', 'scripts', 'setup-education-home.mjs');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function iso() {
  return new Date().toISOString();
}

/** Count real model calls from the runtime audit log (assistant messages + tool turns). */
function countCalls(logFile) {
  if (!existsSync(logFile)) return { assistant: 0, toolCalls: 0, idleEvents: 0, lines: 0 };
  const rows = readFileSync(logFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  let assistant = 0;
  let toolCalls = 0;
  let idleEvents = 0;
  for (const row of rows) {
    if (row.event === 'tool.call') toolCalls += 1;
    const payload = row.payload;
    if (payload && payload.kind === 'dsh.debug' && payload.event === 'dsh.idle') {
      idleEvents += 1;
      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      assistant += roles.filter((role) => role === 'assistant').length;
    }
  }
  return { assistant, toolCalls, idleEvents, lines: rows.length };
}

function ensureProfile(dshHome) {
  const profile = path.join(dshHome, 'profiles', 'edu-web', 'package.json');
  if (existsSync(profile)) return { created: false };
  mkdirSync(dshHome, { recursive: true });
  const run = spawnSync(INSTALL_NODE, [SETUP_SCRIPT, '--home', dshHome], { encoding: 'utf8' });
  return { created: true, status: run.status, stderrTail: (run.stderr ?? '').slice(-600) };
}

function tokenFromStdout(stdoutFile) {
  if (!existsSync(stdoutFile)) return null;
  const match = /token=([A-Za-z0-9_\-]+)/u.exec(readFileSync(stdoutFile, 'utf8'));
  return match === null ? null : match[1];
}

async function boot({ dataRoot, logsDir, timeoutMs = 180000 }) {
  mkdirSync(logsDir, { recursive: true });
  const dshHome = path.join(dataRoot, 'dsh-home');
  const profile = ensureProfile(dshHome);
  const metaFile = path.join(logsDir, 'launch-meta.json');
  // A stale meta from an earlier phase would point at a dead port; always start clean.
  for (const stale of [metaFile, path.join(logsDir, 'stdout.log'), path.join(logsDir, 'stderr.log')]) {
    try {
      rmSync(stale, { force: true });
    } catch {
      /* ignore */
    }
  }
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/^(DSH_|DEEPSEEK_|ANTHROPIC_|OPENAI_)/i.test(name)) delete env[name];
  }
  env.SPROUTASK_DATA_ROOT = dataRoot;
  env.EDU_DATA_ROOT = path.join(dataRoot, 'learner-data');
  env.DSH_DISABLE_UPDATE_CHECK = '1';
  env.DSH_TELEMETRY_DISABLED = '1';
  const child = spawn(INSTALL_NODE, [START_SCRIPT, '--home', dshHome, '--out', logsDir, '--no-edge'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  bootChild = child;
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });
  const startedAt = Date.now();
  let port = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(metaFile)) {
      try {
        const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
        port = meta.port ?? null;
      } catch {
        /* still being written */
      }
      if (port !== null) break;
    }
    if (child.exitCode !== null) break;
    await sleep(300);
  }
  if (port === null) {
    const tail = `${stdout}\n${stderr}`.trim().slice(-1500);
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    throw new Error(`app did not report a port (exit=${child.exitCode}): ${tail}`);
  }
  const token = tokenFromStdout(path.join(logsDir, 'stdout.log'));
  if (token === null) {
    try {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
    throw new Error('no token in stdout.log');
  }
  const url = `http://127.0.0.1:${port}/?token=${token}`;
  let cookieHeader = '';
  let exchangeStatus = null;
  let exchangeError = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const exchange = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      exchangeStatus = exchange.status;
      const cookies = exchange.headers.getSetCookie?.() ?? [];
      cookieHeader = cookies.map((entry) => entry.split(';')[0]).join('; ');
      exchangeError = null;
      if (cookieHeader.length > 0) break;
    } catch (error) {
      exchangeError = error instanceof Error ? error.message : String(error);
    }
    await sleep(400);
  }
  const origin = `http://127.0.0.1:${port}`;
  const call = async (route, init = {}) => {
    const startedRequest = Date.now();
    const response = await fetch(`${origin}${route}`, {
      ...init,
      headers: { cookie: cookieHeader, 'content-type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(300000),
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { status: response.status, json, text, durationMs: Date.now() - startedRequest };
  };
  return {
    child,
    port,
    origin,
    logsDir,
    dataRoot,
    cookiePresent: cookieHeader.length > 0,
    exchangeStatus,
    exchangeError,
    profile,
    get: (route) => call(route, { method: 'GET' }),
    post: (route, body) => call(route, { method: 'POST', body: JSON.stringify(body) }),
    stop: async () => {
      try {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        try {
          const probe = await fetch(`${origin}/edu/api/status`, { signal: AbortSignal.timeout(1500) });
          await probe.text();
        } catch {
          return true;
        }
        await sleep(300);
      }
      return false;
    },
  };
}

/* --------------------------------------------------------------- A20 / A14 */

const GATE_ACTIVITY = 'activity.bio7a.c1.choice-basics';
// F7 grading needs an activity whose expected answer is the fixture's answer
// (细胞核), so the correct/wrong samples can be judged deterministically.
const IMAGE_ACTIVITY = 'activity.bio7a.u1ch2s4.cell-nucleus.basic';

function fixturesDir() {
  return path.join(
    path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1')), '..', '..'),
    'packages',
    'visuals',
    'test',
    'fixtures',
    'images',
  );
}

function fixtureBody(file, activityId = GATE_ACTIVITY) {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    base64: bytes.toString('base64'),
    mime: 'image/png',
    width: view.getUint32(16),
    height: view.getUint32(20),
    activityId,
  };
}

async function phaseAuth(app, evidence, dir) {
  const before = await app.get('/edu/api/auth/key');
  const result = { at: iso(), phase: 'auth', before: before.json, post: null, after: null };
  if (before.json?.status === 'configured') {
    result.note = 'a key is already configured in this isolated data root; nothing to do';
    return result;
  }
  const keyFile = path.resolve(String(evidence['key-file'] ?? path.join('education', '.local', 'secrets', 'deepseek.key')));
  if (!existsSync(keyFile)) {
    result.error = 'key file missing';
    return result;
  }
  const apiKey = readFileSync(keyFile, 'utf8').trim();
  const post = await app.post('/edu/api/auth/key', { apiKey });
  result.post = { status: post.status, json: post.json, durationMs: post.durationMs };
  const after = await app.get('/edu/api/auth/key');
  result.after = after.json;
  result.keyLength = apiKey.length;
  result.keyValueStored = false;
  return result;
}

async function phaseReview(app, evidence, dir) {
  const logFile = path.join(app.logsDir, 'runtime.jsonl');
  const out = { at: iso(), phase: 'review', status: null, gate: [], review: {}, calls: {} };

  const status = await app.get('/edu/api/status');
  out.status = {
    httpStatus: status.status,
    auth: status.json?.auth ?? null,
    pack: status.json?.pack ?? null,
    serviceStatus: status.json?.status ?? null,
    dtoTrustMode: status.json?.dto?.trustMode ?? null,
    fixtureData: status.json?.dto?.fixtureData ?? null,
    conceptCount: status.json?.dto?.library?.concepts?.length ?? status.json?.dto?.conceptCount ?? null,
  };

  /* A20: product image route, quality gate only. */
  const dirImages = fixturesDir();
  const gateSamples = [
    ['01-clear-correct', '01-clear-correct.png'],
    ['02-clear-wrong', '02-clear-wrong.png'],
    ['03-rotated-blurred', '03-rotated-blurred.png'],
    ['04-blank', '04-blank.png'],
  ];
  for (const [name, file] of gateSamples) {
    const before = countCalls(logFile);
    const response = await app.post('/edu/api/g1/image', fixtureBody(path.join(dirImages, file)));
    const after = countCalls(logFile);
    const record = {
      name,
      status: response.status,
      durationMs: response.durationMs,
      ok: response.json?.ok ?? null,
      stage: response.json?.data?.stage ?? null,
      modelCalled: response.json?.data?.modelCalled ?? null,
      modelWouldBeCalled: response.json?.data?.modelWouldBeCalled ?? null,
      requiresClarification: response.json?.data?.requiresClarification ?? null,
      qualityStatus: response.json?.data?.qualitySignal?.status ?? null,
      qualityReasons: response.json?.data?.qualitySignal?.reasons ?? null,
      metrics: response.json?.data?.qualitySignal?.metrics ?? null,
      modelCallsDelta: after.assistant - before.assistant,
    };
    out.gate.push(record);
    writeFileSync(
      path.join(dir, `a20-route-${name}.json`),
      `${JSON.stringify({ request: { mime: 'image/png', width: record.metrics?.width, height: record.metrics?.height, activityId: GATE_ACTIVITY, bytes: null }, response: response.json, durationMs: response.durationMs }, null, 2)}\n`,
      'utf8',
    );
  }

  /* A14: review session with a recall attempt, then finish-review. */
  const conceptId = 'concept.bio7a.observation.meaning';
  const startBefore = countCalls(logFile);
  const start = await app.post('/edu/api/g1/tutor/start', {
    requestId: `budget-review-start-${Date.now()}`,
    conceptId,
    mode: 'review',
    activityId: 'activity.bio7a.c1.choice-basics',
  });
  const startAfter = countCalls(logFile);
  const sessionId = start.json?.data?.session?.id ?? null;
  let revision = start.json?.data?.state?.revision ?? 0;
  out.review.start = {
    status: start.status,
    durationMs: start.durationMs,
    ok: start.json?.ok ?? null,
    sessionId,
    mode: start.json?.data?.session?.mode ?? null,
    revision,
    model: start.json?.data?.model ?? null,
    gateway: start.json?.data?.gateway ?? null,
    message: start.json?.data?.message ?? null,
    modelCallsDelta: startAfter.assistant - startBefore.assistant,
  };

  if (sessionId !== null) {
    const turnBefore = countCalls(logFile);
    const turn = await app.post('/edu/api/g1/tutor/turn', {
      requestId: `budget-review-turn-${Date.now()}`,
      sessionId,
      revision,
      message: '我先自己回忆一下：观察就是……好像是用眼睛看吧，看到什么就记什么。',
      attempt: {
        activityId: 'activity.bio7a.c1.choice-basics',
        inputType: 'choice',
        answerText: JSON.stringify(['option.a']),
      },
    });
    const turnAfter = countCalls(logFile);
    revision = turn.json?.data?.state?.revision ?? turn.json?.data?.revision ?? revision;
    out.review.recallTurn = {
      status: turn.status,
      durationMs: turn.durationMs,
      ok: turn.json?.ok ?? null,
      code: turn.json?.error?.code ?? null,
      errorMessage: turn.json?.error?.message ?? null,
      message: turn.json?.data?.message ?? null,
      decision: turn.json?.data?.decision ?? null,
      gateway: turn.json?.data?.gateway ?? null,
      model: turn.json?.data?.model ?? null,
      sourceCitation: turn.json?.data?.sourceCitation ?? null,
      revision,
      modelCallsDelta: turnAfter.assistant - turnBefore.assistant,
    };
    writeFileSync(
      path.join(dir, 'a14-recall-turn.json'),
      `${JSON.stringify(turn.json, null, 2)}\n`,
      'utf8',
    );

    /* finish-review: terminal action; the product accepts a non-future revision. */
    const finishBefore = countCalls(logFile);
    const candidates = [...new Set([revision, revision - 1, 0].filter((value) => Number.isInteger(value) && value >= 0))];
    out.review.finishAttempts = [];
    let finish = null;
    for (const candidate of candidates) {
      const attempt = await app.post('/edu/api/g1/tutor/finish-review', {
        requestId: `budget-review-finish-${candidate}-${Date.now()}`,
        sessionId,
        revision: candidate,
        outcome: 'needs_support',
      });
      out.review.finishAttempts.push({
        revision: candidate,
        status: attempt.status,
        ok: attempt.json?.ok ?? null,
        code: attempt.json?.error?.code ?? null,
        message: attempt.json?.error?.message ?? null,
        durationMs: attempt.durationMs,
      });
      if (attempt.json?.ok === true) {
        finish = { attempt, candidate };
        break;
      }
    }
    if (finish === null) {
      /* last resort: let the product decide the outcome (no explicit outcome) */
      const attempt = await app.post('/edu/api/g1/tutor/finish-review', {
        requestId: `budget-review-finish-default-${Date.now()}`,
        sessionId,
        revision,
      });
      out.review.finishAttempts.push({
        revision,
        status: attempt.status,
        ok: attempt.json?.ok ?? null,
        code: attempt.json?.error?.code ?? null,
        message: attempt.json?.error?.message ?? null,
        durationMs: attempt.durationMs,
        note: 'no explicit outcome',
      });
      if (attempt.json?.ok === true) finish = { attempt, candidate: revision };
    }
    const finishAfter = countCalls(logFile);
    out.review.finish = {
      ok: finish !== null,
      revisionUsed: finish?.candidate ?? null,
      status: finish?.attempt.status ?? null,
      data: finish?.attempt.json?.data ?? null,
      modelCallsDelta: finishAfter.assistant - finishBefore.assistant,
    };
    writeFileSync(
      path.join(dir, 'a14-finish-review.json'),
      `${JSON.stringify({ sessionId, revisionAtFinish: revision, attempts: out.review.finishAttempts, data: out.review.finish.data }, null, 2)}\n`,
      'utf8',
    );

    const records = await app.get('/edu/api/g1/records');
    const progresses = records.json?.data?.progresses ?? [];
    const entry = progresses.find((item) => item.conceptId === conceptId) ?? null;
    out.review.records = {
      status: records.status,
      conceptProgress: entry,
      sessions: (records.json?.data?.sessions ?? []).map((session) => ({
        id: session.id,
        mode: session.mode,
        status: session.status,
        conceptId: session.conceptId,
        endedAt: session.endedAt ?? null,
      })),
      evidenceCount: (records.json?.data?.evidence ?? []).length,
      assessmentCount: (records.json?.data?.assessments ?? []).length,
    };
    writeFileSync(
      path.join(dir, 'a14-records-before-restart.json'),
      `${JSON.stringify(records.json, null, 2)}\n`,
      'utf8',
    );

    const progress = await app.get(`/edu/api/g1/progress?conceptId=${encodeURIComponent(conceptId)}`);
    out.review.progressAfterFinish = {
      status: progress.status,
      understanding: progress.json?.data?.progress?.understanding ?? progress.json?.data?.understanding ?? null,
      review: progress.json?.data?.progress?.review ?? progress.json?.data?.review ?? null,
    };
    writeFileSync(
      path.join(dir, 'a14-progress-after-finish.json'),
      `${JSON.stringify(progress.json, null, 2)}\n`,
      'utf8',
    );
  }

  out.calls.afterPhase = countCalls(logFile);
  return out;
}

/* ------------------------------------------------------------- anchors */

const SCENARIOS = [
  {
    id: 'S1-core-misconception',
    kind: '核心误解',
    conceptId: 'concept.bio7a.observation.meaning',
    message: '我觉得观察就是随便看一眼，看到什么就记什么，不用有目的也没关系。',
  },
  {
    id: 'S2-full-explanation',
    kind: '请求完整解释',
    conceptId: 'concept.bio7a.u1ch3s1.cell-division-chromosome',
    message: '细胞分裂的时候染色体到底怎么变化？请从头到尾完整讲一遍，不要反问让我自己猜。',
  },
  {
    id: 'S3-answer-only',
    kind: '只要答案',
    conceptId: 'concept.bio7a.u1ch2s2.plant-cell-structure',
    message: '别讲过程了，直接告诉我植物细胞有哪些结构，我只要答案。',
  },
  {
    id: 'S4-cross-chapter',
    kind: '跨章迁移',
    conceptId: 'concept.bio7a.observation.comparison',
    message: '观察这一章学到的东西，和后面学的细胞结构有什么关系？跨章节讲讲。',
  },
  {
    id: 'S5-chapter-sample',
    kind: '章节抽样（u2.ch3 微生物）',
    conceptId: 'concept.bio7a.u2ch3s2.bacteria',
    message: '细菌和真菌在结构上最主要的区别是什么？',
  },
];

function analyzeMessage(message, decision, sourceCitation) {
  const text = typeof message === 'string' ? message : '';
  const sourceIds = [...new Set((text.match(/source\.[A-Za-z0-9._-]+/gu) ?? []))];
  const pdfPages = [...new Set([...text.matchAll(/PDF\s*第?\s*(\d+)\s*页?/gu)].map((match) => Number(match[1])))];
  const printedPages = [...new Set([...text.matchAll(/印刷(?:页)?\s*第?\s*(\d+)\s*页?/gu)].map((match) => Number(match[1])))];
  const decisionRefs = Array.isArray(decision?.sourceRefs) ? decision.sourceRefs : [];
  const citationRefs = Array.isArray(sourceCitation?.refs) ? sourceCitation.refs : [];
  return {
    chars: text.length,
    sourceIdsInText: sourceIds,
    pdfPagesInText: pdfPages,
    printedPagesInText: printedPages,
    decisionSourceRefs: decisionRefs,
    citationRefs,
    citationMissing: sourceCitation?.missing ?? null,
    citationRequired: sourceCitation?.required ?? null,
    hasSourceAnchor: sourceIds.length > 0 || decisionRefs.length > 0 || citationRefs.length > 0,
    hasPageAnchor: pdfPages.length > 0 || printedPages.length > 0,
    action: decision?.action ?? null,
    difficulty: decision?.difficulty ?? null,
    disclosure: decision?.disclosure ?? null,
    reviewStage: decision?.reviewStage ?? null,
  };
}

async function phaseAnchors(app, evidence, dir) {
  const logFile = path.join(app.logsDir, 'runtime.jsonl');
  const maxCalls = Number.parseInt(String(evidence['max-calls'] ?? '12'), 10);
  const headroom = Number.parseInt(String(evidence['headroom'] ?? '4'), 10);
  const wanted = typeof evidence.scenarios === 'string' && evidence.scenarios.length > 0
    ? evidence.scenarios.split(',').map((value) => value.trim()).filter(Boolean)
    : null;
  const scenarios = wanted === null ? SCENARIOS : SCENARIOS.filter((entry) => wanted.includes(entry.id));
  const out = { at: iso(), phase: 'anchors', scenarios: scenarios.map((entry) => entry.id), maxCalls, headroom, restartCheck: {}, status: null, turns: [], calls: {} };

  const status = await app.get('/edu/api/status');
  out.status = {
    status: status.status,
    auth: status.json?.auth ?? null,
    pack: status.json?.pack ?? null,
    dtoTrustMode: status.json?.dto?.trustMode ?? null,
  };
  const records = await app.get('/edu/api/g1/records');
  const conceptId = 'concept.bio7a.observation.meaning';
  const entry = (records.json?.data?.progresses ?? []).find((item) => item.conceptId === conceptId) ?? null;
  out.restartCheck = {
    status: records.status,
    conceptProgress: entry,
    sessions: (records.json?.data?.sessions ?? []).map((session) => ({
      id: session.id,
      mode: session.mode,
      status: session.status,
      conceptId: session.conceptId,
      endedAt: session.endedAt ?? null,
    })),
  };
  writeFileSync(
    path.join(dir, 'a14-records-after-restart.json'),
    `${JSON.stringify(records.json, null, 2)}\n`,
    'utf8',
  );

  const base = countCalls(logFile);
  out.calls.baselineAssistant = base.assistant;

  for (const scenario of scenarios) {
    const current = countCalls(logFile);
    if (current.assistant - base.assistant + headroom > maxCalls) {
      out.turns.push({ id: scenario.id, kind: scenario.kind, skipped: 'call cap headroom reached', usedSoFar: current.assistant - base.assistant });
      continue;
    }
    const start = await app.post('/edu/api/g1/tutor/start', {
      requestId: `budget-anchor-start-${scenario.id}-${Date.now()}`,
      conceptId: scenario.conceptId,
      mode: 'learn',
    });
    const sessionId = start.json?.data?.session?.id ?? null;
    const revision = start.json?.data?.state?.revision ?? 0;
    if (sessionId === null) {
      out.turns.push({ id: scenario.id, kind: scenario.kind, startStatus: start.status, startError: start.json, skipped: 'no session' });
      continue;
    }
    const before = countCalls(logFile);
    const turn = await app.post('/edu/api/g1/tutor/turn', {
      requestId: `budget-anchor-turn-${scenario.id}-${Date.now()}`,
      sessionId,
      revision,
      message: scenario.message,
    });
    const after = countCalls(logFile);
    const message = turn.json?.data?.message ?? null;
    const decision = turn.json?.data?.decision ?? null;
    const citation = turn.json?.data?.sourceCitation ?? null;
    const anchors = analyzeMessage(message, decision, citation);
    out.turns.push({
      id: scenario.id,
      kind: scenario.kind,
      conceptId: scenario.conceptId,
      startStatus: start.status,
      turnStatus: turn.status,
      durationMs: turn.durationMs,
      ok: turn.json?.ok ?? null,
      code: turn.json?.error?.code ?? null,
      errorMessage: turn.json?.error?.message ?? null,
      gateway: turn.json?.data?.gateway ?? null,
      model: turn.json?.data?.model ?? null,
      fallbackLocal: turn.json?.data?.gateway === 'local',
      message,
      decision,
      anchors,
      toolResults: (turn.json?.data?.toolResults ?? []).map((entry) => ({
        name: entry.name ?? entry.tool ?? null,
        ok: entry.ok ?? null,
      })),
      modelCallsDelta: after.assistant - before.assistant,
      toolCallsDelta: after.toolCalls - before.toolCalls,
      assistantTotalAfter: after.assistant,
    });
    writeFileSync(
      path.join(dir, `anchor-${scenario.id}.json`),
      `${JSON.stringify({ scenario, request: { sessionId, revision }, response: turn.json, durationMs: turn.durationMs }, null, 2)}\n`,
      'utf8',
    );
  }

  out.calls.afterPhase = countCalls(logFile);
  out.calls.turnCallsConsumed = out.calls.afterPhase.assistant - out.calls.baselineAssistant;
  out.maxCalls = maxCalls;
  return out;
}

/* ------------------------------------------------------------- probe */

/**
 * F5 diagnosis (0 model calls): `start` only binds a DSH agent, so a failed
 * start costs nothing. We try the same concept/mode twice — once with an
 * explicit fresh session id, once with the auto id — to test the hypothesis
 * that the in-memory session counter restarts after a boot and collides with a
 * DSH session that already exists in the persisted home.
 */
async function phaseProbe(app, evidence, dir) {
  const logFile = path.join(app.logsDir, 'runtime.jsonl');
  const out = { at: iso(), phase: 'probe', attempts: [], calls: {} };
  const before = countCalls(logFile);
  const conceptId = 'concept.bio7a.observation.meaning';

  const explicit = await app.post('/edu/api/g1/tutor/start', {
    requestId: `probe-explicit-${Date.now()}`,
    conceptId,
    mode: 'learn',
    sessionId: `session.budget.probe.${Date.now()}`,
  });
  out.attempts.push({
    kind: 'explicit-fresh-sessionId',
    status: explicit.status,
    ok: explicit.json?.ok ?? null,
    code: explicit.json?.error?.code ?? null,
    message: explicit.json?.error?.message ?? null,
    sessionId: explicit.json?.data?.session?.id ?? null,
    durationMs: explicit.durationMs,
  });

  const auto = await app.post('/edu/api/g1/tutor/start', {
    requestId: `probe-auto-${Date.now()}`,
    conceptId,
    mode: 'learn',
  });
  out.attempts.push({
    kind: 'auto-sessionId',
    status: auto.status,
    ok: auto.json?.ok ?? null,
    code: auto.json?.error?.code ?? null,
    message: auto.json?.error?.message ?? null,
    sessionId: auto.json?.data?.session?.id ?? null,
    durationMs: auto.durationMs,
  });

  const auto2 = await app.post('/edu/api/g1/tutor/start', {
    requestId: `probe-auto2-${Date.now()}`,
    conceptId,
    mode: 'learn',
  });
  out.attempts.push({
    kind: 'auto-sessionId-again',
    status: auto2.status,
    ok: auto2.json?.ok ?? null,
    code: auto2.json?.error?.code ?? null,
    message: auto2.json?.error?.message ?? null,
    sessionId: auto2.json?.data?.session?.id ?? null,
    durationMs: auto2.durationMs,
  });

  const after = countCalls(logFile);
  out.calls = { assistantDelta: after.assistant - before.assistant, after };
  return out;
}

/* ------------------------------------------------------------------ F7 */

/**
 * A20 / F7: the product image route must now *grade* with `evaluateImageAnswer`
 * after the independent quality gate. 01 → graded correct, 02 → graded wrong,
 * 04 → clarification, 03 → gate short-circuit with zero model calls.
 * Image model calls never touch the DSH audit log, so they are counted from the
 * response (`modelCalled`/`modelRunId`).
 */
async function phaseF7(app, evidence, dir) {
  const out = { at: iso(), phase: 'f7', activityId: IMAGE_ACTIVITY, status: null, samples: [], calls: {} };
  const status = await app.get('/edu/api/status');
  out.status = {
    auth: status.json?.auth ?? null,
    pack: status.json?.pack ?? null,
    dtoTrustMode: status.json?.dto?.trustMode ?? null,
    fixtureData: status.json?.dto?.fixtureData ?? null,
  };

  const imageDir = fixturesDir();
  const samples = [
    ['01-clear-correct', '01-clear-correct.png', 'graded_correct'],
    ['02-clear-wrong', '02-clear-wrong.png', 'graded_wrong'],
    ['03-rotated-blurred', '03-rotated-blurred.png', 'gate_short_circuit'],
    ['04-blank', '04-blank.png', 'clarification'],
  ];
  let imageModelCalls = 0;

  for (const [name, file, expectation] of samples) {
    const body = fixtureBody(path.join(imageDir, file), IMAGE_ACTIVITY);
    const bytes = Buffer.from(body.base64, 'base64');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const response = await app.post('/edu/api/g1/image', body);
    const data = response.json?.data ?? null;
    const modelCalled = data?.modelCalled === true || typeof data?.modelRunId === 'string';
    if (modelCalled) imageModelCalls += 1;
    const grade = data?.grade ?? null;
    const recognition = data?.recognition ?? null;
    const gate = data?.gate ?? null;
    const criteria = Array.isArray(grade?.criteria) ? grade.criteria : null;

    const record = {
      name,
      expectation,
      httpStatus: response.status,
      durationMs: response.durationMs,
      ok: response.json?.ok ?? null,
      error: response.json?.error ?? null,
      stage: data?.stage ?? null,
      modelCalled: data?.modelCalled ?? null,
      modelRunId: data?.modelRunId ?? null,
      model: data?.model ?? null,
      modelLatencyMs: data?.modelLatencyMs ?? null,
      activityId: data?.activityId ?? null,
      expectedAnswer: data?.expectedAnswer ?? null,
      expectedAnswerSource: data?.expectedAnswerSource ?? null,
      recognition,
      matchesExpected: recognition?.matchesExpected ?? null,
      uncertainty: recognition?.uncertainty ?? null,
      requiresClarification: data?.requiresClarification ?? null,
      clarification: data?.clarification ?? null,
      criteria,
      feedback: grade?.feedback ?? null,
      graderVersion: grade?.graderVersion ?? null,
      evidenceCandidateCount: Array.isArray(data?.evidenceCandidates) ? data.evidenceCandidates.length : null,
      gate:
        gate === null
          ? null
          : {
              refused: gate.refused ?? null,
              accepted: Array.isArray(gate.accepted) ? gate.accepted.length : null,
              rejected: Array.isArray(gate.rejected) ? gate.rejected.length : null,
              reasons: gate.reasons ?? null,
            },
      qualityStatus: data?.qualitySignal?.status ?? null,
      qualityReasons: data?.qualitySignal?.reasons ?? null,
      usage: data?.usage ?? null,
    };

    if (expectation === 'graded_correct') {
      record.verdict =
        record.stage === 'graded' &&
        record.matchesExpected === true &&
        criteria !== null &&
        criteria.every((criterion) => criterion.met === 'yes')
          ? 'PASS'
          : 'FAIL';
    } else if (expectation === 'graded_wrong') {
      record.verdict =
        record.stage === 'graded' &&
        record.matchesExpected === false &&
        criteria !== null &&
        criteria.every((criterion) => criterion.met === 'no')
          ? 'PASS'
          : 'FAIL';
    } else if (expectation === 'gate_short_circuit') {
      record.verdict =
        record.stage === 'clarification_required' && record.modelCalled === false ? 'PASS' : 'FAIL';
    } else {
      record.verdict =
        record.stage === 'clarification_required' &&
        record.requiresClarification === true &&
        record.evidenceCandidateCount === 0
          ? 'PASS'
          : 'FAIL';
    }

    out.samples.push(record);
    writeFileSync(
      path.join(dir, `f7-image-${name}.json`),
      `${JSON.stringify(
        {
          request: {
            mime: body.mime,
            width: body.width,
            height: body.height,
            activityId: body.activityId,
            bytes: bytes.byteLength,
            sha256,
          },
          response: response.json,
          durationMs: response.durationMs,
          verdict: record.verdict,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  out.calls = { imageModelCalls };
  out.verdict = out.samples.every((sample) => sample.verdict === 'PASS') ? 'PASS' : 'FAIL';
  writeFileSync(path.join(dir, 'f7-summary.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return out;
}

/* --------------------------------------------------------------- S1 / S5 */

/**
 * The two remaining product-route anchor turns from T15 §补充: S1 (core
 * misconception → correction/clarification) and S5 (u2.ch3 chapter sample).
 * An explicit fresh session id avoids F5 (auto id collision with persisted DSH
 * sessions). Each turn is capped: stop before exceeding `--max-calls`.
 */
async function phaseS1S5(app, evidence, dir) {
  const logFile = path.join(app.logsDir, 'runtime.jsonl');
  const maxCalls = Number.parseInt(String(evidence['max-calls'] ?? '10'), 10);
  const headroom = Number.parseInt(String(evidence['headroom'] ?? '5'), 10);
  const requested =
    typeof evidence.scenarios === 'string' && evidence.scenarios.length > 0
      ? evidence.scenarios.split(',').map((value) => value.trim()).filter(Boolean)
      : ['S1-core-misconception', 'S5-chapter-sample'];
  const wanted = ['S1-core-misconception', 'S5-chapter-sample'].filter((id) => requested.includes(id));
  const out = { at: iso(), phase: 's1s5', maxCalls, headroom, scenarios: wanted, status: null, turns: [], calls: {} };

  const status = await app.get('/edu/api/status');
  out.status = {
    auth: status.json?.auth ?? null,
    pack: status.json?.pack ?? null,
    dtoTrustMode: status.json?.dto?.trustMode ?? null,
    fixtureData: status.json?.dto?.fixtureData ?? null,
  };

  const base = countCalls(logFile);
  out.calls.baselineAssistant = base.assistant;

  for (const id of wanted) {
    const scenario = SCENARIOS.find((entry) => entry.id === id);
    if (scenario === undefined) continue;
    const current = countCalls(logFile);
    const used = current.assistant - base.assistant;
    // The first turn runs on the full budget; later turns only start when the
    // remaining budget can absorb a typical tool round-trip (headroom), so the
    // phase cannot silently blow past its cap by a whole turn.
    const reserve = id === wanted[0] ? 0 : headroom;
    if (used + reserve >= maxCalls) {
      out.turns.push({ id, kind: scenario.kind, skipped: 'call cap headroom reached', usedSoFar: used });
      continue;
    }
    const sessionId = `session.f7s1s5.${Date.now()}.${id.startsWith('S1') ? 's1' : 's5'}`;
    const start = await app.post('/edu/api/g1/tutor/start', {
      requestId: `f7s1s5-start-${id}-${Date.now()}`,
      conceptId: scenario.conceptId,
      mode: 'learn',
      sessionId,
    });
    const startedSession = start.json?.data?.session?.id ?? null;
    const revision = start.json?.data?.state?.revision ?? 0;
    if (startedSession === null) {
      out.turns.push({
        id,
        kind: scenario.kind,
        startStatus: start.status,
        startError: start.json,
        skipped: 'no session',
      });
      continue;
    }
    const before = countCalls(logFile);
    const turn = await app.post('/edu/api/g1/tutor/turn', {
      requestId: `f7s1s5-turn-${id}-${Date.now()}`,
      sessionId: startedSession,
      revision,
      message: scenario.message,
    });
    const after = countCalls(logFile);
    const message = turn.json?.data?.message ?? null;
    const decision = turn.json?.data?.decision ?? null;
    const citation = turn.json?.data?.sourceCitation ?? null;
    const anchors = analyzeMessage(message, decision, citation);
    const record = {
      id,
      kind: scenario.kind,
      conceptId: scenario.conceptId,
      explicitSessionId: sessionId,
      startStatus: start.status,
      startDurationMs: start.durationMs,
      startedSession,
      turnStatus: turn.status,
      durationMs: turn.durationMs,
      ok: turn.json?.ok ?? null,
      code: turn.json?.error?.code ?? null,
      errorMessage: turn.json?.error?.message ?? null,
      gateway: turn.json?.data?.gateway ?? null,
      model: turn.json?.data?.model ?? null,
      fallbackLocal: turn.json?.data?.gateway === 'local',
      message,
      decision,
      citation,
      anchors,
      sourceAnchor: anchors.hasSourceAnchor && anchors.sourceIdsInText.length + anchors.decisionSourceRefs.length + anchors.citationRefs.length > 0,
      pageAnchor: anchors.hasPageAnchor,
      modelCallsDelta: after.assistant - before.assistant,
      toolCallsDelta: after.toolCalls - before.toolCalls,
      assistantTotalAfter: after.assistant,
      toolResults: (turn.json?.data?.toolResults ?? []).map((entry) => ({
        name: entry.name ?? entry.tool ?? null,
        ok: entry.ok ?? null,
      })),
    };
    // Anchor verdict: source id AND a parseable PDF/printed page AND assistant text.
    record.anchorVerdict =
      record.ok === true && anchors.hasSourceAnchor && anchors.hasPageAnchor ? 'PASS' : 'FAIL';
    out.turns.push(record);
    writeFileSync(
      path.join(dir, `turn-${id}.json`),
      `${JSON.stringify({ scenario, request: { sessionId: startedSession, revision }, response: turn.json, durationMs: turn.durationMs, anchors }, null, 2)}\n`,
      'utf8',
    );
  }

  const after = countCalls(logFile);
  out.calls.afterPhase = after;
  out.calls.turnCallsConsumed = after.assistant - base.assistant;
  writeFileSync(path.join(dir, 's1-s5-summary.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return out;
}

/* ------------------------------------------------------------------ main */

const { values } = parseArgs({
  options: {
    phase: { type: 'string' },
    evidence: { type: 'string' },
    'data-root': { type: 'string' },
    'max-calls': { type: 'string', default: '12' },
    headroom: { type: 'string', default: '4' },
    scenarios: { type: 'string' },
    'key-file': { type: 'string' },
  },
  allowPositionals: false,
});

const dir = path.resolve(String(values.evidence));
const phase = String(values.phase ?? 'unknown');
mkdirSync(dir, { recursive: true });
// Reusing an existing isolated data root keeps the DPAPI key and the prior
// learner journal; new evidence dirs still get their own logs and phase files.
const dataRoot =
  typeof values['data-root'] === 'string' && values['data-root'].length > 0
    ? path.resolve(String(values['data-root']))
    : path.join(dir, 'app-data');
const logsDir = path.join(dir, 'logs', phase);
const evidence = { ...values };

let app = null;
let result = null;
let failure = null;
try {
  app = await boot({ dataRoot, logsDir });
  if (phase === 'auth') result = await phaseAuth(app, evidence, dir);
  else if (phase === 'review') result = await phaseReview(app, evidence, dir);
  else if (phase === 'anchors') result = await phaseAnchors(app, evidence, dir);
  else if (phase === 'probe') result = await phaseProbe(app, evidence, dir);
  else if (phase === 'f7') result = await phaseF7(app, evidence, dir);
  else if (phase === 's1s5') result = await phaseS1S5(app, evidence, dir);
  else throw new Error(`unknown phase ${phase}`);
} catch (error) {
  failure = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  if (app !== null) {
    result = result ?? {};
    result.boot = {
      port: app.port,
      cookiePresent: app.cookiePresent,
      tokenExchangeStatus: app.exchangeStatus,
      exchangeError: app.exchangeError,
      profile: app.profile,
    };
    result.stopped = await app.stop();
  } else if (bootChild !== null) {
    try {
      spawnSync('taskkill', ['/PID', String(bootChild.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  }
  try {
    bootChild?.stdout?.destroy();
    bootChild?.stderr?.destroy();
    bootChild?.unref();
  } catch {
    /* ignore */
  }
  const payload = {
    schemaVersion: 1,
    kind: `t15-budget-${phase}`,
    generatedAt: iso(),
    install: INSTALL,
    dataRoot,
    logsDir,
    failure,
    result,
  };
  writeFileSync(path.join(dir, `phase-${phase}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    phase,
    failure,
    ok: failure === null,
    summary: result === null ? null : {
      calls: result.calls ?? null,
      gate: Array.isArray(result.gate) ? result.gate.map((item) => `${item.name}:${item.stage}:modelCalled=${String(item.modelCalled)}:delta=${item.modelCallsDelta}`) : null,
      f7: Array.isArray(result.samples)
        ? result.samples.map((item) => `${item.name}:${item.stage}:modelCalled=${String(item.modelCalled)}:${item.verdict}`)
        : null,
      start: result.review?.start ?? null,
      finish: result.review?.finish ?? null,
      turns: Array.isArray(result.turns) ? result.turns.map((turn) => `${turn.id}:ok=${String(turn.ok)}:${turn.anchors?.hasPageAnchor ? 'page' : turn.anchors?.hasSourceAnchor ? 'source' : 'none'}:delta=${turn.modelCallsDelta}`) : null,
      restartCheck: result.restartCheck?.conceptProgress?.review ?? null,
    },
  }, null, 2));
  process.exit(failure === null ? 0 : 1);
}
