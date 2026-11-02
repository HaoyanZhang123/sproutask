/**
 * Independent image-quality probe (T11 A20 hardening).
 *
 * Model confidence is not evidence that the photo is usable: a 14°-rotated,
 * 6×-blurred image can still be "confidently" graded as correct. This module
 * measures explainable image statistics *before* any model call:
 *
 *  - Laplacian variance (focus/blur) and edge density;
 *  - dominant edge orientation (skew/tilt) from a gradient histogram;
 *  - intensity variance (near-uniform/blank frames);
 *  - aspect ratio (extreme crops).
 *
 * A forced clarification signal (`qualitySignal.forcedClarification`) makes the
 * pipeline return `requiresClarification` without judging the student wrong.
 * Only 8-bit non-interlaced PNG is decoded (the current accepted upload format);
 * other formats return `status: 'unavailable'` and never force a clarification.
 */

import { inflateSync } from 'node:zlib';

export const IMAGE_QUALITY_THRESHOLD_VERSION = 'image-quality-v1';

export interface ImageQualityThresholds {
  /** Below this Laplacian variance the image is treated as blurred. */
  readonly blurLapVar: number;
  /** Absolute dominant-edge skew (degrees) that counts as tilted. */
  readonly tiltDegrees: number;
  /** Required orientation coherence before a tilt claim is made. */
  readonly tiltPeakShare: number;
  /** Below this intensity variance a frame is treated as blank/uniform. */
  readonly uniformIntensityVariance: number;
  /** Extreme aspect ratio warning (not forced by itself). */
  readonly extremeAspect: readonly [number, number];
}

export const IMAGE_QUALITY_THRESHOLDS: ImageQualityThresholds = {
  blurLapVar: 80,
  tiltDegrees: 5,
  tiltPeakShare: 0.18,
  uniformIntensityVariance: 20,
  extremeAspect: [0.35, 2.8],
};

export type ImageQualityStatus =
  | 'ok'
  | 'blurry'
  | 'tilted'
  | 'blurry_and_tilted'
  | 'blank_or_uniform'
  | 'unavailable';

export interface ImageQualityMetrics {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly laplacianVariance: number;
  readonly edgeDensity: number;
  readonly intensityVariance: number;
  readonly skewDegrees: number;
  readonly orientationPeakShare: number;
}

export interface ImageQualitySignal {
  readonly version: string;
  readonly status: ImageQualityStatus;
  readonly forcedClarification: boolean;
  readonly reasons: readonly string[];
  readonly metrics: ImageQualityMetrics | null;
  readonly thresholds: ImageQualityThresholds;
  readonly note: string;
}

export interface ImageQualityInput {
  readonly base64: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
}

interface Decoded {
  readonly width: number;
  readonly height: number;
  readonly gray: Uint8Array;
}

function decodePng(buffer: Buffer): Decoded {
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const bpp = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (bitDepth !== 8 || interlace !== 0 || bpp === undefined || width <= 0 || height <= 0) {
    throw new Error(`unsupported PNG (bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace})`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const gray = new Uint8Array(width * height);
  let previous = Buffer.alloc(stride);
  let position = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[position] ?? 0;
    position += 1;
    const line = Buffer.from(raw.subarray(position, position + stride));
    position += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? line[x - bpp] : 0;
      const above = previous[x];
      const upperLeft = x >= bpp ? previous[x - bpp] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += above;
      else if (filter === 3) value += (left + above) >> 1;
      else if (filter === 4) {
        const p = left + above - upperLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - upperLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
      }
      line[x] = value & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      let r: number;
      let g: number;
      let b: number;
      if (colorType === 0) {
        r = g = b = line[x];
      } else if (colorType === 2) {
        r = line[x * 3];
        g = line[x * 3 + 1];
        b = line[x * 3 + 2];
      } else if (colorType === 4) {
        r = g = b = line[x * 2];
      } else {
        r = line[x * 4];
        g = line[x * 4 + 1];
        b = line[x * 4 + 2];
      }
      gray[y * width + x] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    previous = line;
  }
  return { width, height, gray };
}

function computeMetrics(decoded: Decoded): ImageQualityMetrics {
  const { width, height, gray } = decoded;
  const at = (x: number, y: number): number => gray[y * width + x];
  let sum = 0;
  for (const value of gray) sum += value;
  const meanIntensity = sum / gray.length;
  let intensitySquares = 0;
  for (const value of gray) intensitySquares += (value - meanIntensity) ** 2;
  const intensityVariance = intensitySquares / gray.length;

  let lapSum = 0;
  let lapSquares = 0;
  let lapCount = 0;
  let edgeCount = 0;
  let gradientTotal = 0;
  const histogram = new Float64Array(90);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = at(x, y);
      const laplacian = 4 * center - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1);
      lapSum += laplacian;
      lapSquares += laplacian * laplacian;
      lapCount += 1;
      const gx =
        -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) +
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      const magnitude = Math.hypot(gx, gy);
      if (magnitude > 60) {
        edgeCount += 1;
        let angle = (Math.atan2(gy, gx) * 180) / Math.PI;
        angle = ((angle + 90) % 180 + 180) % 180;
        let skew = angle >= 90 ? angle - 180 : angle;
        if (skew > 45) skew -= 90;
        if (skew < -45) skew += 90;
        const bin = ((Math.round(skew) + 45) % 90 + 90) % 90;
        histogram[bin] += magnitude;
        gradientTotal += magnitude;
      }
    }
  }
  const lapMean = lapCount === 0 ? 0 : lapSum / lapCount;
  const laplacianVariance = lapCount === 0 ? 0 : lapSquares / lapCount - lapMean * lapMean;
  let best = -1;
  let bestBin = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    if (histogram[index] > best) {
      best = histogram[index];
      bestBin = index;
    }
  }
  return {
    width,
    height,
    aspectRatio: Number((width / height).toFixed(3)),
    laplacianVariance: Number(laplacianVariance.toFixed(2)),
    edgeDensity: lapCount === 0 ? 0 : Number((edgeCount / lapCount).toFixed(5)),
    intensityVariance: Number(intensityVariance.toFixed(2)),
    skewDegrees: bestBin - 45,
    orientationPeakShare: gradientTotal === 0 ? 0 : Number((best / gradientTotal).toFixed(3)),
  };
}

