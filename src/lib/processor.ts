import type { ProcessResult, Settings } from '../types';
import { applyBlur } from './blur';
import { kMeans, medianCut, buildColorMap } from './quantize';
import { findRegions } from './segment';

/** Maximum edge length for the processing canvas (keeps CPU time acceptable). */
const MAX_PROCESS_SIZE = 700;

/**
 * Scale `imageData` down so neither dimension exceeds `maxEdge`.
 * Returns the scaled ImageData and the offscreen canvas used.
 */
function scaleDown(
  src: ImageData,
  maxEdge: number,
): { data: ImageData; canvas: OffscreenCanvas } | { data: ImageData; canvas: null } {
  const { width, height } = src;
  if (width <= maxEdge && height <= maxEdge) return { data: src, canvas: null };

  const scale = maxEdge / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  // Draw original into smaller canvas via an intermediate bitmap
  const tmp = new OffscreenCanvas(width, height);
  tmp.getContext('2d')!.putImageData(src, 0, 0);
  ctx.drawImage(tmp, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h), canvas };
}

/**
 * Full processing pipeline:
 * 1. Scale down (if needed)
 * 2. Blur
 * 3. Quantise colours
 * 4. Build colour map
 * 5. Find connected regions
 */
export async function processImage(
  imageData: ImageData,
  settings: Settings,
): Promise<ProcessResult> {
  const { data: scaledData } = scaleDown(imageData, MAX_PROCESS_SIZE);
  const { width, height } = scaledData;

  // Blur
  const blurred = applyBlur(scaledData.data, width, height, settings.blur);

  // Colour quantisation
  const palette =
    settings.algorithm === 'kmeans'
      ? kMeans(blurred, settings.numColors)
      : medianCut(blurred, settings.numColors);

  // Per-pixel colour index
  const colorMap = buildColorMap(blurred, palette);

  // Connected regions
  const regions = findRegions(colorMap, width, height);

  return { colorMap, regions, palette, width, height };
}
