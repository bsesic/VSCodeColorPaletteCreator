/**
 * Color vision deficiency simulation based on Machado, Oliveira and
 * Fernandes (2009). Matrices are applied in linear RGB. Anomalous
 * trichromacy is approximated by blending with the identity matrix.
 */
import { RGB, hexToRgb, linearToSrgb, rgbToHex, srgbToLinear } from './color.js';

export type VisionType =
  | 'normal'
  | 'protanopia'
  | 'protanomaly'
  | 'deuteranopia'
  | 'deuteranomaly'
  | 'tritanopia'
  | 'tritanomaly'
  | 'achromatopsia'
  | 'achromatomaly';

export const VISION_TYPES: Array<{ id: VisionType; label: string; description: string }> = [
  { id: 'normal', label: 'Normal vision', description: 'Trichromatic vision' },
  { id: 'protanopia', label: 'Protanopia', description: 'No red cones (~1% of men)' },
  { id: 'protanomaly', label: 'Protanomaly', description: 'Weak red cones (~1% of men)' },
  { id: 'deuteranopia', label: 'Deuteranopia', description: 'No green cones (~1% of men)' },
  { id: 'deuteranomaly', label: 'Deuteranomaly', description: 'Weak green cones (~5% of men)' },
  { id: 'tritanopia', label: 'Tritanopia', description: 'No blue cones (rare)' },
  { id: 'tritanomaly', label: 'Tritanomaly', description: 'Weak blue cones (rare)' },
  { id: 'achromatopsia', label: 'Achromatopsia', description: 'No color vision (very rare)' },
  { id: 'achromatomaly', label: 'Achromatomaly', description: 'Weak color vision (very rare)' }
];

type Matrix = [number, number, number, number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const PROTAN: Matrix = [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998];
const DEUTAN: Matrix = [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881];
const TRITAN: Matrix = [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039];
const ACHROMA: Matrix = [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722];

const blend = (m: Matrix, severity: number): Matrix =>
  m.map((v, i) => IDENTITY[i] + (v - IDENTITY[i]) * severity) as Matrix;

const MATRICES: Record<VisionType, Matrix> = {
  normal: IDENTITY,
  protanopia: PROTAN,
  protanomaly: blend(PROTAN, 0.6),
  deuteranopia: DEUTAN,
  deuteranomaly: blend(DEUTAN, 0.6),
  tritanopia: TRITAN,
  tritanomaly: blend(TRITAN, 0.6),
  achromatopsia: ACHROMA,
  achromatomaly: blend(ACHROMA, 0.6)
};

export function simulateRgb(rgb: RGB, type: VisionType): RGB {
  const m = MATRICES[type];
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    r: linearToSrgb(m[0] * r + m[1] * g + m[2] * b),
    g: linearToSrgb(m[3] * r + m[4] * g + m[5] * b),
    b: linearToSrgb(m[6] * r + m[7] * g + m[8] * b)
  };
}

export function simulateHex(hex: string, type: VisionType): string {
  return rgbToHex(simulateRgb(hexToRgb(hex) ?? { r: 0, g: 0, b: 0 }, type));
}

/** Simulates the vision type on RGBA pixel data in place. */
export function simulatePixels(data: Uint8ClampedArray, type: VisionType): void {
  if (type === 'normal') {
    return;
  }
  const m = MATRICES[type];
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = srgbToLinear(i);
  }
  for (let i = 0; i < data.length; i += 4) {
    const r = lut[data[i]];
    const g = lut[data[i + 1]];
    const b = lut[data[i + 2]];
    data[i] = linearToSrgb(m[0] * r + m[1] * g + m[2] * b);
    data[i + 1] = linearToSrgb(m[3] * r + m[4] * g + m[5] * b);
    data[i + 2] = linearToSrgb(m[6] * r + m[7] * g + m[8] * b);
  }
}
