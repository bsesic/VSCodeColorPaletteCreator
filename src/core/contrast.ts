/**
 * WCAG 2.x contrast calculations.
 */
import { hexToRgb, hexToHsl, hslToHex, srgbToLinear } from './color.js';

export interface WcagRating {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  uiComponents: boolean;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function rateContrast(foreground: string, background: string): WcagRating {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    uiComponents: ratio >= 3
  };
}

/**
 * Finds the foreground color with the same hue and saturation whose
 * lightness is closest to the original and reaches the target ratio.
 * Returns null if no lightness reaches the target.
 */
export function suggestForeground(foreground: string, background: string, target = 4.5): string | null {
  const hsl = hexToHsl(foreground);
  if (contrastRatio(foreground, background) >= target) {
    return hslToHex(hsl);
  }
  for (let delta = 1; delta <= 100; delta++) {
    for (const l of [hsl.l - delta, hsl.l + delta]) {
      if (l < 0 || l > 100) {
        continue;
      }
      const candidate = hslToHex({ ...hsl, l });
      if (contrastRatio(candidate, background) >= target) {
        return candidate;
      }
    }
  }
  return null;
}
