/**
 * Color blindness simulator for the palette and the loaded image.
 */
import { deltaE, readableTextColor } from '../../core/color.js';
import { VISION_TYPES, VisionType, simulateHex, simulatePixels } from '../../core/blindness.js';
import { clear, h, select } from '../dom.js';
import { getImage, onImageLoaded } from '../imageState.js';
import { store } from '../store.js';
import { View } from './view.js';

/** Colors closer than this (OKLab distance) are hard to tell apart. */
const CONFUSION_THRESHOLD = 0.06;

export function createVisionView(): View {
  let imageType: VisionType = 'deuteranopia';
  let visible = false;
  const rows = h('div', { class: 'vision-rows' });
  const imageArea = h('div', { class: 'vision-images' });

  function renderPalette(): void {
    clear(rows);
    const colors = store.colors;
    for (const type of VISION_TYPES) {
      const simulated = colors.map((c) => simulateHex(c, type.id));
      const conflicts: string[] = [];
      for (let i = 0; i < simulated.length; i++) {
        for (let j = i + 1; j < simulated.length; j++) {
          if (deltaE(simulated[i], simulated[j]) < CONFUSION_THRESHOLD && deltaE(colors[i], colors[j]) >= CONFUSION_THRESHOLD) {
            conflicts.push(`${i + 1} & ${j + 1}`);
          }
        }
      }
      const strip = h('div', { class: 'result-swatches' });
      simulated.forEach((hex, i) => strip.appendChild(h('div', {
        class: 'result-swatch', style: `background:${hex};color:${readableTextColor(hex)}`, title: `${colors[i]} → ${hex}`
      }, String(i + 1))));
      rows.appendChild(h('div', { class: 'vision-row' },
        h('div', { class: 'vision-label' }, h('strong', {}, type.label), h('small', {}, type.description),
          conflicts.length ? h('small', { class: 'warning' }, `⚠ Hard to distinguish: ${conflicts.join(', ')}`) : null),
        strip));
    }
  }

  function renderImage(): void {
    clear(imageArea);
    const img = getImage();
    if (!img) {
      imageArea.appendChild(h('p', { class: 'hint' }, 'Load an image in the Image tab to simulate it here.'));
      return;
    }
    const { width, height } = img.pixels;
    const canvas = h('canvas', { width, height, class: 'vision-canvas' });
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const data = new Uint8ClampedArray(img.pixels.data);
      simulatePixels(data, imageType);
      ctx.putImageData(new ImageData(data, width, height), 0, 0);
    }
    const original = img.canvas.cloneNode() as HTMLCanvasElement;
    original.getContext('2d')?.drawImage(img.canvas, 0, 0);
    original.className = 'vision-canvas';
    imageArea.append(
      h('figure', {}, original, h('figcaption', {}, 'Original')),
      h('figure', {}, canvas, h('figcaption', {}, VISION_TYPES.find((t) => t.id === imageType)?.label ?? '')));
  }

  const typeSelect = select(VISION_TYPES.filter((t) => t.id !== 'normal'), imageType, (t) => { imageType = t; renderImage(); }, 'Vision type');
  let lastColors = '';
  store.subscribe(() => {
    const key = store.colors.join();
    if (visible && key !== lastColors) {
      lastColors = key;
      renderPalette();
    }
  });
  onImageLoaded(() => { if (visible) { renderImage(); } });

  const element = h('div', { class: 'vision-view' },
    h('section', { class: 'card' }, h('h3', { class: 'panel-title' }, 'Color blindness simulator'),
      h('p', { class: 'hint' }, 'How the palette appears with different color vision deficiencies (Machado et al. 2009).'),
      rows),
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' }, h('h3', { class: 'panel-title grow' }, 'Image simulation'), typeSelect),
      imageArea));
  return {
    id: 'vision', label: 'Color Blindness', element,
    onShow: () => {
      visible = true;
      lastColors = store.colors.join();
      renderPalette();
      renderImage();
    }
  };
}
