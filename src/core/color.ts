/**
 * Pure color math: parsing, formatting and conversions between
 * HEX, RGB, HSL, HSV and OKLab. All functions are side-effect free so they
 * can be shared between the extension host and the webview.
 */

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }
export interface HSV { h: number; s: number; v: number }
export interface OKLab { L: number; a: number; b: number }

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Normalizes a hue angle into the range [0, 360). */
export const wrapHue = (h: number): number => ((h % 360) + 360) % 360;

const round = (value: number, digits = 0): number => {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
};

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (c: number): string => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** Parses #RGB, #RRGGBB or #RRGGBBAA (alpha is ignored). Returns null when invalid. */
export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3,4}$/i.test(h)) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) {
    return null;
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return { h: wrapHue(h), s: clamp(s * 100, 0, 100), l: clamp(l * 100, 0, 100) };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = wrapHue(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] = sectorRgb(hp, c, x);
  const m = ln - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const { h } = rgbToHsl({ r, g, b });
  return { h: d === 0 ? 0 : h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const c = vn * sn;
  const hp = wrapHue(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] = sectorRgb(hp, c, x);
  const m = vn - c;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

function sectorRgb(hp: number, c: number, x: number): [number, number, number] {
  if (hp < 1) { return [c, x, 0]; }
  if (hp < 2) { return [x, c, 0]; }
  if (hp < 3) { return [0, c, x]; }
  if (hp < 4) { return [0, x, c]; }
  if (hp < 5) { return [x, 0, c]; }
  return [c, 0, x];
}

/** Converts an sRGB channel (0..255) to linear light (0..1). */
export function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** Converts linear light (0..1) back to an sRGB channel (0..255). */
export function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clamp(v * 255, 0, 255);
}

export function rgbToOklab({ r, g, b }: RGB): OKLab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  };
}

export function oklabToRgb({ L, a, b }: OKLab): RGB {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  };
}

export const hexToHsl = (hex: string): HSL => rgbToHsl(hexToRgb(hex) ?? { r: 0, g: 0, b: 0 });
export const hexToHsv = (hex: string): HSV => rgbToHsv(hexToRgb(hex) ?? { r: 0, g: 0, b: 0 });
export const hslToHex = (hsl: HSL): string => rgbToHex(hslToRgb(hsl));
export const hsvToHex = (hsv: HSV): string => rgbToHex(hsvToRgb(hsv));

/**
 * Parses any supported CSS-like color notation:
 * #hex, rgb()/rgba(), hsl()/hsla(), hsv() and bare 6-digit hex.
 * Returns a normalized uppercase #RRGGBB string or null.
 */
export function parseColor(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (/^#?[0-9a-f]{3,8}$/.test(text)) {
    const rgb = hexToRgb(text);
    return rgb ? rgbToHex(rgb) : null;
  }
  const fn = /^(rgba?|hsla?|hsv)\(([^)]*)\)$/.exec(text);
  if (!fn) {
    return null;
  }
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean).map((p) => parseFloat(p));
  if (parts.length < 3 || parts.slice(0, 3).some((p) => Number.isNaN(p))) {
    return null;
  }
  const [a, b, c] = parts;
  switch (fn[1]) {
    case 'rgb':
    case 'rgba':
      return rgbToHex({ r: a, g: b, b: c });
    case 'hsl':
    case 'hsla':
      return hslToHex({ h: a, s: b, l: c });
    default:
      return hsvToHex({ h: a, s: b, v: c });
  }
}

export const isValidColor = (input: string): boolean => parseColor(input) !== null;

/** Formats a hex color in the given notation. */
export function formatColor(hex: string, format: ColorFormat): string {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  switch (format) {
    case 'rgb':
      return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
    case 'hsl': {
      const { h, s, l } = rgbToHsl(rgb);
      return `hsl(${round(h)}, ${round(s)}%, ${round(l)}%)`;
    }
    case 'hsv': {
      const { h, s, v } = rgbToHsv(rgb);
      return `hsv(${round(h)}, ${round(s)}%, ${round(v)}%)`;
    }
    default:
      return rgbToHex(rgb);
  }
}

/** Linear mix of two colors in sRGB; t = 0 returns a, t = 1 returns b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a) ?? { r: 0, g: 0, b: 0 };
  const cb = hexToRgb(b) ?? { r: 0, g: 0, b: 0 };
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t
  });
}

/** Returns the color with its HSL lightness set to the given value (0..100). */
export function withLightness(hex: string, lightness: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(lightness, 0, 100) });
}

/** Shifts the HSL lightness by the given amount (-100..100). */
export function adjustLightness(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return withLightness(hex, hsl.l + amount);
}

/**
 * Creates a tint/shade scale of the color: `count` steps from a dark shade
 * through the color itself to a light tint (mixing with black and white).
 */
export function tintShadeScale(hex: string, count = 9): string[] {
  const n = Math.max(3, count);
  const mid = (n - 1) / 2;
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < mid) {
      result.push(mix('#000000', hex, 0.2 + (0.8 * i) / mid));
    } else if (i > mid) {
      result.push(mix(hex, '#FFFFFF', (0.8 * (i - mid)) / mid));
    } else {
      result.push(rgbToHex(hexToRgb(hex) ?? { r: 0, g: 0, b: 0 }));
    }
  }
  return result;
}

/** Perceptual distance between two colors (Euclidean distance in OKLab). */
export function deltaE(a: string, b: string): number {
  const la = rgbToOklab(hexToRgb(a) ?? { r: 0, g: 0, b: 0 });
  const lb = rgbToOklab(hexToRgb(b) ?? { r: 0, g: 0, b: 0 });
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b);
}

/** Picks black or white, whichever is more readable on the given background. */
export function readableTextColor(background: string): string {
  const { r, g, b } = hexToRgb(background) ?? { r: 0, g: 0, b: 0 };
  const lum = 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  return lum > 0.179 ? '#000000' : '#FFFFFF';
}

const NAMED_HUES: Array<[number, string]> = [
  [15, 'Red'], [45, 'Orange'], [70, 'Yellow'], [150, 'Green'], [190, 'Cyan'],
  [260, 'Blue'], [290, 'Violet'], [335, 'Magenta'], [360, 'Red']
];

/** Rough human readable name, e.g. "Dark Blue" or "Light Gray". Useful for variable names. */
export function describeColor(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  if (l < 6) { return 'Black'; }
  if (l > 96) { return 'White'; }
  const tone = l < 30 ? 'Dark ' : l > 72 ? 'Light ' : '';
  if (s < 10) { return `${tone}Gray`; }
  const hue = NAMED_HUES.find(([limit]) => h < limit)?.[1] ?? 'Red';
  return `${tone}${hue}`;
}
