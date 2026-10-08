import * as assert from 'assert';
import { colorKey, findColors, formatLike, groupColors, planReplacement, presentations } from '../src/core/scan.js';

const one = (text: string) => {
  const found = findColors(text);
  assert.strictEqual(found.length, 1, `expected one color in ${text}: ${JSON.stringify(found)}`);
  return found[0];
};

describe('color scanner', () => {
  it('finds hex colors with alpha', () => {
    const c = one('color: #0d6efd80;');
    assert.strictEqual(c.text, '#0d6efd80');
    assert.strictEqual(c.format, 'hex');
    assert.deepStrictEqual([c.color.r, c.color.g, c.color.b], [13, 110, 253]);
    assert.ok(Math.abs(c.color.a - 128 / 255) < 1e-9);
    assert.strictEqual(one('a { color: #abc }').color.b, 204);
  });

  it('ignores ids, entities, words and invalid lengths', () => {
    assert.strictEqual(findColors('#bad { color: red }').length, 0);
    assert.strictEqual(findColors('#cafe:hover {}').length, 0);
    assert.strictEqual(findColors('&#123; abc#fff #12345 #1234567 url(#fade-in)').length, 0);
    assert.strictEqual(one('a{color:#fff}').text, '#fff');
    assert.strictEqual(one('const c = "#FFAA00";').name, 'c');
  });

  it('finds functional notations', () => {
    assert.deepStrictEqual(one('rgb(255, 0, 0)').color, { r: 255, g: 0, b: 0, a: 1 });
    assert.strictEqual(one('rgba(0,0,0,.5)').color.a, 0.5);
    assert.strictEqual(one('rgb(0 0 0 / 25%)').color.a, 0.25);
    assert.deepStrictEqual(one('hsl(120deg 100% 50%)').color, { r: 0, g: 255, b: 0, a: 1 });
    assert.strictEqual(one('HSLA(0, 100%, 50%, 0.3)').color.a, 0.3);
    assert.deepStrictEqual(one('hsv(240, 100%, 100%)').color, { r: 0, g: 0, b: 255, a: 1 });
    assert.strictEqual(one('hsva(0, 0%, 100%, 1)').color.r, 255);
    assert.strictEqual(one('rgb(100%, 0%, 0%)').color.r, 255);
  });

  it('rejects incomplete or variable based functions', () => {
    assert.strictEqual(findColors('rgba(var(--bs-primary-rgb), .5) rgb(1, 2) rgb(300, 0, 0) myrgb(1,2,3)').length, 0);
  });

  it('finds Bootstrap RGB triplets and variable names', () => {
    const found = findColors(':root {\n  --bs-primary: #0d6efd;\n  --bs-primary-rgb: 13, 110, 253;\n  $accent: rgb(1, 2, 3);\n}');
    assert.deepStrictEqual(found.map((f) => [f.format, f.name, f.text]), [
      ['hex', '--bs-primary', '#0d6efd'],
      ['rgb-triplet', '--bs-primary-rgb', '13, 110, 253'],
      ['rgb', '$accent', 'rgb(1, 2, 3)']
    ]);
    assert.strictEqual(colorKey(found[0].color), colorKey(found[1].color));
  });

  it('filters formats', () => {
    assert.deepStrictEqual(findColors('#fff hsv(0, 0%, 0%)', { formats: ['hsv'] }).map((f) => f.format), ['hsv']);
  });

  it('reports offsets', () => {
    const text = 'a: #fff; b: rgb(1,2,3)';
    findColors(text).forEach((f) => assert.strictEqual(text.slice(f.start, f.end), f.text));
  });
});

