import * as assert from 'assert';
import { extractPalette, sampleAt, sampleLine, ImageData2D } from '../src/core/extract.js';
import { colorAt, evenStops, gradientSteps, interpolate, toCssGradient } from '../src/core/gradient.js';

function makeImage(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): ImageData2D {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('image extraction', () => {
  it('finds dominant colors sorted by weight', () => {
    // 3/4 red, 1/4 blue
    const img = makeImage(40, 40, (x) => (x < 30 ? [255, 0, 0] : [0, 0, 255]));
    const colors = extractPalette(img, 2, { seed: 1 });
    assert.strictEqual(colors.length, 2);
    assert.strictEqual(colors[0].hex, '#FF0000');
    assert.strictEqual(colors[1].hex, '#0000FF');
    assert.ok(Math.abs(colors[0].weight - 0.75) < 0.05);
    assert.ok(colors[1].x >= 30);
  });

  it('returns fewer colors when the image has fewer distinct colors', () => {
    const img = makeImage(10, 10, () => [10, 20, 30]);
    assert.strictEqual(extractPalette(img, 5).length, 1);
  });

  it('samples pixels and lines', () => {
    const img = makeImage(11, 1, (x) => [x * 25, 0, 0]);
    assert.strictEqual(sampleAt(img, 0, 0), '#000000');
    assert.strictEqual(sampleAt(img, 10, 0), '#FA0000');
    const line = sampleLine(img, 0, 0, 10, 0, 3, 0);
    assert.deepStrictEqual(line, ['#000000', '#7D0000', '#FA0000']);
  });
});

describe('gradients', () => {
  it('interpolates in different spaces', () => {
    assert.strictEqual(interpolate('#000000', '#FFFFFF', 0.5, 'rgb'), '#808080');
    assert.strictEqual(interpolate('#FF0000', '#0000FF', 0, 'oklab'), '#FF0000');
    assert.strictEqual(interpolate('#FF0000', '#0000FF', 1, 'hsl'), '#0000FF');
  });

  it('computes colors at positions and steps', () => {
    const stops = evenStops(['#000000', '#FFFFFF']);
    assert.deepStrictEqual(stops.map((s) => s.position), [0, 100]);
    assert.strictEqual(colorAt(stops, -10, 'rgb'), '#000000');
    assert.strictEqual(colorAt(stops, 110, 'rgb'), '#FFFFFF');
    assert.deepStrictEqual(gradientSteps(stops, 3, 'rgb'), ['#000000', '#808080', '#FFFFFF']);
  });

  it('generates CSS', () => {
    const stops = evenStops(['#FF0000', '#0000FF']);
    assert.strictEqual(toCssGradient('linear', 90, stops, 'rgb'), 'linear-gradient(90deg, #FF0000 0%, #0000FF 100%)');
    assert.match(toCssGradient('radial', 0, stops, 'rgb'), /^radial-gradient\(circle, /);
    assert.match(toCssGradient('conic', 45, stops, 'rgb'), /^conic-gradient\(from 45deg, /);
    assert.strictEqual(toCssGradient('linear', 90, stops, 'oklab').split('%').length - 1, 5);
  });
});
