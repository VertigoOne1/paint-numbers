import type { Color, ProcessResult } from '../types';

/** Perceived luminance (0–1) for contrast decisions. */
function luminance(c: Color): number {
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

/**
 * Draw the paint-by-numbers output onto `ctx`.
 *
 * - showColors: fill regions with palette colour; otherwise white
 * - minRegionSize: skip number labels for tiny regions
 */
export function renderPaintNumbers(
  ctx: CanvasRenderingContext2D,
  result: ProcessResult,
  minRegionSize: number,
  showColors: boolean,
): void {
  const { colorMap, regions, palette, width, height } = result;

  // ── 1. Fill background (colours or white) ──────────────────────────────────
  const imgData = ctx.createImageData(width, height);
  const px = imgData.data;

  if (showColors) {
    for (let i = 0; i < width * height; i++) {
      const c = palette[colorMap[i]];
      px[i * 4]     = c.r;
      px[i * 4 + 1] = c.g;
      px[i * 4 + 2] = c.b;
      px[i * 4 + 3] = 255;
    }
  } else {
    px.fill(255); // white; alpha already 255
  }

  // ── 2. Draw region borders ─────────────────────────────────────────────────
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const c = colorMap[i];
      const isEdge =
        (x > 0          && colorMap[i - 1]     !== c) ||
        (x < width - 1  && colorMap[i + 1]     !== c) ||
        (y > 0          && colorMap[i - width]  !== c) ||
        (y < height - 1 && colorMap[i + width]  !== c);

      if (isEdge) {
        px[i * 4]     = 0;
        px[i * 4 + 1] = 0;
        px[i * 4 + 2] = 0;
        px[i * 4 + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // ── 3. Assign stable colour numbers (sorted by palette index for consistency)
  const colorNumbers = new Map<number, number>();
  // Sort palette entries by approximate hue so numbers are stable across runs
  const sortedIndices = palette
    .map((c, i) => ({ i, hue: Math.atan2(Math.sqrt(3) * (c.g - c.b), 2 * c.r - c.g - c.b) }))
    .sort((a, b) => a.hue - b.hue)
    .map(x => x.i);

  let num = 1;
  for (const idx of sortedIndices) {
    colorNumbers.set(idx, num++);
  }

  // ── 4. Draw number labels in each visible region ───────────────────────────
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const region of regions) {
    if (region.area < minRegionSize) continue;

    const colorNum = colorNumbers.get(region.colorIndex)!;
    const fontSize = Math.max(7, Math.min(18, Math.sqrt(region.area) * 0.28));

    ctx.font = `bold ${fontSize}px sans-serif`;

    let textColor: string;
    if (showColors) {
      textColor = luminance(palette[region.colorIndex]) > 0.55 ? '#111' : '#eee';
    } else {
      textColor = '#333';
    }
    ctx.fillStyle = textColor;
    ctx.fillText(String(colorNum), region.centroidX, region.centroidY);
  }
}

/**
 * Render only the quantised colour preview (no borders/numbers).
 */
export function renderColorPreview(
  ctx: CanvasRenderingContext2D,
  result: ProcessResult,
): void {
  const { colorMap, palette, width, height } = result;
  const imgData = ctx.createImageData(width, height);
  const px = imgData.data;

  for (let i = 0; i < width * height; i++) {
    const c = palette[colorMap[i]];
    px[i * 4]     = c.r;
    px[i * 4 + 1] = c.g;
    px[i * 4 + 2] = c.b;
    px[i * 4 + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Build a colour-number lookup in the same order used by renderPaintNumbers.
 * Returns array indexed by palette index → display number (1-based).
 */
export function buildColorNumbers(palette: Color[]): number[] {
  const sortedIndices = palette
    .map((c, i) => ({ i, hue: Math.atan2(Math.sqrt(3) * (c.g - c.b), 2 * c.r - c.g - c.b) }))
    .sort((a, b) => a.hue - b.hue)
    .map(x => x.i);

  const result = new Array<number>(palette.length);
  sortedIndices.forEach((paletteIdx, rank) => { result[paletteIdx] = rank + 1; });
  return result;
}
