/**
 * Renders a palette as a PNG image (title, color blocks, HEX/RGB labels).
 */
import { describeColor, formatColor, readableTextColor } from '../core/color.js';

export function renderPaletteImage(name: string, colors: string[]): string {
  const swatchWidth = 200;
  const swatchHeight = 260;
  const header = 70;
  const padding = 24;
  const canvas = document.createElement('canvas');
  canvas.width = padding * 2 + swatchWidth * colors.length;
  canvas.height = header + swatchHeight + padding;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not available');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1F2328';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, padding, header / 2);

  colors.forEach((hex, i) => {
    const x = padding + i * swatchWidth;
    ctx.fillStyle = hex;
    ctx.fillRect(x, header, swatchWidth, swatchHeight);
    ctx.fillStyle = readableTextColor(hex);
    ctx.textAlign = 'center';
    ctx.font = '600 22px ui-monospace, monospace';
    ctx.fillText(hex.toUpperCase(), x + swatchWidth / 2, header + swatchHeight - 70);
    ctx.font = '14px ui-monospace, monospace';
    ctx.fillText(formatColor(hex, 'rgb'), x + swatchWidth / 2, header + swatchHeight - 44);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(describeColor(hex), x + swatchWidth / 2, header + swatchHeight - 22);
    ctx.textAlign = 'start';
  });
  return canvas.toDataURL('image/png');
}
