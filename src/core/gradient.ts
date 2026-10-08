/**
 * Gradient interpolation and CSS generation.
 */
import { hexToRgb, oklabToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToOklab } from './color.js';

export type GradientType = 'linear' | 'radial' | 'conic';
export type InterpolationSpace = 'rgb' | 'hsl' | 'oklab';

export interface GradientStop {
  color: string;
  /** Position in percent (0..100). */
  position: number;
}

/** Interpolates between two colors in the given color space. */
export function interpolate(a: string, b: string, t: number, space: InterpolationSpace = 'oklab'): string {
  const ca = hexToRgb(a) ?? { r: 0, g: 0, b: 0 };
  const cb = hexToRgb(b) ?? { r: 0, g: 0, b: 0 };
  if (space === 'hsl') {
    const ha = rgbToHsl(ca);
    const hb = rgbToHsl(cb);
    let dh = hb.h - ha.h;
    if (dh > 180) { dh -= 360; }
    if (dh < -180) { dh += 360; }
    return rgbToHex(hslToRgb({
      h: ha.h + dh * t,
      s: ha.s + (hb.s - ha.s) * t,
      l: ha.l + (hb.l - ha.l) * t
    }));
  }
  if (space === 'oklab') {
    const la = rgbToOklab(ca);
    const lb = rgbToOklab(cb);
    return rgbToHex(oklabToRgb({
      L: la.L + (lb.L - la.L) * t,
      a: la.a + (lb.a - la.a) * t,
      b: la.b + (lb.b - la.b) * t
    }));
  }
  return rgbToHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}

/** Color of the gradient at position `pos` (0..100). Stops do not need to be sorted. */
export function colorAt(stops: GradientStop[], pos: number, space: InterpolationSpace = 'oklab'): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) {
    return '#000000';
  }
  if (pos <= sorted[0].position) {
    return sorted[0].color;
  }
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (pos <= next.position) {
      const span = next.position - prev.position;
      return interpolate(prev.color, next.color, span === 0 ? 0 : (pos - prev.position) / span, space);
    }
  }
  return sorted[sorted.length - 1].color;
}

/** `count` evenly spaced colors of the gradient. */
export function gradientSteps(stops: GradientStop[], count: number, space: InterpolationSpace = 'oklab'): string[] {
  const n = Math.max(2, count);
  return Array.from({ length: n }, (_, i) => colorAt(stops, (i / (n - 1)) * 100, space));
}

/** Evenly distributes the given colors as gradient stops. */
export function evenStops(colors: string[]): GradientStop[] {
  return colors.map((color, i) => ({
    color,
    position: colors.length <= 1 ? 0 : Math.round((i / (colors.length - 1)) * 1000) / 10
  }));
}

/**
 * Builds a CSS gradient. For non-RGB interpolation, intermediate stops are
 * added so browsers without `in oklab` support render the same result.
 */
export function toCssGradient(
  type: GradientType,
  angle: number,
  stops: GradientStop[],
  space: InterpolationSpace = 'oklab'
): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  let expanded = sorted;
  if (space !== 'rgb' && sorted.length > 1) {
    expanded = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      expanded.push(a);
      for (let k = 1; k < 4; k++) {
        const position = a.position + ((b.position - a.position) * k) / 4;
        expanded.push({ color: colorAt(sorted, position, space), position: Math.round(position * 10) / 10 });
      }
    }
    expanded.push(sorted[sorted.length - 1]);
  }
  const list = expanded.map((s) => `${s.color} ${s.position}%`).join(', ');
  switch (type) {
    case 'radial':
      return `radial-gradient(circle, ${list})`;
    case 'conic':
      return `conic-gradient(from ${angle}deg, ${list})`;
    default:
      return `linear-gradient(${angle}deg, ${list})`;
  }
}
