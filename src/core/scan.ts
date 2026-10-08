/**
 * Finds color codes in source text and re-formats colors in the notation
 * of the original code (used for inline color boxes and document editing).
 */
import { RGB, clamp, hexToRgb, hslToRgb, hsvToRgb, rgbToHex, rgbToHsl, rgbToHsv } from './color.js';

export interface RGBA extends RGB {
  /** Alpha 0..1 */
  a: number;
}

export type ScanFormat = 'hex' | 'rgb' | 'hsl' | 'hsv' | 'rgb-triplet';

export interface FoundColor {
  /** Offset of the first character in the scanned text. */
  start: number;
  /** Offset after the last character. */
  end: number;
  text: string;
  format: ScanFormat;
  color: RGBA;
  /** Name of the variable the color is assigned to, e.g. "--bs-primary" or "$primary". */
  name?: string;
}

export interface ScanOptions {
  /** Only report these formats (default: all). */
  formats?: ScanFormat[];
}

// Hex colors not preceded by a word character or "&" (HTML entities such as &#123;).
const HEX_RE = /(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FUNC_RE = /(?<![\w-])(rgba?|hsla?|hsva?)\(\s*([^()]*?)\s*\)/gi;
const TRIPLET_RE = /(--[\w-]*-rgb)(\s*:\s*)(\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3})(?![\d.])/g;
const NAME_RE = /(--[\w-]+|\$[\w-]+|@[\w-]+|[A-Za-z_][\w-]*)\s*[:=]\s*['"]?\s*$/;

/** Parses a number with optional percent sign. `percentBase` maps 100% to this value. */
function parseNumber(token: string, percentBase: number): number | null {
  const m = /^(-?\d*\.?\d+)(%|deg)?$/i.exec(token.trim());
  if (!m) {
    return null;
  }
  const value = parseFloat(m[1]);
  return m[2] === '%' ? (value / 100) * percentBase : value;
}

/** Splits function arguments in comma syntax ("1, 2, 3, .5") or space syntax ("1 2 3 / 50%"). */
function splitArgs(args: string): { parts: string[]; alpha?: string; comma: boolean } | null {
  const comma = args.includes(',');
  if (comma) {
    const parts = args.split(',').map((p) => p.trim());
    if (parts.length < 3 || parts.length > 4 || parts.some((p) => !p)) {
      return null;
    }
    return { parts: parts.slice(0, 3), alpha: parts[3], comma };
  }
  const [main, alpha, extra] = args.split('/').map((p) => p.trim());
  if (extra !== undefined) {
    return null;
  }
  const parts = main.split(/\s+/).filter(Boolean);
  return parts.length === 3 ? { parts, alpha, comma } : null;
}

function parseFunction(fn: string, args: string): RGBA | null {
  const split = splitArgs(args);
  if (!split) {
    return null;
  }
  const alpha = split.alpha === undefined ? 1 : parseNumber(split.alpha, 1);
  if (alpha === null) {
    return null;
  }
  const kind = fn.toLowerCase().slice(0, 3);
  const nums = split.parts.map((p, i) => parseNumber(p, kind === 'rgb' ? 255 : i === 0 ? 360 : 100));
  if (nums.some((n) => n === null)) {
    return null;
  }
  const [x, y, z] = nums as number[];
  let rgb: RGB;
  if (kind === 'rgb') {
    if ([x, y, z].some((v) => v < 0 || v > 255)) {
      return null;
    }
    rgb = { r: x, g: y, b: z };
  } else {
    if (y < 0 || y > 100 || z < 0 || z > 100) {
      return null;
    }
    rgb = kind === 'hsl' ? hslToRgb({ h: x, s: y, l: z }) : hsvToRgb({ h: x, s: y, v: z });
  }
  return { ...rgb, a: clamp(alpha, 0, 1) };
}

function parseHex(text: string): RGBA | null {
  const rgb = hexToRgb(text);
  if (!rgb) {
    return null;
  }
  const digits = text.slice(1);
  let a = 1;
  if (digits.length === 4) {
    a = parseInt(digits[3] + digits[3], 16) / 255;
  } else if (digits.length === 8) {
    a = parseInt(digits.slice(6), 16) / 255;
  }
  return { ...rgb, a };
}

/** Variable or property name directly in front of the color on the same line. */
function findName(text: string, start: number): string | undefined {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const before = text.slice(lineStart, start);
  return NAME_RE.exec(before)?.[1];
}

/** Returns true when a "#abc" match looks like a CSS id selector instead of a color. */
function looksLikeSelector(text: string, end: number): boolean {
  return /^(?:[.:#[>~+]|\s*\{)/.test(text.slice(end, end + 40));
}

export function findColors(text: string, options: ScanOptions = {}): FoundColor[] {
  const allowed = new Set<ScanFormat>(options.formats ?? ['hex', 'rgb', 'hsl', 'hsv', 'rgb-triplet']);
  const found: FoundColor[] = [];

  if (allowed.has('hex')) {
    for (const m of text.matchAll(HEX_RE)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const color = parseHex(m[0]);
      if (color && !looksLikeSelector(text, end)) {
        found.push({ start, end, text: m[0], format: 'hex', color, name: findName(text, start) });
      }
    }
  }
  for (const m of text.matchAll(FUNC_RE)) {
    const format = m[1].toLowerCase().slice(0, 3) as ScanFormat;
    if (!allowed.has(format)) {
      continue;
    }
    const color = parseFunction(m[1], m[2]);
    if (color) {
      const start = m.index ?? 0;
      found.push({ start, end: start + m[0].length, text: m[0], format, color, name: findName(text, start) });
    }
  }
  if (allowed.has('rgb-triplet')) {
    for (const m of text.matchAll(TRIPLET_RE)) {
      const values = m[3].split(',').map((v) => parseInt(v, 10));
      if (values.some((v) => v > 255)) {
        continue;
      }
      const start = (m.index ?? 0) + m[1].length + m[2].length;
      found.push({
        start, end: start + m[3].length, text: m[3], format: 'rgb-triplet',
        color: { r: values[0], g: values[1], b: values[2], a: 1 }, name: m[1]
      });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

const fmt = (value: number, digits = 2): string => String(Math.round(value * 10 ** digits) / 10 ** digits);

/** Grouping key of a color: "#RRGGBB" plus alpha byte when not opaque. */
export function colorKey(color: RGBA): string {
  const hex = rgbToHex(color);
  const alpha = Math.round(color.a * 255);
  return alpha >= 255 ? hex : hex + alpha.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Formats `color` in the same notation as `original` (format, letter case,
 * short hex, comma/space syntax, percentages, alpha and function name).
 */
export function formatLike(original: Pick<FoundColor, 'text' | 'format'>, color: RGBA): string {
  const hasAlpha = color.a < 0.9995;
  const text = original.text;
  switch (original.format) {
    case 'rgb-triplet':
      return `${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}`;
    case 'hex': {
      const digits = text.length - 1;
      const originalHasAlpha = digits === 4 || digits === 8;
      let hex = rgbToHex(color).slice(1);
      if (hasAlpha || originalHasAlpha) {
        hex += Math.round(color.a * 255).toString(16).padStart(2, '0');
      }
      const short = hex.length % 2 === 0 && hex.match(/../g)?.every((p) => p[0] === p[1]);
      if ((digits === 3 || digits === 4) && short) {
        hex = (hex.match(/../g) ?? []).map((p) => p[0]).join('');
      }
      // Lowercase unless the original uses uppercase letters.
      const lower = !/[A-F]/.test(text);
      return `#${lower ? hex.toLowerCase() : hex.toUpperCase()}`;
    }
    default: {
      const m = /^(\w+)\(\s*([^()]*?)\s*\)$/.exec(text);
      const fnName = m?.[1] ?? original.format;
      const split = splitArgs(m?.[2] ?? '') ?? { parts: ['', '', ''], comma: true, alpha: undefined };
      const percent = split.parts.map((p) => p.trim().endsWith('%'));
      const hueUnit = /deg$/i.test(split.parts[0]) ? 'deg' : '';
      let parts: string[];
      if (original.format === 'rgb') {
        parts = [color.r, color.g, color.b].map((v, i) => (percent[i] ? `${fmt((v / 255) * 100, 1)}%` : String(Math.round(v))));
      } else {
        const hsx = original.format === 'hsl' ? rgbToHsl(color) : rgbToHsv(color);
        const values = original.format === 'hsl' ? [hsx.h, (hsx as { s: number }).s, (hsx as { l: number }).l]
          : [hsx.h, (hsx as { s: number }).s, (hsx as { v: number }).v];
        parts = [`${Math.round(values[0])}${hueUnit}`, `${Math.round(values[1])}%`, `${Math.round(values[2])}%`];
      }
      const withAlpha = hasAlpha || split.alpha !== undefined;
      const alphaText = split.alpha?.trim().endsWith('%') ? `${fmt(color.a * 100, 0)}%` : fmt(color.a);
      let name = fnName;
      // Legacy comma syntax needs the "a" variant for alpha (rgb -> rgba).
      if (withAlpha && split.comma && !/a$/i.test(name)) {
        name += /[A-Z]/.test(fnName) ? 'A' : 'a';
      } else if (!withAlpha && /a$/i.test(name) && split.alpha === undefined) {
        name = name.slice(0, -1);
      }
      if (split.comma) {
        return `${name}(${[...parts, ...(withAlpha ? [alphaText] : [])].join(', ')})`;
      }
      return `${name}(${parts.join(' ')}${withAlpha ? ` / ${alphaText}` : ''})`;
    }
  }
}

/** Alternative notations offered in the color picker (current notation first). */
export function presentations(original: Pick<FoundColor, 'text' | 'format'>, color: RGBA): string[] {
  const options = [
    formatLike(original, color),
    formatLike({ format: 'hex', text: original.format === 'hex' ? original.text : '#FFFFFF' }, color),
    formatLike({ format: 'rgb', text: 'rgb(0, 0, 0)' }, color),
    formatLike({ format: 'hsl', text: 'hsl(0, 0%, 0%)' }, color),
    formatLike({ format: 'hsv', text: 'hsv(0, 0%, 0%)' }, color)
  ];
  return [...new Set(options)];
}

/** All occurrences of one color value in a document. */
export interface ColorGroup {
  key: string;
  /** "#RRGGBB" without alpha. */
  hex: string;
  alpha: number;
  count: number;
  /** Variable/property names the color is assigned to (unique, in order of appearance). */
  names: string[];
  /** 0-based line numbers of the occurrences. */
  lines: number[];
  /** Start and end offsets of the occurrences (same order as `lines`). */
  ranges: Array<[number, number]>;
  /** Variable/property name of each occurrence ('' if none, same order as `lines`). */
  occurrenceNames: string[];
  formats: ScanFormat[];
}

/** Groups found colors by value, most used first. */
export function groupColors(text: string, found: FoundColor[]): ColorGroup[] {
  const groups = new Map<string, ColorGroup & { first: number }>();
  let line = 0;
  let offset = 0;
  for (const f of found) {
    // Found colors are sorted, so line numbers can be counted incrementally.
    for (; offset < f.start; offset++) {
      if (text.charCodeAt(offset) === 10) {
        line++;
      }
    }
    const key = colorKey(f.color);
    let group = groups.get(key);
    if (!group) {
      group = {
        key, hex: rgbToHex(f.color), alpha: Math.round(f.color.a * 1000) / 1000,
        count: 0, names: [], lines: [], ranges: [], occurrenceNames: [], formats: [], first: f.start
      };
      groups.set(key, group);
    }
    group.count++;
    group.lines.push(line);
    group.ranges.push([f.start, f.end]);
    group.occurrenceNames.push(f.name ?? '');
    if (f.name && !group.names.includes(f.name)) {
      group.names.push(f.name);
    }
    if (!group.formats.includes(f.format)) {
      group.formats.push(f.format);
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map(({ first: _first, ...group }) => group);
}

export interface TextReplacement {
  start: number;
  end: number;
  text: string;
}

/**
 * Plans the text edits that change every occurrence of the color `key` to
 * `newColor` (keeping each occurrence's notation and alpha). `templates`
 * are the original texts of the occurrences from the first edit of a
 * session, so the notation (e.g. letter case) survives intermediate colors.
 */
export function planReplacement(
  text: string, key: string, newColor: RGB, templates?: string[]
): { edits: TextReplacement[]; newKey: string; originals: string[] } {
  const edits: TextReplacement[] = [];
  const matches = findColors(text).filter((f) => colorKey(f.color) === key);
  const useTemplates = templates && templates.length === matches.length;
  let newKey = key;
  matches.forEach((f, i) => {
    const color = { ...newColor, a: f.color.a };
    newKey = colorKey(color);
    const replacement = formatLike({ format: f.format, text: useTemplates ? templates[i] : f.text }, color);
    if (replacement !== f.text) {
      edits.push({ start: f.start, end: f.end, text: replacement });
    }
  });
  return { edits, newKey, originals: useTemplates ? templates : matches.map((f) => f.text) };
}
