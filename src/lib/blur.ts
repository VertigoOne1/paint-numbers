/**
 * Separable box-blur. Multiple passes approximate a Gaussian blur.
 * Returns a new Uint8ClampedArray with the blurred RGBA data.
 */
function boxBlurPass(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);

  // Horizontal
  const tmp = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      const count = 2 * radius + 1;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = Math.min(Math.max(x + dx, 0), width - 1);
        const i = (y * width + nx) * 4;
        r += src[i]; g += src[i + 1]; b += src[i + 2];
      }
      const j = (y * width + x) * 4;
      tmp[j]     = r / count;
      tmp[j + 1] = g / count;
      tmp[j + 2] = b / count;
      tmp[j + 3] = src[j + 3];
    }
  }

  // Vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      const count = 2 * radius + 1;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = Math.min(Math.max(y + dy, 0), height - 1);
        const i = (ny * width + x) * 4;
        r += tmp[i]; g += tmp[i + 1]; b += tmp[i + 2];
      }
      const j = (y * width + x) * 4;
      dst[j]     = r / count;
      dst[j + 1] = g / count;
      dst[j + 2] = b / count;
      dst[j + 3] = tmp[j + 3];
    }
  }

  return dst;
}

/**
 * Apply blur with `amount` 0–20.
 * Uses multiple box-blur passes with increasing radius to stay performant.
 */
export function applyBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): Uint8ClampedArray {
  if (amount === 0) return new Uint8ClampedArray(data);

  // Map amount (1-20) → passes × radius
  const passes = amount <= 6 ? 1 : amount <= 13 ? 2 : 3;
  const radius = Math.ceil(amount / passes);

  let current = data;
  for (let i = 0; i < passes; i++) {
    current = boxBlurPass(current, width, height, radius);
  }
  return current;
}
