import type { Region } from '../types';

/**
 * Iterative 4-connected flood-fill to find all contiguous regions
 * sharing the same palette color index.
 */
export function findRegions(
  colorMap: Uint8Array,
  width: number,
  height: number,
): Region[] {
  const total = width * height;
  const visited = new Uint8Array(total); // 0 = unvisited
  const regions: Region[] = [];

  // Reusable stack array for flood-fill (avoids call-stack overflow)
  const stack: number[] = [];

  for (let start = 0; start < total; start++) {
    if (visited[start]) continue;

    const colorIndex = colorMap[start];
    const pixels: number[] = [];

    stack.push(start);
    visited[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      pixels.push(idx);

      const x = idx % width;
      const y = (idx - x) / width;

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

    // Centroid
    let sumX = 0, sumY = 0;
    for (const p of pixels) {
      sumX += p % width;
      sumY += (p - (p % width)) / width;
    }

    regions.push({
      colorIndex,
      pixels,
      centroidX: sumX / pixels.length,
      centroidY: sumY / pixels.length,
      area: pixels.length,
    });
  }

  return regions;
}
