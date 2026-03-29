import type { Color, ProcessResult, Settings } from '../types';

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

function toHex(c: Color): string {
  return (
    '#' +
    c.r.toString(16).padStart(2, '0') +
    c.g.toString(16).padStart(2, '0') +
    c.b.toString(16).padStart(2, '0')
  );
}

/**
 * Creates an 800 × 600 HTMLCanvasElement containing a paint-matching
 * reference card: one numbered swatch per palette colour, with hex value.
 */
export function createColorReferenceCanvas(palette: Color[]): HTMLCanvasElement {
  const W = 800, H = 600;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Paint Colour Reference', W / 2, 30);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText(`${palette.length} colours`, W / 2, 50);

  const colorNums = buildColorNumbers(palette);

  // Grid layout
  const cols = palette.length <= 8 ? 4 : palette.length <= 15 ? 5 : 6;
  const rows = Math.ceil(palette.length / cols);

  const marginX = 24;
  const marginTop = 66;
  const marginBottom = 24;
  const cellW = (W - marginX * 2) / cols;
  const cellH = Math.min(90, (H - marginTop - marginBottom) / rows);

  const swatchSize = Math.min(cellH * 0.55, cellW * 0.55, 44);
  const padX = (cellW - swatchSize) / 2;
  const padY = (cellH - swatchSize - 22) / 2;

  palette.forEach((color, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * cellW;
    const y = marginTop + row * cellH;

    // Swatch
    const sx = x + padX;
    const sy = y + padY;
    ctx.fillStyle = toHex(color);
    ctx.fillRect(sx, sy, swatchSize, swatchSize);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, swatchSize, swatchSize);

    // Number badge (top-left of swatch)
    const badgeSize = 18;
    ctx.fillStyle = luminance(color) > 0.55 ? '#333333' : '#ffffff';
    ctx.font = `bold 11px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(colorNums[i]), sx + badgeSize / 2, sy + badgeSize / 2);

    // Hex label
    ctx.fillStyle = '#444444';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(toHex(color).toUpperCase(), x + cellW / 2, sy + swatchSize + 4);
  });

  // Footer
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Generated by Paint by Numbers — match these swatches when purchasing paint', W / 2, H - 6);

  return canvas;
}
