export interface Color {
  r: number;
  g: number;
  b: number;
}

export interface Region {
  colorIndex: number;
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

export type FontSize = 8 | 10 | 12 | 14;

export interface Settings {
  numColors: number;
  algorithm: Algorithm;
  /** 0 = none, 20 = maximum simplification blur */
  blur: number;
  /** Minimum pixel area for a region to receive a number label */
  minRegionSize: number;
  /** Show palette colours in preview vs pure line-art */
  showColors: boolean;
  /** Border line thickness in pixels (1–8) */
  borderThickness: number;
  /** CSS hex colour for region borders, e.g. '#cccccc' */
  borderColor: string;
  /** Fixed font size for number labels */
  fontSize: FontSize;
  /** CSS hex colour for number labels */
  numberColor: string;
}
