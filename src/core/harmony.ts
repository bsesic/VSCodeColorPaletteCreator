/**
 * Palette generation based on color harmonies on the HSV color wheel.
 */
import { clamp, hexToHsv, hsvToHex, wrapHue } from './color.js';
import { Rng } from './random.js';

export type HarmonyMode =
  | 'custom'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triad'
  | 'square'
  | 'compound'
  | 'shades'
  | 'monochromatic'
  | 'random';

export const HARMONY_MODES: Array<{ id: HarmonyMode; label: string }> = [
  { id: 'custom', label: 'Custom' },
  { id: 'analogous', label: 'Analogous' },
  { id: 'complementary', label: 'Complementary' },
  { id: 'split-complementary', label: 'Split Complementary' },
  { id: 'triad', label: 'Triad' },
  { id: 'square', label: 'Square' },
  { id: 'compound', label: 'Compound' },
  { id: 'shades', label: 'Shades' },
  { id: 'monochromatic', label: 'Monochromatic' },
  { id: 'random', label: 'Random' }
];

/** Hue offsets (degrees) relative to the base color for the hue based harmonies. */
const HUE_OFFSETS: Partial<Record<HarmonyMode, number[]>> = {
  analogous: [0, 30, -30, 60, -60],
  complementary: [0, 180],
  'split-complementary': [0, 150, 210],
  triad: [0, 120, 240],
  square: [0, 90, 180, 270],
  compound: [0, 30, 180, 150, 210]
};

/**
 * Generates `count` colors for the given harmony. The base color is always
 * the first entry. When a harmony has fewer hues than requested colors, the
 * extra colors are lighter/darker variations of the harmony hues.
 */
export function generateHarmony(
  baseHex: string,
  mode: HarmonyMode,
  count: number,
  rng: Rng = Math.random
): string[] {
  const base = hexToHsv(baseHex);
  const n = Math.max(1, count);
  const out: string[] = [hsvToHex(base)];

  if (mode === 'shades') {
    // Same hue and saturation, varying brightness.
    for (let i = 1; i < n; i++) {
      const v = wrapRange(base.v - (i * 70) / n, 15, 100);
      out.push(hsvToHex({ ...base, v }));
    }
    return out;
  }
  if (mode === 'monochromatic') {
    // Same hue, varying saturation and brightness.
    for (let i = 1; i < n; i++) {
      const s = wrapRange(base.s - (i * 55) / n, 10, 100);
      const v = wrapRange(base.v + (i % 2 === 0 ? -1 : 1) * (12 + (i * 40) / n), 20, 100);
      out.push(hsvToHex({ h: base.h, s, v }));
    }
    return out;
  }
  if (mode === 'random') {
    for (let i = 1; i < n; i++) {
      out.push(hsvToHex({ h: rng() * 360, s: 35 + rng() * 60, v: 40 + rng() * 60 }));
    }
    return out;
  }

  const offsets = HUE_OFFSETS[mode] ?? [0];
  for (let i = 1; i < n; i++) {
    const offset = offsets[i % offsets.length];
    const cycle = Math.floor(i / offsets.length);
    const h = wrapHue(base.h + offset);
    if (cycle === 0) {
      out.push(hsvToHex({ h, s: base.s, v: base.v }));
    } else {
      // Repeated hue: alternate between a lighter and a darker variation.
      const direction = cycle % 2 === 1 ? -1 : 1;
      const step = 20 * Math.ceil(cycle / 2);
      out.push(hsvToHex({
        h,
        s: clamp(base.s + direction * step * 0.5, 10, 100),
        v: clamp(base.v - direction * step, 15, 100)
      }));
    }
  }
  return out;
}

/** Keeps a value inside [min, max] by mirroring it back into the range. */
function wrapRange(value: number, min: number, max: number): number {
  const span = max - min;
  let v = value - min;
  v = ((v % (2 * span)) + 2 * span) % (2 * span);
  return min + (v > span ? 2 * span - v : v);
}

/**
 * Applies generated harmony colors to a palette while respecting locked
 * swatches. The base color stays at `baseIndex`; the remaining generated
 * colors fill the unlocked slots in order.
 */
export function applyHarmony<T extends { hex: string; locked: boolean }>(
  swatches: T[],
  baseIndex: number,
  generated: string[]
): T[] {
  const result = swatches.map((s) => ({ ...s }));
  const rest = generated.slice(1);
  let next = 0;
  result.forEach((swatch, i) => {
    if (i === baseIndex) {
      if (!swatch.locked) {
        swatch.hex = generated[0];
      }
    } else if (!swatch.locked && next < rest.length) {
      swatch.hex = rest[next++];
    }
  });
  return result;
}