const NOTE =
  '独立于模型的图像质量指标；仅用于强制澄清，不判对错、不写成绩。阈值是产品启发式（image-quality-v1），非已验证视觉科学结论。';

function unavailable(reason: string): ImageQualitySignal {
  return {
    version: IMAGE_QUALITY_THRESHOLD_VERSION,
    status: 'unavailable',
    forcedClarification: false,
    reasons: [],
    metrics: null,
    thresholds: IMAGE_QUALITY_THRESHOLDS,
    note: `${NOTE} 本图未能解码（${reason}），未启用独立质量强制澄清。`,
  };
}

export function analyzeImageQuality(input: ImageQualityInput): ImageQualitySignal {
  if (!input.mime.toLowerCase().includes('png')) return unavailable(`mime=${input.mime}`);
  let decoded: Decoded;
  try {
    decoded = decodePng(Buffer.from(input.base64, 'base64'));
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : 'decode failed');
  }
  if (decoded.width < 32 || decoded.height < 32) return unavailable('image too small to measure');
  if (input.width > 0 && input.height > 0 && (decoded.width !== input.width || decoded.height !== input.height)) {
    return unavailable(`declared ${input.width}x${input.height} != PNG ${decoded.width}x${decoded.height}`);
  }
  const metrics = computeMetrics(decoded);
  const reasons: string[] = [];
  if (metrics.laplacianVariance < IMAGE_QUALITY_THRESHOLDS.blurLapVar) {
    reasons.push(`图片较模糊（清晰度 ${metrics.laplacianVariance} < ${IMAGE_QUALITY_THRESHOLDS.blurLapVar}）`);
  }
  if (
    Math.abs(metrics.skewDegrees) >= IMAGE_QUALITY_THRESHOLDS.tiltDegrees &&
    metrics.orientationPeakShare >= IMAGE_QUALITY_THRESHOLDS.tiltPeakShare
  ) {
    reasons.push(`图片可能有 ${Math.abs(metrics.skewDegrees)}° 倾斜，请摆正后重拍`);
  }
  if (
    metrics.intensityVariance < IMAGE_QUALITY_THRESHOLDS.uniformIntensityVariance &&
    metrics.edgeDensity < 0.002
  ) {
    reasons.push('图片几乎是空白/均匀色块');
  }
  let status: ImageQualityStatus = 'ok';
  const blurry = reasons.some((reason) => reason.includes('模糊'));
  const tilted = reasons.some((reason) => reason.includes('倾斜'));
  const blank = reasons.some((reason) => reason.includes('空白'));
  if (blank) status = 'blank_or_uniform';
  else if (blurry && tilted) status = 'blurry_and_tilted';
  else if (blurry) status = 'blurry';
  else if (tilted) status = 'tilted';
  return {
    version: IMAGE_QUALITY_THRESHOLD_VERSION,
    status,
    forcedClarification: reasons.length > 0,
    reasons,
    metrics,
    thresholds: IMAGE_QUALITY_THRESHOLDS,
    note: NOTE,
  };
}

/** Student-facing clarification text for a forced independent quality signal. */
export function imageQualityClarificationMessage(signal: ImageQualitySignal): string {
  return [
    '图片较模糊/倾斜，请重拍或改用文字描述。',
    ...signal.reasons.map((reason) => `· ${reason}`),
    '系统不会因为图片质量而判你答错；这次也不会写入理解证据。',
  ].join('\n');
}
