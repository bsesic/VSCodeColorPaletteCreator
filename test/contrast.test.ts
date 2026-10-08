import * as assert from 'assert';
import { contrastRatio, rateContrast, relativeLuminance, suggestForeground } from '../src/core/contrast.js';
import { deltaE } from '../src/core/color.js';
import { simulateHex, VISION_TYPES } from '../src/core/blindness.js';

describe('contrast', () => {
  it('computes luminance and ratios', () => {
    assert.strictEqual(relativeLuminance('#FFFFFF'), 1);
    assert.strictEqual(relativeLuminance('#000000'), 0);
    assert.strictEqual(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.strictEqual(contrastRatio('#FFFFFF', '#000000'), 21);
    assert.ok(Math.abs(contrastRatio('#777777', '#FFFFFF') - 4.48) < 0.01);
  });

  it('rates WCAG levels', () => {
    const r = rateContrast('#767676', '#FFFFFF');
    assert.ok(r.aaNormal && r.aaLarge && !r.aaaNormal && r.aaaLarge && r.uiComponents);
    const bad = rateContrast('#CCCCCC', '#FFFFFF');
    assert.ok(!bad.aaNormal && !bad.aaLarge && !bad.uiComponents);
  });

  it('suggests a passing foreground', () => {
    const suggestion = suggestForeground('#AAAAFF', '#FFFFFF', 4.5);
    assert.ok(suggestion);
    assert.ok(contrastRatio(suggestion, '#FFFFFF') >= 4.5);
    assert.strictEqual(suggestForeground('#000000', '#FFFFFF'), '#000000');
  });
});

describe('color blindness simulation', () => {
  it('keeps colors for normal vision and grays', () => {
    assert.strictEqual(simulateHex('#3366CC', 'normal'), '#3366CC');
    for (const { id } of VISION_TYPES) {
      const gray = simulateHex('#808080', id);
      assert.ok(Math.abs(parseInt(gray.slice(1, 3), 16) - 128) <= 2, `${id} ${gray}`);
    }
  });

  it('makes red and green indistinguishable-ish for deuteranopia', () => {
    const red = simulateHex('#FF0000', 'deuteranopia');
    const green = simulateHex('#00FF00', 'deuteranopia');
    assert.ok(deltaE(red, green) < deltaE('#FF0000', '#00FF00') / 2);
    assert.notStrictEqual(red, '#FF0000');
  });

  it('produces grayscale for achromatopsia', () => {
    const c = simulateHex('#FF0000', 'achromatopsia');
    assert.strictEqual(c.slice(1, 3), c.slice(3, 5));
    assert.strictEqual(c.slice(3, 5), c.slice(5, 7));
  });
});
