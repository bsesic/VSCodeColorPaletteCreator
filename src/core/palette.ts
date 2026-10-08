/**
 * Palette model and exporters to code formats.
 */
import { formatColor, hexToRgb, describeColor } from './color.js';

export interface Palette {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
  updatedAt: number;
}

export type ExportFormat = 'css' | 'scss' | 'less' | 'json' | 'tailwind' | 'js' | 'ts' | 'gpl' | 'txt';

export const EXPORT_FORMATS: Array<{ id: ExportFormat; label: string; extension: string }> = [
  { id: 'css', label: 'CSS variables', extension: 'css' },
  { id: 'scss', label: 'SCSS variables', extension: 'scss' },
  { id: 'less', label: 'LESS variables', extension: 'less' },
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'tailwind', label: 'Tailwind config', extension: 'js' },
  { id: 'js', label: 'JavaScript object', extension: 'js' },
  { id: 'ts', label: 'TypeScript const', extension: 'ts' },
  { id: 'gpl', label: 'GIMP palette', extension: 'gpl' },
  { id: 'txt', label: 'Plain HEX list', extension: 'txt' }
];

/** Converts a palette name to a kebab-case identifier ("My Palette!" -> "my-palette"). */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'palette';
}

/** Converts a palette name to a camelCase identifier usable in JS/TS. */
export function camelCase(name: string): string {
  const id = slugify(name).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  return /^[0-9]/.test(id) ? `palette${id}` : id;
}

export function exportPalette(palette: Pick<Palette, 'name' | 'colors'>, format: ExportFormat): string {
  const slug = slugify(palette.name);
  const colors = palette.colors.map((c) => formatColor(c, 'hex'));
  const keyed = colors.map((hex, i) => ({ key: `${(i + 1) * 100}`, hex }));
  switch (format) {
    case 'css':
      return `:root {\n${colors.map((c, i) => `  --${slug}-${i + 1}: ${c};`).join('\n')}\n}\n`;
    case 'scss':
      return `${colors.map((c, i) => `$${slug}-${i + 1}: ${c};`).join('\n')}\n`;
    case 'less':
      return `${colors.map((c, i) => `@${slug}-${i + 1}: ${c};`).join('\n')}\n`;
    case 'json':
      return `${JSON.stringify({ name: palette.name, colors }, null, 2)}\n`;
    case 'tailwind': {
      const body = keyed.map(({ key, hex }) => `          '${key}': '${hex}',`).join('\n');
      return `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n        '${slug}': {\n${body}\n        },\n      },\n    },\n  },\n};\n`;
    }
    case 'js':
    case 'ts': {
      const name = camelCase(palette.name);
      const body = colors.map((c, i) => `  color${i + 1}: '${c}',`).join('\n');
      return `export const ${name} = {\n${body}\n}${format === 'ts' ? ' as const' : ''};\n`;
    }
    case 'gpl': {
      const rows = colors.map((c) => {
        const { r, g, b } = hexToRgb(c) ?? { r: 0, g: 0, b: 0 };
        const pad = (v: number): string => String(v).padStart(3, ' ');
        return `${pad(r)} ${pad(g)} ${pad(b)}\t${describeColor(c)} ${c}`;
      });
      return `GIMP Palette\nName: ${palette.name}\nColumns: ${colors.length}\n#\n${rows.join('\n')}\n`;
    }
    default:
      return `${colors.join('\n')}\n`;
  }
}

/**
 * Parses an imported palette file: a JSON object { name, colors }, a JSON
 * array of colors, or any text containing hex colors.
 */
export function parsePaletteFile(text: string, fallbackName = 'Imported palette'): { name: string; colors: string[] } | null {
  const hexes = (values: unknown[]): string[] => values
    .filter((v): v is string => typeof v === 'string')
    .map((v) => hexToRgb(v) ? formatColor(v, 'hex') : '')
    .filter(Boolean);
  try {
    const json = JSON.parse(text) as unknown;
    if (Array.isArray(json)) {
      const colors = hexes(json);
      return colors.length ? { name: fallbackName, colors } : null;
    }
    if (json && typeof json === 'object') {
      const obj = json as { name?: unknown; colors?: unknown };
      const colors = Array.isArray(obj.colors) ? hexes(obj.colors) : [];
      if (colors.length) {
        return { name: typeof obj.name === 'string' && obj.name ? obj.name : fallbackName, colors };
      }
    }
  } catch {
    // Not JSON: fall back to scanning the text for hex colors.
  }
  const matches = text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
  const colors = hexes(matches);
  return colors.length ? { name: fallbackName, colors } : null;
}
