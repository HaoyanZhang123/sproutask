/**
 * Transform provenance and inverse mapping (T11 step 3).
 *
 * The model only ever sees the request image (rotated / cropped / scaled). Any
 * region it returns must be mappable back to the original asset so the UI can
 * highlight "what the model looked at". Mapping is pure arithmetic; the actual
 * pixel transform is done by the host before the request.
 */

import type { NormalizedBBox } from '@edu/domain';

import { fail, ok, visualsError, type VisualsResult } from '../errors.js';
import {
  SUPPORTED_IMAGE_MIME,
  type ImageAssetHandle,
  type ImageMime,
  type ImageTransform,
  type TransformProvenance,
} from './types.js';

export interface RequestImage {
  readonly base64: string;
  readonly mime: ImageMime;
  readonly width: number;
  readonly height: number;
}

export function validateImageAsset(asset: ImageAssetHandle): VisualsResult<ImageAssetHandle> {
  if (!(SUPPORTED_IMAGE_MIME as readonly string[]).includes(asset.mime)) {
    return fail(visualsError('ASSET_UNSUPPORTED_FORMAT'));
  }
  if (asset.width <= 0 || asset.height <= 0 || asset.byteSize <= 0) {
    return fail(visualsError('ASSET_INVALID'));
  }
  return ok(asset);
}

export function buildProvenance(input: {
  readonly asset: ImageAssetHandle;
  readonly transform: ImageTransform;
  readonly request: { readonly width: number; readonly height: number; readonly mime: ImageMime };
  readonly promptVersion: string;
}): VisualsResult<TransformProvenance> {
  const { transform } = input;
  if (![0, 90, 180, 270].includes(transform.rotation)) {
    return fail(visualsError('ASSET_INVALID', { detailsRef: 'rotation' }));
  }
  if (transform.scale <= 0 || transform.scale > 1) {
    return fail(visualsError('ASSET_INVALID', { detailsRef: 'scale' }));
  }
  if (transform.crop !== null) {
    const { x, y, width, height } = transform.crop;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      return fail(visualsError('ASSET_INVALID', { detailsRef: 'crop' }));
    }
  }
  if (input.request.width <= 0 || input.request.height <= 0) {
    return fail(visualsError('ASSET_INVALID', { detailsRef: 'request-size' }));
  }
  return ok({
    original: { width: input.asset.width, height: input.asset.height, sha256: input.asset.sha256 },
    applied: transform,
    request: {
      width: input.request.width,
      height: input.request.height,
      mime: input.request.mime,
    },
    mapping: 'linear',
    promptVersion: input.promptVersion,
  });
}

/** Rotates a normalized point from the original image into the rotated image. */
function rotateNormalized(
  x: number,
  y: number,
  rotation: ImageTransform['rotation'],
): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: 1 - y, y: x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: y, y: 1 - x };
    case 0:
    default:
      return { x, y };
  }
}

function unrotateNormalized(
  x: number,
  y: number,
  rotation: ImageTransform['rotation'],
): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: y, y: 1 - x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: 1 - y, y: x };
    case 0:
    default:
      return { x, y };
  }
}

/** Original normalized point -> request pixel point. */
export function mapOriginalToRequest(
  point: { readonly x: number; readonly y: number },
  provenance: TransformProvenance,
): { x: number; y: number } {
  const rotated = rotateNormalized(point.x, point.y, provenance.applied.rotation);
  const crop = provenance.applied.crop;
  const cropped =
    crop === null
      ? rotated
      : { x: (rotated.x - crop.x) / crop.width, y: (rotated.y - crop.y) / crop.height };
  return {
    x: cropped.x * provenance.request.width,
    y: cropped.y * provenance.request.height,
  };
}

/** Request pixel point -> original normalized point (used to highlight regions). */
export function mapRequestToOriginal(
  pixel: { readonly x: number; readonly y: number },
  provenance: TransformProvenance,
): { x: number; y: number } {
  const normalized = {
    x: pixel.x / provenance.request.width,
    y: pixel.y / provenance.request.height,
  };
  const crop = provenance.applied.crop;
  const rotated =
    crop === null
      ? normalized
      : { x: normalized.x * crop.width + crop.x, y: normalized.y * crop.height + crop.y };
  return unrotateNormalized(rotated.x, rotated.y, provenance.applied.rotation);
}

/** Maps a request-pixel bbox back to a normalized bbox of the original image. */
export function mapRegionToOriginal(
  region: { readonly bbox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } },
  provenance: TransformProvenance,
): NormalizedBBox {
  const corners = [
    mapRequestToOriginal({ x: region.bbox.x, y: region.bbox.y }, provenance),
    mapRequestToOriginal({ x: region.bbox.x + region.bbox.width, y: region.bbox.y }, provenance),
    mapRequestToOriginal({ x: region.bbox.x, y: region.bbox.y + region.bbox.height }, provenance),
    mapRequestToOriginal(
      { x: region.bbox.x + region.bbox.width, y: region.bbox.y + region.bbox.height },
      provenance,
    ),
  ];
  const xs = corners.map((corner) => clamp01(corner.x));
  const ys = corners.map((corner) => clamp01(corner.y));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(0.0001, maxX - minX),
    height: Math.max(0.0001, maxY - minY),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
