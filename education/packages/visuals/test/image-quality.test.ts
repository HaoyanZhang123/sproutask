import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { Activity } from '@edu/domain';

import {
  analyzeImageQuality,
  imageQualityClarificationMessage,
  IMAGE_QUALITY_THRESHOLDS,
  IMAGE_QUALITY_THRESHOLD_VERSION,
} from '../src/image/quality-probe.js';
import { evaluateImageAnswer } from '../src/image/pipeline.js';
import { IDENTITY_TRANSFORM, type ImageAssetHandle } from '../src/image/types.js';
import { FakeVisionClient, type VisionClient, type VisionRequest } from '../src/image/vision-client.js';
import { attemptFor, domainFixtureActivity, domainFixtureRubric } from './helpers/fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures', 'images');

const activity: Activity = domainFixtureActivity((entry) => entry.answerSchema.kind === 'diagram_label');
const rubric = domainFixtureRubric('rubric.cell');

function sample(name: string): { base64: string; width: number; height: number; bytes: number } {
  const buffer = readFileSync(path.join(fixtures, name));
  return {
    base64: buffer.toString('base64'),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.byteLength,
  };
}

function assetFor(name: string): ImageAssetHandle {
  const image = sample(name);
  return {
    assetId: `asset:${name}`,
    sha256: 'a'.repeat(64),
    mime: 'image/png',
    width: image.width,
    height: image.height,
    byteSize: image.bytes,
  };
}

function confidentModelJson(text = '细胞核'): string {
  return JSON.stringify({
    readable: true,
    recognizedText: text,
    matchesExpected: true,
    reason: '作答与参考答案一致',
    uncertainty: 0.05,
    regions: [{ text, x: 100, y: 100, width: 80, height: 40, confidence: 0.95 }],
  });
}

async function evaluate(name: string, client: VisionClient) {
  const image = sample(name);
  return evaluateImageAnswer({
    asset: assetFor(name),
    transform: IDENTITY_TRANSFORM,
    requestImage: { base64: image.base64, mime: 'image/png', width: image.width, height: image.height },
    activity,
    rubric,
    attempt: attemptFor(activity),
    expectedAnswer: '细胞核',
    client,
  });
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodeGrayPng(width: number, height: number, gray: Uint8Array): Buffer {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    Buffer.from(gray.subarray(y * width, y * width + width)).copy(raw, y * (width + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function sharpTiltedPng(degrees = 14): { png: Buffer; width: number; height: number } {
  const scale = 4;
  const width = 640;
  const height = 420;
  const hiW = width * scale;
  const hiH = height * scale;
  const hi = new Uint8Array(hiW * hiH).fill(255);
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = hiW / 2;
  const cy = hiH / 2;
  for (let y = 0; y < hiH; y += 1) {
    for (let x = 0; x < hiW; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const localX = cos * dx + sin * dy;
      const localY = -sin * dx + cos * dy;
      if (Math.abs(localX) > hiW * 0.42 || Math.abs(localY) > hiH * 0.42) continue;
      const onHorizontal = Math.abs(localY % (60 * scale)) < 1.5 * scale || Math.abs(localY) < 1.5 * scale;
      const onVertical = Math.abs(localX % (80 * scale)) < 1.5 * scale || Math.abs(localX) < 1.5 * scale;
      if (onHorizontal || onVertical) hi[y * hiW + x] = 0;
    }
  }
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) sum += hi[(y * scale + sy) * hiW + x * scale + sx];
      }
      gray[y * width + x] = Math.round(sum / (scale * scale));
    }
  }
  return { png: encodeGrayPng(width, height, gray), width, height };
}

