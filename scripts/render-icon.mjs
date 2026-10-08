// Renders the extension icon (images/icon.svg) to images/icon.png.
// The PNG is used as marketplace icon and as tab icon of the panel.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const SIZE = 256;
const svg = readFileSync(new URL('../images/icon.svg', import.meta.url));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
writeFileSync(new URL('../images/icon.png', import.meta.url), png);
console.log(`images/icon.png written (${SIZE}x${SIZE}, ${png.length} bytes)`);
