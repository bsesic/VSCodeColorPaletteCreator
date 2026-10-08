/**
 * Color extraction from raw RGBA pixel data (k-means clustering and
 * sampling along a line for gradients).
 */
import { RGB, rgbToHex } from './color.js';
import { Rng, createRng } from './random.js';

export interface ImageData2D {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ExtractedColor {
  hex: string;
  /** Share of sampled pixels belonging to this cluster (0..1). */
  weight: number;
  /** Pixel position whose color is closest to the cluster center. */
  x: number;
  y: number;
}

export interface ExtractOptions {
  /** Maximum number of pixels used for clustering. */
  maxSamples?: number;
  maxIterations?: number;
  seed?: number;
}

interface Sample { r: number; g: number; b: number; x: number; y: number }

const dist2 = (a: RGB, b: RGB): number =>
  (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;

function collectSamples(img: ImageData2D, maxSamples: number): Sample[] {
  const total = img.width * img.height;
  const step = Math.max(1, Math.floor(Math.sqrt(total / maxSamples)));
  const samples: Sample[] = [];
  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] < 128) {
        continue; // Skip transparent pixels.
      }
      samples.push({ r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], x, y });
    }
  }
  return samples;
}

/** k-means++ initialization for deterministic, well spread centers. */
function initCenters(samples: Sample[], k: number, rng: Rng): RGB[] {
  const first = samples[Math.floor(rng() * samples.length)];
  const centers: RGB[] = [{ r: first.r, g: first.g, b: first.b }];
  const d = samples.map((s) => dist2(s, centers[0]));
  while (centers.length < k) {
    const sum = d.reduce((acc, v) => acc + v, 0);
    if (sum === 0) {
      break; // Fewer distinct colors than requested.
    }
    let target = rng() * sum;
    let idx = 0;
    while (idx < d.length - 1 && target > d[idx]) {
      target -= d[idx++];
    }
    const s = samples[idx];
    const c = { r: s.r, g: s.g, b: s.b };
    centers.push(c);
    samples.forEach((p, i) => { d[i] = Math.min(d[i], dist2(p, c)); });
  }
  return centers;
}

/** Extracts the `k` dominant colors of an image, sorted by weight (descending). */
export function extractPalette(img: ImageData2D, k: number, options: ExtractOptions = {}): ExtractedColor[] {
  const samples = collectSamples(img, options.maxSamples ?? 20000);
  if (samples.length === 0 || k < 1) {
    return [];
  }
  const rng = createRng(options.seed ?? 42);
  const centers = initCenters(samples, Math.min(k, samples.length), rng);
  const assign = new Int32Array(samples.length);
  const maxIterations = options.maxIterations ?? 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    samples.forEach((s, i) => {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, j) => {
        const dd = dist2(s, c);
        if (dd < bestD) { bestD = dd; best = j; }
      });
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    });
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    samples.forEach((s, i) => {
      const acc = sums[assign[i]];
      acc.r += s.r; acc.g += s.g; acc.b += s.b; acc.n++;
    });
    sums.forEach((acc, j) => {
      if (acc.n > 0) {
        centers[j] = { r: acc.r / acc.n, g: acc.g / acc.n, b: acc.b / acc.n };
      }
    });
    if (!changed && iter > 0) {
      break;
    }
  }

  const result = centers.map((c, j) => {
    let n = 0;
    let nearest = samples[0];
    let nearestD = Infinity;
    samples.forEach((s, i) => {
      if (assign[i] !== j) { return; }
      n++;
      const dd = dist2(s, c);
      if (dd < nearestD) { nearestD = dd; nearest = s; }
    });
    return { hex: rgbToHex(c), weight: n / samples.length, x: nearest.x, y: nearest.y };
  });
  return result.filter((c) => c.weight > 0).sort((a, b) => b.weight - a.weight);
}

/** Average color of the square area of `radius` pixels around (x, y). */
export function sampleAt(img: ImageData2D, x: number, y: number, radius = 0): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let yy = cy - radius; yy <= cy + radius; yy++) {
    for (let xx = cx - radius; xx <= cx + radius; xx++) {
      if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) {
        continue;
      }
      const i = (yy * img.width + xx) * 4;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
  }
  return n === 0 ? '#000000' : rgbToHex({ r: r / n, g: g / n, b: b / n });
}

/** Samples `steps` evenly spaced colors along the line from (x0, y0) to (x1, y1). */
export function sampleLine(
  img: ImageData2D, x0: number, y0: number, x1: number, y1: number, steps: number, radius = 1
): string[] {
  const n = Math.max(2, steps);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(sampleAt(img, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius));
  }
  return out;
}