describe('independent image quality probe (A20 hardening)', () => {
  it('keeps clear diagram samples usable', () => {
    for (const name of ['01-clear-correct.png', '02-clear-wrong.png']) {
      const image = sample(name);
      const signal = analyzeImageQuality({ ...image, mime: 'image/png' });
      expect(signal.status, name).toBe('ok');
      expect(signal.forcedClarification, name).toBe(false);
      expect(signal.metrics?.laplacianVariance ?? 0).toBeGreaterThan(IMAGE_QUALITY_THRESHOLDS.blurLapVar);
    }
    const blankArea = sample('04-blank.png');
    const blankSignal = analyzeImageQuality({ ...blankArea, mime: 'image/png' });
    expect(blankSignal.forcedClarification).toBe(false);
  });

  it('forces clarification for the rotated+blurred T11 sample', () => {
    const image = sample('03-rotated-blurred.png');
    const signal = analyzeImageQuality({ ...image, mime: 'image/png' });
    expect(signal.status).toBe('blurry');
    expect(signal.forcedClarification).toBe(true);
    expect(signal.metrics?.laplacianVariance ?? 999).toBeLessThan(IMAGE_QUALITY_THRESHOLDS.blurLapVar);
    expect(signal.reasons.join(' ')).toContain('模糊');
    expect(imageQualityClarificationMessage(signal)).toContain('图片较模糊/倾斜，请重拍或改用文字描述');
  });

  it('detects a sharp 14 degree tilt independently of blur', () => {
    const tilted = sharpTiltedPng(14);
    const signal = analyzeImageQuality({
      base64: tilted.png.toString('base64'),
      mime: 'image/png',
      width: tilted.width,
      height: tilted.height,
    });
    expect(signal.forcedClarification).toBe(true);
    expect(signal.status).toBe('tilted');
    expect(Math.abs((signal.metrics?.skewDegrees ?? 0) - 14)).toBeLessThanOrEqual(3);
    expect(signal.reasons.join(' ')).toContain('倾斜');
  });

  it('does not force clarification for formats it cannot decode (never guesses)', () => {
    const signal = analyzeImageQuality({ base64: 'iVBORw0KGgo=', mime: 'image/png', width: 800, height: 600 });
    expect(signal.status).toBe('unavailable');
    expect(signal.forcedClarification).toBe(false);
  });
});

describe('image pipeline: quality forces clarification before the model', () => {
  it('returns clarification for the blurred sample even with a confident model, without calling the model', async () => {
    let called = 0;
    const client: VisionClient = {
      id: 'must-not-be-called',
      capabilities: { provider: 'fake', model: 'fake-vision-1', text: true, image: true },
      async call(_request: VisionRequest) {
        called += 1;
        throw new Error('model must not be called for a rejected-quality image');
      },
    };
    const result = await evaluate('03-rotated-blurred.png', client);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(called).toBe(0);
    expect(result.value.stage).toBe('clarification_required');
    expect(result.value.qualitySignal?.forcedClarification).toBe(true);
    expect(result.value.clarification?.message).toContain('图片较模糊/倾斜，请重拍或改用文字描述');
    expect(result.value.clarification?.actions).toContain('retake');
    expect(result.value.clarification?.actions).toContain('text_fallback');
    expect(result.value.grade?.requiresClarification).toBe(true);
    expect(result.value.grade?.evidenceCandidates).toEqual([]);
    expect(result.value.grade?.uncertainties.join(' ')).toContain('quality_signal:');
    expect(result.value.grade?.uncertainties.join(' ')).toContain(
      `threshold_version:${IMAGE_QUALITY_THRESHOLD_VERSION}`,
    );
    expect(result.value.grade?.graderVersion).toContain(IMAGE_QUALITY_THRESHOLD_VERSION);
  });

  it('grades clear samples and records the quality signal in GradeResult', async () => {
    for (const name of ['01-clear-correct.png', '02-clear-wrong.png', '04-blank.png']) {
      const result = await evaluate(name, new FakeVisionClient({ responseText: confidentModelJson() }));
      expect(result.ok, name).toBe(true);
      if (!result.ok) continue;
      expect(result.value.stage, name).toBe('graded');
      expect(result.value.qualitySignal?.forcedClarification, name).toBe(false);
      expect(result.value.grade?.requiresClarification, name).toBe(false);
      expect(result.value.grade?.uncertainties.join(' '), name).toContain('quality_signal:');
      expect(result.value.grade?.graderVersion, name).toContain(IMAGE_QUALITY_THRESHOLD_VERSION);
    }
  });
});
