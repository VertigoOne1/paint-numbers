import type { Color } from '../types';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function colorDistSq(a: Color, b: Color): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function nearestIndex(color: Color, palette: Color[]): number {
  let minD = Infinity, idx = 0;
  for (let i = 0; i < palette.length; i++) {
    const d = colorDistSq(color, palette[i]);
    if (d < minD) { minD = d; idx = i; }
  }
  return idx;
}

/** Sample at most `maxSamples` pixels evenly from the image data. */
function samplePixels(data: Uint8ClampedArray, maxSamples: number): Color[] {
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / maxSamples));
  const out: Color[] = [];
  for (let i = 0; i < total; i += step) {
    out.push({ r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] });
  }
  return out;
}

// ─── K-Means ───────────────────────────────────────────────────────────────────

/** K-means++ initialisation for better centroid seeds. */
function kMeansPPInit(samples: Color[], k: number): Color[] {
  const centroids: Color[] = [{ ...samples[Math.floor(Math.random() * samples.length)] }];

  while (centroids.length < k) {
    const dists = samples.map(p => {
      let minD = Infinity;
      for (const c of centroids) {
        const d = colorDistSq(p, c);
        if (d < minD) minD = d;
      }
      return minD;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let rnd = Math.random() * total;
    for (let i = 0; i < dists.length; i++) {
      rnd -= dists[i];
      if (rnd <= 0) { centroids.push({ ...samples[i] }); break; }
    }
    // Guard against floating-point edge case
    if (centroids.length < k) centroids.push({ ...samples[samples.length - 1] });
  }

  return centroids;
}

export function kMeans(data: Uint8ClampedArray, k: number, maxIter = 25): Color[] {
  const samples = samplePixels(data, 15_000);
  const centroids = kMeansPPInit(samples, k);

  for (let iter = 0; iter < maxIter; iter++) {
    const sums = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, n: 0 }));

    for (const p of samples) {
      const idx = nearestIndex(p, centroids);
      sums[idx].r += p.r; sums[idx].g += p.g; sums[idx].b += p.b; sums[idx].n++;
    }

    let moved = false;
    for (let i = 0; i < k; i++) {
      if (sums[i].n === 0) continue;
      const nr = sums[i].r / sums[i].n;
      const ng = sums[i].g / sums[i].n;
      const nb = sums[i].b / sums[i].n;
      if (
        Math.abs(nr - centroids[i].r) > 0.5 ||
        Math.abs(ng - centroids[i].g) > 0.5 ||
        Math.abs(nb - centroids[i].b) > 0.5
      ) moved = true;
      centroids[i] = { r: nr, g: ng, b: nb };
    }
    if (!moved) break;
  }

  return centroids;
}

// ─── Median Cut ────────────────────────────────────────────────────────────────

interface Bucket { colors: Color[] }

function bucketSplit(bucket: Bucket): [Bucket, Bucket] {
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
  for (const c of bucket.colors) {
    if (c.r < minR) minR = c.r; if (c.r > maxR) maxR = c.r;
    if (c.g < minG) minG = c.g; if (c.g > maxG) maxG = c.g;
    if (c.b < minB) minB = c.b; if (c.b > maxB) maxB = c.b;
  }
  const rr = maxR - minR, rg = maxG - minG, rb = maxB - minB;
  const ch: keyof Color = rr >= rg && rr >= rb ? 'r' : rg >= rb ? 'g' : 'b';
  const sorted = [...bucket.colors].sort((a, b) => a[ch] - b[ch]);
  const mid = Math.floor(sorted.length / 2);
  return [{ colors: sorted.slice(0, mid) }, { colors: sorted.slice(mid) }];
}

function bucketAvg(bucket: Bucket): Color {
  let r = 0, g = 0, b = 0;
  for (const c of bucket.colors) { r += c.r; g += c.g; b += c.b; }
  const n = bucket.colors.length;
  return { r: r / n, g: g / n, b: b / n };
}

export function medianCut(data: Uint8ClampedArray, k: number): Color[] {
  const samples = samplePixels(data, 20_000);
  let buckets: Bucket[] = [{ colors: samples }];

  while (buckets.length < k) {
    // Split the largest bucket
    let maxLen = 0, splitIdx = 0;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].colors.length > maxLen) { maxLen = buckets[i].colors.length; splitIdx = i; }
    }
    if (maxLen < 2) break;
    const [left, right] = bucketSplit(buckets[splitIdx]);
    buckets.splice(splitIdx, 1, left, right);
  }

  return buckets.map(bucketAvg);
}

// ─── Map every pixel to its nearest palette entry ─────────────────────────────

export function buildColorMap(data: Uint8ClampedArray, palette: Color[]): Uint8Array {
  const pixelCount = data.length / 4;
  const map = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    map[i] = nearestIndex({ r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] }, palette);
  }
  return map;
}
