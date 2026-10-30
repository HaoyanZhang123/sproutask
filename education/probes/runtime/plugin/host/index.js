/**
 * T00 runtime probe — host-side plugin (NOT a product package).
 *
 * Registers:
 *   1. one fixed mock LLM provider route `edu-mock` / model `echo-1`
 *      (scripted: step 1 requests one allowed education tool plus three
 *      disallowed tools, step 2 reports the resulting tool outcomes);
 *   2. one constrained education tool `edu_probe_echo` whose argument schema
 *      accepts a short text and whose result is a deterministic echo.
 *
 * No real provider is registered, no credential is read, and the plugin does
 * not import any DSH package (it stays duck-typed against the public seams).
 */
import { appendFileSync } from 'node:fs';

const PROVIDER = 'edu-mock';
const MODEL = 'echo-1';
const LOG = process.env.EDU_PROBE_LOG ?? '';

function log(record) {
  if (!LOG) return;
  try {
    appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`, 'utf8');
  } catch {
    /* evidence logging must never break the probe run */
  }
}

const EDUCATION_TOOL = {
  name: 'edu_probe_echo',
  description:
    'T00 probe education tool. Echo a short learner-visible text and return a fixed provenance tag. ' +
    'This is the only model-callable tool in this probe profile.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Short text to echo back.' },
    },
    required: ['text'],
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        echo: { type: 'string' },
        source: { type: 'string' },
      },
    },
    render(_args, value) {
      return [{ type: 'text', text: `edu_probe_echo -> ${value.echo} (source: ${value.source})` }];
    },
  },
  async execute(args) {
    return { echo: String(args.text ?? ''), source: 't00-probe/education-tool' };
  },
};

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

function toolCallsIn(messages) {
  const calls = [];
  for (const message of messages ?? []) {
    for (const block of Array.isArray(message?.content) ? message.content : []) {
      if (block?.type === 'tool-call') calls.push(block);
    }
  }
  return calls;
}

function toolResultsIn(messages) {
  const results = [];
  for (const message of messages ?? []) {
    if (message?.role !== 'tool' && message?.role !== 'tool-result') continue;
    results.push({ role: message.role, text: textOf(message.content) });
  }
  return results;
}

function toolNames(messages) {
  return [...new Set(toolCallsIn(messages).map((call) => call.name))];
}

class EduMockAdapter {
  providerInfo(provider) {
    return { id: provider, name: 'T00 probe mock provider (scripted, no network)' };
  }

  providerRetryPolicy() {
    return undefined;
  }

  imageRequestPricing() {
    return undefined;
  }

  async listModels() {
    return [{ provider: PROVIDER, id: MODEL, name: 'T00 probe echo model' }];
  }

  async resolveModel(provider, model) {
    return {
      provider,
      id: model,
      name: 'T00 probe echo model',
      context: { contextWindow: 32768 },
      inputModalities: ['text'],
    };
  }

  async prepareCall(provider, model) {
    const self = this;
    return {
      model: await this.resolveModel(provider, model),
      stream: (options) => self.stream(options),
    };
  }

  async *stream(options) {
    const toolNamesSeen = (options.tools ?? []).map((tool) => tool.name);
    const historyCalls = toolCallsIn(options.messages);
    const step = historyCalls.length === 0 ? 1 : 2;
    log({
      event: 'llm.request',
      provider: options.provider,
      model: options.model,
      step,
      advertisedTools: toolNamesSeen,
      toolCallsInHistory: historyCalls.map((call) => call.name),
      toolResultCount: toolResultsIn(options.messages).length,
    });

    let index = 0;
    let outputTokens = 0;

    const emitText = (text) => {
      const chunks = [
        { type: 'block-start', index, blockType: 'text' },
        { type: 'text-delta', index, text },
        { type: 'block-end', index, block: { type: 'text', text } },
      ];
      index += 1;
      outputTokens += Math.max(1, Math.ceil(text.length / 4));
      return chunks;
    };

    const emitToolCall = (id, name, args) => {
      const json = JSON.stringify(args);
      const chunks = [
        { type: 'block-start', index, blockType: 'tool-call' },
        { type: 'tool-call-delta', index, id, name, argumentsDelta: json },
        {
          type: 'block-end',
          index,
          block: { type: 'tool-call', id, name, arguments: json },
        },
      ];
      index += 1;
      outputTokens += Math.max(1, Math.ceil(json.length / 4));
      return chunks;
    };

    if (step === 1) {
      // One allowed education tool, then three tools that a student agent must
      // never be able to call from this profile (shell, arbitrary file read,
      // PTC program execution).
      yield* emitToolCall('probe-call-edu', 'edu_probe_echo', { text: 'T00 allowlisted education tool call' });
      yield* emitToolCall('probe-call-bash', 'bash', { command: 'Get-ChildItem C:\\' });
      yield* emitToolCall('probe-call-fsread', 'read_file', { path: 'C:\\Windows\\win.ini' });
      yield* emitToolCall('probe-call-ptc', 'run_code', { code: 'return 1', description: 'probe PTC execution' });
      yield { type: 'usage', usage: { inputTokens: 64, outputTokens } };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
      return;
    }

    const results = toolResultsIn(options.messages);
    const summary = results.map((result) => result.text).join(' | ');
    const text = `PROBE_FINAL rejected-tools-report: ${summary || '(no tool results observed)'}`;
    log({ event: 'llm.final', toolNames: toolNames(options.messages), results });
    yield* emitText(text);
    yield { type: 'usage', usage: { inputTokens: 96, outputTokens } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}

export const inject = ['tools', 'llm'];

export function apply(ctx) {
  log({ event: 'plugin.apply', provider: PROVIDER, tool: EDUCATION_TOOL.name });

  const disposeAdapter = ctx.llm.registerAdapter([PROVIDER], new EduMockAdapter());
  ctx.effect(() => disposeAdapter, 't00-probe: unregister mock llm adapter');

  ctx.tools.register(EDUCATION_TOOL);
  log({ event: 'plugin.registered', tools: ctx.tools.schemas?.()?.map?.((schema) => schema.name) ?? null });
}