describe('formatLike', () => {
  const red = { r: 255, g: 0, b: 0, a: 1 };
  const half = { r: 255, g: 0, b: 0, a: 0.5 };
  it('keeps hex style', () => {
    assert.strictEqual(formatLike({ format: 'hex', text: '#abcdef' }, red), '#ff0000');
    assert.strictEqual(formatLike({ format: 'hex', text: '#ABCDEF' }, red), '#FF0000');
    assert.strictEqual(formatLike({ format: 'hex', text: '#000000' }, red), '#ff0000');
    assert.strictEqual(formatLike({ format: 'hex', text: '#abc' }, red), '#f00');
    assert.strictEqual(formatLike({ format: 'hex', text: '#abc' }, { r: 18, g: 52, b: 86, a: 1 }), '#123456');
    assert.strictEqual(formatLike({ format: 'hex', text: '#abcdef' }, half), '#ff000080');
    assert.strictEqual(formatLike({ format: 'hex', text: '#abcd' }, red), '#f00f');
  });

  it('keeps function style', () => {
    assert.strictEqual(formatLike({ format: 'rgb', text: 'rgb(1, 2, 3)' }, red), 'rgb(255, 0, 0)');
    assert.strictEqual(formatLike({ format: 'rgb', text: 'rgb(1,2,3)' }, half), 'rgba(255, 0, 0, 0.5)');
    assert.strictEqual(formatLike({ format: 'rgb', text: 'rgba(1, 2, 3, 0.2)' }, red), 'rgba(255, 0, 0, 1)');
    assert.strictEqual(formatLike({ format: 'rgb', text: 'rgb(1 2 3)' }, half), 'rgb(255 0 0 / 0.5)');
    assert.strictEqual(formatLike({ format: 'rgb', text: 'rgb(1 2 3 / 20%)' }, half), 'rgb(255 0 0 / 50%)');
    assert.strictEqual(formatLike({ format: 'rgb', text: 'rgb(10%, 0%, 0%)' }, red), 'rgb(100%, 0%, 0%)');
    assert.strictEqual(formatLike({ format: 'hsl', text: 'hsl(1deg 2% 3%)' }, red), 'hsl(0deg 100% 50%)');
    assert.strictEqual(formatLike({ format: 'hsl', text: 'HSL(1, 2%, 3%)' }, half), 'HSLA(0, 100%, 50%, 0.5)');
    assert.strictEqual(formatLike({ format: 'hsv', text: 'hsv(1, 2%, 3%)' }, red), 'hsv(0, 100%, 100%)');
    assert.strictEqual(formatLike({ format: 'rgb-triplet', text: '1, 2, 3' }, red), '255, 0, 0');
  });

  it('offers alternative presentations with the original first', () => {
    const list = presentations({ format: 'hsl', text: 'hsl(0, 0%, 0%)' }, red);
    assert.deepStrictEqual(list, ['hsl(0, 100%, 50%)', '#FF0000', 'rgb(255, 0, 0)', 'hsv(0, 100%, 100%)']);
  });
});

describe('document colors', () => {
  const css = [
    ':root {',
    '  --bs-primary: #0d6efd;',
    '  --bs-primary-rgb: 13, 110, 253;',
    '  --bs-link: #0D6EFD;',
    '  --shadow: rgba(13, 110, 253, .25);',
    '  --bs-dark: #212529;',
    '}'
  ].join('\n');

  it('groups colors with names and lines', () => {
    const groups = groupColors(css, findColors(css));
    assert.deepStrictEqual(groups.map((g) => [g.key, g.count, g.names, g.lines]), [
      ['#0D6EFD', 3, ['--bs-primary', '--bs-primary-rgb', '--bs-link'], [1, 2, 3]],
      ['#0D6EFD40', 1, ['--shadow'], [4]],
      ['#212529', 1, ['--bs-dark'], [5]]
    ]);
    assert.deepStrictEqual(groups[0].formats, ['hex', 'rgb-triplet']);
  });

  it('plans replacements keeping notation and alpha', () => {
    const { edits, newKey } = planReplacement(css, '#0D6EFD', { r: 255, g: 0, b: 0 });
    assert.strictEqual(newKey, '#FF0000');
    let result = css;
    [...edits].reverse().forEach((e) => { result = result.slice(0, e.start) + e.text + result.slice(e.end); });
    assert.ok(result.includes('--bs-primary: #ff0000;'));
    assert.ok(result.includes('--bs-primary-rgb: 255, 0, 0;'));
    assert.ok(result.includes('--bs-link: #FF0000;'));
    assert.ok(result.includes('rgba(13, 110, 253, .25)'), 'other alpha group untouched');
    const alpha = planReplacement(css, '#0D6EFD40', { r: 0, g: 0, b: 0 });
    assert.strictEqual(alpha.newKey, '#00000040');
    assert.strictEqual(alpha.edits[0].text, 'rgba(0, 0, 0, 0.25)');
  });

  it('keeps the original notation across a session via templates', () => {
    const text = 'a: #0d6efd; b: #0D6EFD;';
    const first = planReplacement(text, '#0D6EFD', { r: 17, g: 17, b: 17 });
    let current = text;
    [...first.edits].reverse().forEach((e) => { current = current.slice(0, e.start) + e.text + current.slice(e.end); });
    assert.strictEqual(current, 'a: #111111; b: #111111;');
    const second = planReplacement(current, first.newKey, { r: 255, g: 0, b: 170 }, first.originals);
    assert.deepStrictEqual(second.edits.map((e) => e.text), ['#ff00aa', '#FF00AA']);
  });
});
