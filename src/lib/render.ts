import type { Color, ProcessResult, Settings } from '../types';
import { nearestWebColor } from './webColors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Perceived luminance (0–1) for contrast decisions. */
function luminance(c: Color): number {
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

/** Parse a CSS hex colour string to {r,g,b}. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Build a colour-number lookup in a stable, hue-sorted order.
 * Returns an array indexed by palette index → display number (1-based).
 */
export function buildColorNumbers(palette: Color[]): number[] {
  const sortedIndices = palette
    .map((c, i) => ({
      i,
      hue: Math.atan2(Math.sqrt(3) * (c.g - c.b), 2 * c.r - c.g - c.b),
    }))
    .sort((a, b) => a.hue - b.hue)
    .map(x => x.i);

  const result = new Array<number>(palette.length);
  sortedIndices.forEach((paletteIdx, rank) => {
    result[paletteIdx] = rank + 1;
  });
  return result;
}

// ─── Edge detection + separable dilation ──────────────────────────────────────

function buildEdgeMask(
  colorMap: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const c = colorMap[i];
      if (
        (x > 0          && colorMap[i - 1]     !== c) ||
        (x < width - 1  && colorMap[i + 1]     !== c) ||
        (y > 0          && colorMap[i - width]  !== c) ||
        (y < height - 1 && colorMap[i + width]  !== c)
      ) {
        mask[i] = 1;
      }
    }
  }
  return mask;
}

/**
 * Separable morphological dilation (equivalent to a square structuring element).
 * Much faster than a 2-D dilation loop at large radii.
 */
function dilateEdgeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius === 0) return mask;

  // Horizontal pass
  const tmp = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = false;
      const xMin = Math.max(0, x - radius);
      const xMax = Math.min(width - 1, x + radius);
      for (let nx = xMin; nx <= xMax; nx++) {
        if (mask[y * width + nx]) { hit = true; break; }
      }
      if (hit) tmp[y * width + x] = 1;
    }
  }

  // Vertical pass
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = false;
      const yMin = Math.max(0, y - radius);
      const yMax = Math.min(height - 1, y + radius);
      for (let ny = yMin; ny <= yMax; ny++) {
        if (tmp[ny * width + x]) { hit = true; break; }
      }
      if (hit) out[y * width + x] = 1;
    }
  }

  return out;
}

// ─── Main render ──────────────────────────────────────────────────────────────

/**
 * Draw the paint-by-numbers output onto `ctx`.
 * Accepts all visual settings directly.
 */
export function renderPaintNumbers(
  ctx: CanvasRenderingContext2D,
  result: ProcessResult,
  settings: Pick<
    Settings,
    'minRegionSize' | 'showColors' | 'borderThickness' | 'borderColor' | 'fontSize' | 'numberColor'
  >,
): void {
  const { colorMap, regions, palette, width, height } = result;
  const {
    minRegionSize,
    showColors,
    borderThickness,
    borderColor,
    fontSize,
    numberColor,
  } = settings;

  // ── 1. Fill background ────────────────────────────────────────────────────
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
    // White background; alpha already 0 → fill it
    for (let i = 0; i < px.length; i += 4) {
      px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255;
    }
  }

  // ── 2. Detect and dilate edges ────────────────────────────────────────────
  const radius = Math.max(0, Math.floor((borderThickness - 1) / 2));
  const rawEdges = buildEdgeMask(colorMap, width, height);
  const edges = radius > 0 ? dilateEdgeMask(rawEdges, width, height, radius) : rawEdges;

  const borderRgb = hexToRgb(borderColor);
  for (let i = 0; i < width * height; i++) {
    if (edges[i]) {
      px[i * 4]     = borderRgb.r;
      px[i * 4 + 1] = borderRgb.g;
      px[i * 4 + 2] = borderRgb.b;
      px[i * 4 + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // ── 3. Number labels ──────────────────────────────────────────────────────
  const colorNums = buildColorNumbers(palette);

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const region of regions) {
    if (region.area < minRegionSize) continue;

    const num = colorNums[region.colorIndex];

    // Use the user's chosen numberColor, but when showColors is on
    // override with an auto-contrast colour so labels remain legible.
    if (showColors) {
      const c = palette[region.colorIndex];
      ctx.fillStyle = luminance(c) > 0.55 ? '#111111' : '#eeeeee';
    } else {
      ctx.fillStyle = numberColor;
    }

    ctx.fillText(String(num), region.centroidX, region.centroidY);
  }
}

// ─── Colour-only preview (no outlines / numbers) ──────────────────────────────

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

// ─── Colour reference card (800 × 600) ───────────────────────────────────────

/**
 * Convert a Color (which may contain float values from k-means) to a valid
 * 6-digit CSS hex string. Values are rounded to the nearest integer first.
 */
export function toHex(c: Color): string {
  const r = Math.round(c.r), g = Math.round(c.g), b = Math.round(c.b);
  return '#' + r.toString(16).padStart(2, '0') +
               g.toString(16).padStart(2, '0') +
               b.toString(16).padStart(2, '0');
}

/**
 * Creates an 800 × 600 HTMLCanvasElement containing a paint-matching
 * reference card: one cell per palette colour showing a large swatch,
 * paint number, closest web colour name, and actual hex value.
 */
export function createColorReferenceCanvas(palette: Color[]): HTMLCanvasElement {
  const W = 800, H = 600;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, W, H);

  // ── Header ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, 54);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Paint Colour Reference', W / 2, 27);

  ctx.fillStyle = '#aaaacc';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${palette.length} colours`, W / 2, 46);

  const colorNums = buildColorNumbers(palette);

  // ── Grid geometry ───────────────────────────────────────────────────────────
  // Aim for roughly square cells; max 5 columns so names fit.
  const cols = Math.min(5, palette.length);
  const rows = Math.ceil(palette.length / cols);

  const marginX     = 16;
  const marginTop   = 62;
  const marginBot   = 24;
  const cellW = (W - marginX * 2) / cols;
  const cellH = Math.min(110, (H - marginTop - marginBot) / rows);

  const swatchH  = Math.round(cellH * 0.52);
  const swatchW  = Math.round(cellW - 16);

  // ── Draw each cell ──────────────────────────────────────────────────────────
  palette.forEach((color, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx  = marginX + col * cellW;
    const cy  = marginTop + row * cellH;

    const hex    = toHex(color);
    const web    = nearestWebColor(color);
    const num    = colorNums[i];
    const dark   = luminance(color) > 0.45;

    // Cell background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + 4, cy + 4, cellW - 8, cellH - 8);

    // Swatch
    const sx = cx + 8;
    const sy = cy + 8;
    ctx.fillStyle = hex;
    ctx.fillRect(sx, sy, swatchW, swatchH);

    // Number badge — inset top-left of swatch
    const bw = 22, bh = 18;
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(sx, sy, bw, bh);
    ctx.fillStyle = dark ? '#ffffff' : '#000000';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), sx + bw / 2, sy + bh / 2);

    // Web colour name
    const textY = sy + swatchH + 5;
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // Truncate if too wide
    const maxTW = cellW - 16;
    let nameStr = web.name;
    while (ctx.measureText(nameStr).width > maxTW && nameStr.length > 4) {
      nameStr = nameStr.slice(0, -1);
    }
    ctx.fillText(nameStr, sx, textY);

    // Actual hex
    ctx.fillStyle = '#666666';
    ctx.font = '9px monospace';
    ctx.fillText(hex.toUpperCase(), sx, textY + 13);
  });

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    'Generated by Paint by Numbers  ·  Web colour = closest CSS named colour',
    W / 2,
    H - 5,
  );

  return canvas;
}
