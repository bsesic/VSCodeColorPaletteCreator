import * as assert from 'assert';
import {
  adjustLightness, deltaE, describeColor, formatColor, hexToRgb, hslToHex, hsvToHex,
  mix, oklabToRgb, parseColor, readableTextColor, rgbToHex, rgbToHsl, rgbToHsv, rgbToOklab,
  tintShadeScale
} from '../src/core/color.js';

describe('color conversions', () => {
  it('parses and formats hex', () => {
    assert.deepStrictEqual(hexToRgb('#ff8000'), { r: 255, g: 128, b: 0 });
    assert.deepStrictEqual(hexToRgb('0f0'), { r: 0, g: 255, b: 0 });
    assert.deepStrictEqual(hexToRgb('#11223344'), { r: 17, g: 34, b: 51 });
    assert.strictEqual(hexToRgb('#xyz'), null);
    assert.strictEqual(rgbToHex({ r: 255, g: 128, b: 0 }), '#FF8000');
    assert.strictEqual(rgbToHex({ r: 300, g: -5, b: 12.6 }), '#FF000D');
  });

  it('converts between RGB and HSL', () => {
    assert.deepStrictEqual(rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
    assert.strictEqual(hslToHex({ h: 120, s: 100, l: 25 }), '#008000');
    assert.strictEqual(hslToHex({ h: 210, s: 50, l: 60 }), '#6699CC');
  });

  it('converts between RGB and HSV', () => {
    const hsv = rgbToHsv({ r: 0, g: 0, b: 255 });
    assert.deepStrictEqual(hsv, { h: 240, s: 100, v: 100 });
    assert.strictEqual(hsvToHex({ h: 60, s: 100, v: 100 }), '#FFFF00');
    assert.strictEqual(hsvToHex({ h: 0, s: 0, v: 50 }), '#808080');
  });

  it('round-trips through OKLab', () => {
    for (const hex of ['#123456', '#FF0000', '#FFFFFF', '#000000', '#7FC1A0']) {
      const rgb = hexToRgb(hex);
      assert.ok(rgb);
      assert.strictEqual(rgbToHex(oklabToRgb(rgbToOklab(rgb))), hex);
    }
  });

  it('parses CSS color notations', () => {
    assert.strictEqual(parseColor('rgb(255, 0, 0)'), '#FF0000');
    assert.strictEqual(parseColor('rgba(0 128 255 / 0.5)'), '#0080FF');
    assert.strictEqual(parseColor('hsl(120, 100%, 50%)'), '#00FF00');
    assert.strictEqual(parseColor('hsv(240, 100%, 100%)'), '#0000FF');
    assert.strictEqual(parseColor('abc'), '#AABBCC');
    assert.strictEqual(parseColor('not a color'), null);
  });

  it('formats colors', () => {
    assert.strictEqual(formatColor('#ff0000', 'rgb'), 'rgb(255, 0, 0)');
    assert.strictEqual(formatColor('#ff0000', 'hsl'), 'hsl(0, 100%, 50%)');
    assert.strictEqual(formatColor('#ff0000', 'hsv'), 'hsv(0, 100%, 100%)');
    assert.strictEqual(formatColor('#ff0000', 'hex'), '#FF0000');
  });
});

describe('color helpers', () => {
  it('mixes colors', () => {
    assert.strictEqual(mix('#000000', '#FFFFFF', 0.5), '#808080');
    assert.strictEqual(mix('#FF0000', '#0000FF', 0), '#FF0000');
  });

  it('adjusts lightness', () => {
    assert.strictEqual(adjustLightness('#808080', 100), '#FFFFFF');
    assert.strictEqual(adjustLightness('#808080', -100), '#000000');
  });

  it('builds a tint/shade scale with the color in the middle', () => {
    const scale = tintShadeScale('#3366CC', 9);
    assert.strictEqual(scale.length, 9);
    assert.strictEqual(scale[4], '#3366CC');
    assert.ok(deltaE(scale[0], '#000000') < deltaE(scale[8], '#000000'));
  });

  it('picks readable text colors', () => {
    assert.strictEqual(readableTextColor('#FFFF00'), '#000000');
    assert.strictEqual(readableTextColor('#000080'), '#FFFFFF');
  });

  it('describes colors', () => {
    assert.strictEqual(describeColor('#000000'), 'Black');
    assert.strictEqual(describeColor('#0000FF'), 'Blue');
    assert.strictEqual(describeColor('#003300'), 'Dark Green');
    assert.strictEqual(describeColor('#CCCCCC'), 'Light Gray');
    assert.strictEqual(describeColor('#00AA55'), 'Green');
  });
});
