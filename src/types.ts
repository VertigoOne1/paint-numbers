export interface Color {
  r: number;
  g: number;
  b: number;
}

export interface Region {
  colorIndex: number;
  /** Flat pixel indices within the image */
  pixels: number[];
  centroidX: number;
  centroidY: number;
  area: number;
}

export interface ProcessResult {
  /** Per-pixel color index (length = width * height) */
  colorMap: Uint8Array;
  regions: Region[];
  palette: Color[];
  width: number;
  height: number;
}

export type Algorithm = 'kmeans' | 'mediancut';

export interface Settings {
  numColors: number;
  algorithm: Algorithm;
  /** 0 = none, 20 = maximum simplification blur */
  blur: number;
  /** Minimum pixel area for a region to receive a number label */
  minRegionSize: number;
  /** Show palette colours in preview vs pure line-art */
  showColors: boolean;
}
