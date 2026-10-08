import * as assert from 'assert';
import { hexToHsv } from '../src/core/color.js';
import { HARMONY_MODES, applyHarmony, generateHarmony } from '../src/core/harmony.js';
import { createRng } from '../src/core/random.js';

const hue = (hex: string): number => Math.round(hexToHsv(hex).h);

describe('harmonies', () => {
  it('always returns the requested number of colors with the base first', () => {
    for (const { id } of HARMONY_MODES) {
      for (const count of [1, 3, 5, 8]) {
        const colors = generateHarmony('#3366CC', id, count, createRng(1));
        assert.strictEqual(colors.length, count, `${id} x${count}`);
        assert.strictEqual(colors[0], '#3366CC');
        colors.forEach((c) => assert.match(c, /^#[0-9A-F]{6}$/));
      }
    }
  });

  it('computes hue based harmonies', () => {
    assert.deepStrictEqual(generateHarmony('#FF0000', 'complementary', 2).map(hue), [0, 180]);
    assert.deepStrictEqual(generateHarmony('#FF0000', 'triad', 3).map(hue), [0, 120, 240]);
    assert.deepStrictEqual(generateHarmony('#FF0000', 'square', 4).map(hue), [0, 90, 180, 270]);
    assert.deepStrictEqual(generateHarmony('#FF0000', 'split-complementary', 3).map(hue), [0, 150, 210]);
    assert.deepStrictEqual(generateHarmony('#FF0000', 'analogous', 3).map(hue), [0, 30, 330]);
  });

  it('keeps the hue for shades and monochromatic palettes', () => {
    for (const mode of ['shades', 'monochromatic'] as const) {
      generateHarmony('#3366CC', mode, 6).forEach((c) => assert.ok(Math.abs(hue(c) - 220) <= 2, `${mode} ${c}`));
    }
  });

  it('is deterministic for random palettes with a seeded rng', () => {
    assert.deepStrictEqual(
      generateHarmony('#3366CC', 'random', 5, createRng(7)),
      generateHarmony('#3366CC', 'random', 5, createRng(7))
    );
  });

  it('respects locked swatches and the base index', () => {
    const swatches = [
      { hex: '#111111', locked: false },
      { hex: '#222222', locked: true },
      { hex: '#333333', locked: false },
      { hex: '#444444', locked: false }
    ];
    const result = applyHarmony(swatches, 2, ['#AAAAAA', '#BBBBBB', '#CCCCCC', '#DDDDDD']);
    assert.deepStrictEqual(result.map((s) => s.hex), ['#BBBBBB', '#222222', '#AAAAAA', '#CCCCCC']);
    assert.strictEqual(swatches[0].hex, '#111111', 'input is not mutated');
  });
});
