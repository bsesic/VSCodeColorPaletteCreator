import * as assert from 'assert';
import { EXPORT_FORMATS, camelCase, exportPalette, parsePaletteFile, slugify } from '../src/core/palette.js';

const palette = { name: 'Ocean Breeze', colors: ['#003049', '#d62828', '#F77F00'] };

describe('palette export', () => {
  it('creates identifiers', () => {
    assert.strictEqual(slugify('Ocean Breeze!'), 'ocean-breeze');
    assert.strictEqual(slugify('Über Grün'), 'uber-grun');
    assert.strictEqual(slugify('***'), 'palette');
    assert.strictEqual(camelCase('Ocean Breeze'), 'oceanBreeze');
    assert.strictEqual(camelCase('2024 colors'), 'palette2024Colors');
  });

  it('exports all formats', () => {
    for (const { id } of EXPORT_FORMATS) {
      const out = exportPalette(palette, id);
      assert.ok(out.includes('#D62828'), id);
    }
    assert.strictEqual(exportPalette(palette, 'css'),
      ':root {\n  --ocean-breeze-1: #003049;\n  --ocean-breeze-2: #D62828;\n  --ocean-breeze-3: #F77F00;\n}\n');
    assert.strictEqual(exportPalette(palette, 'scss').split('\n')[0], '$ocean-breeze-1: #003049;');
    assert.ok(exportPalette(palette, 'ts').startsWith('export const oceanBreeze = {'));
    assert.ok(exportPalette(palette, 'ts').includes('} as const;'));
    assert.deepStrictEqual(JSON.parse(exportPalette(palette, 'json')).colors, ['#003049', '#D62828', '#F77F00']);
    assert.ok(exportPalette(palette, 'gpl').includes('  0  48  73'));
  });

  it('imports palette files', () => {
    assert.deepStrictEqual(parsePaletteFile(exportPalette(palette, 'json')), {
      name: 'Ocean Breeze', colors: ['#003049', '#D62828', '#F77F00']
    });
    assert.deepStrictEqual(parsePaletteFile('["#fff", "nope", "#000000"]', 'X'), { name: 'X', colors: ['#FFFFFF', '#000000'] });
    assert.deepStrictEqual(parsePaletteFile(exportPalette(palette, 'css'), 'Y')?.colors.length, 3);
    assert.strictEqual(parsePaletteFile('nothing here'), null);
  });
});
