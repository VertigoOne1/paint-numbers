import type { Region } from '../types';

/**
 * Iterative 4-connected flood-fill to find all contiguous regions
 * sharing the same palette colour index.
 *
 * Computes centroid and area on the fly — no per-pixel storage needed,
 * keeping memory use proportional to O(width × height) not O(regions × pixels).
 */
export function findRegions(
  colorMap: Uint8Array,
  width: number,
  height: number,
): Region[] {
  const total = width * height;
  const visited = new Uint8Array(total);
  const regions: Region[] = [];

  // Reusable stack (avoids call-stack overflow on large images)
  const stack: number[] = [];

  for (let start = 0; start < total; start++) {
    if (visited[start]) continue;

    const colorIndex = colorMap[start];
    let sumX = 0, sumY = 0, area = 0;

    stack.push(start);
    visited[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = (idx - x) / width;

      sumX += x;
      sumY += y;
      area++;

      // 4-neighbours
      if (y > 0) {
        const n = idx - width;
        if (!visited[n] && colorMap[n] === colorIndex) { visited[n] = 1; stack.push(n); }
      }
      if (y < height - 1) {
        const n = idx + width;
        if (!visited[n] && colorMap[n] === colorIndex) { visited[n] = 1; stack.push(n); }
      }
      if (x > 0) {
        const n = idx - 1;
        if (!visited[n] && colorMap[n] === colorIndex) { visited[n] = 1; stack.push(n); }
      }
      if (x < width - 1) {
        const n = idx + 1;
        if (!visited[n] && colorMap[n] === colorIndex) { visited[n] = 1; stack.push(n); }
      }
    }

    regions.push({
      colorIndex,
      centroidX: sumX / area,
      centroidY: sumY / area,
      area,
    });
  }

  return regions;
}
