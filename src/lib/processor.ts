import type { ProcessResult, Settings } from '../types';
import { applyBlur } from './blur';
import { kMeans, medianCut, buildColorMap } from './quantize';
import { findRegions } from './segment';

/**
 * Maximum edge length for processing canvas.
 * 3840 = 4K UHD width — output resolution matches this.
 */
const MAX_PROCESS_SIZE = 3840;

/**
 * Scale `imageData` down so neither dimension exceeds `maxEdge`,
 * preserving the source aspect ratio exactly.
 */
async function scaleToMax(src: ImageData, maxEdge: number): Promise<ImageData> {
  const { width, height } = src;
  if (width <= maxEdge && height <= maxEdge) return src;

  const scale = maxEdge / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const tmp = new OffscreenCanvas(width, height);
  tmp.getContext('2d')!.putImageData(src, 0, 0);

  const out = new OffscreenCanvas(w, h);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Scale `imageData` UP so the longest edge reaches `targetEdge`,
 * preserving the source aspect ratio. Returns src unchanged if already
 * at or above `targetEdge`.
 */
async function scaleUp(src: ImageData, targetEdge: number): Promise<ImageData> {
  const { width, height } = src;
  if (Math.max(width, height) >= targetEdge) return src;

  const scale = targetEdge / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const tmp = new OffscreenCanvas(width, height);
  tmp.getContext('2d')!.putImageData(src, 0, 0);

  const out = new OffscreenCanvas(w, h);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Full processing pipeline:
 * 1. Scale up to 4K (longest edge = MAX_PROCESS_SIZE), then cap at MAX_PROCESS_SIZE
 * 2. Blur
 * 3. Quantise colours
 * 4. Build colour map
 * 5. Find connected regions
 */
export async function processImage(
  imageData: ImageData,
  settings: Settings,
): Promise<ProcessResult> {
  // Scale: first push up to 4K so small uploads get full-res output,
  // then cap in case the source is larger (e.g. 8K).
  let scaled = await scaleUp(imageData, MAX_PROCESS_SIZE);
  scaled = await scaleToMax(scaled, MAX_PROCESS_SIZE);

  const { width, height } = scaled;

  // Blur
  const blurred = applyBlur(scaled.data, width, height, settings.blur);

  // Colour quantisation
  const palette =
    settings.algorithm === 'kmeans'
      ? kMeans(blurred, settings.numColors)
      : medianCut(blurred, settings.numColors);

  // Per-pixel colour index
  const colorMap = buildColorMap(blurred, palette);

  // Connected regions (centroid + area only — no pixel lists)
  const regions = findRegions(colorMap, width, height);

  return { colorMap, regions, palette, width, height };
}
