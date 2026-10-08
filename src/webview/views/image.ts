/**
 * Image tab: upload an image, extract a palette automatically (k-means),
 * move or add pick markers manually and extract gradients along a line.
 */
import { readableTextColor } from '../../core/color.js';
import { extractPalette, sampleAt, sampleLine } from '../../core/extract.js';
import { evenStops, toCssGradient } from '../../core/gradient.js';
import { ICONS, append, clear, h, iconButton, select } from '../dom.js';
import { LoadedImage, getImage, loadImageFile, onImageLoaded } from '../imageState.js';
import { MAX_SWATCHES, store } from '../store.js';
import { toast } from '../toast.js';
import { View } from './view.js';

type Mode = 'palette' | 'gradient';

interface Marker { x: number; y: number; hex: string }

/** Optional hook so other views can receive extracted gradients. */
export const gradientTargets: Array<(colors: string[]) => void> = [];

const SAMPLE_RADIUS = 2;

export function createImageView(): View {
  let mode: Mode = 'palette';
  let count = 5;
  let steps = 5;
  let markers: Marker[] = [];
  let line = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let handles: HTMLElement[] = [];
  const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const dotLayer = h('div', { class: 'dot-layer' });

  const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const stage = h('div', { class: 'image-stage', tabindex: 0, 'aria-label': 'Image. Click to add a pick marker.' });
  const markerLayer = h('div', { class: 'marker-layer' });
  const lineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lineSvg.setAttribute('class', 'line-layer');
  const dropZone = h('div', { class: 'drop-zone' },
    h('div', { class: 'drop-icon', html: ICONS.image }),
    h('p', {}, 'Drop an image here, paste it (Ctrl+V) or'),
    h('button', { type: 'button', class: 'primary', onclick: () => fileInput.click() }, 'Choose image…'));
  const results = h('div', { class: 'extract-results' });
  const gradientPreview = h('div', { class: 'gradient-bar' });

  const countInput = h('input', { type: 'number', min: 1, max: MAX_SWATCHES, value: count, 'aria-label': 'Number of colors' });
  countInput.addEventListener('change', () => {
    count = Math.max(1, Math.min(MAX_SWATCHES, Number(countInput.value) || 5));
    countInput.value = String(count);
    autoExtract();
  });
  const stepsInput = h('input', { type: 'number', min: 2, max: 20, value: steps, 'aria-label': 'Number of gradient stops' });
  stepsInput.addEventListener('change', () => {
    steps = Math.max(2, Math.min(20, Number(stepsInput.value) || 5));
    stepsInput.value = String(steps);
    renderOverlay();
  });

  const modeSelect = select<Mode>([
    { id: 'palette', label: 'Extract palette' },
    { id: 'gradient', label: 'Extract gradient' }
  ], mode, (m) => { mode = m; renderControls(); renderOverlay(); }, 'Extraction mode');

  const paletteControls = h('span', { class: 'inline-label' }, 'Colors', countInput,
    h('button', { type: 'button', title: 'Pick the dominant colors again', onclick: () => autoExtract(), html: `${ICONS.refresh} Auto pick` }),
    h('button', { type: 'button', title: 'Remove all markers', onclick: () => { markers = []; renderOverlay(); } }, 'Clear markers'));
  const gradientControls = h('span', { class: 'inline-label' }, 'Stops', stepsInput);
  const toolbar = h('div', { class: 'toolbar' },
    modeSelect, paletteControls, gradientControls,
    h('span', { class: 'grow' }),
    h('button', { type: 'button', onclick: () => fileInput.click(), html: `${ICONS.image} Change image` }));

  const hint = h('p', { class: 'hint' });
  const workArea = h('div', { class: 'image-work', hidden: true }, toolbar, stage, hint, gradientPreview, results);
  append(stage, markerLayer);
  stage.appendChild(lineSvg);

  const currentColors = (): string[] => {
    const img = getImage();
    if (!img) { return []; }
    if (mode === 'palette') { return markers.map((m) => m.hex); }
    return sampleLine(img.pixels, line.x0, line.y0, line.x1, line.y1, steps, SAMPLE_RADIUS);
  };

  function autoExtract(): void {
    const img = getImage();
    if (!img) { return; }
    markers = extractPalette(img.pixels, count).map((c) => ({ x: c.x, y: c.y, hex: c.hex }));
    if (markers.length < count) {
      toast(`The image only contains ${markers.length} distinct colors.`);
    }
    renderOverlay();
  }

  function renderControls(): void {
    paletteControls.hidden = mode !== 'palette';
    gradientControls.hidden = mode !== 'gradient';
    gradientPreview.hidden = mode !== 'gradient';
    hint.textContent = mode === 'palette'
      ? 'Drag markers to pick colors manually. Click on the image to add a marker, double-click a marker to remove it.'
      : 'Drag the two end points to extract a gradient along the line.';
  }

  function renderOverlay(): void {
    const img = getImage();
    if (!img) { return; }
    const { width, height } = img.pixels;
    clear(markerLayer);
    while (lineSvg.firstChild) { lineSvg.removeChild(lineSvg.firstChild); }

    if (mode === 'palette') {
      markers.forEach((marker, i) => markerLayer.appendChild(createMarker(marker.x, marker.y, marker.hex, String(i + 1), (x, y) => {
        marker.x = x;
        marker.y = y;
        marker.hex = sampleAt(img.pixels, x, y, SAMPLE_RADIUS);
      }, () => { markers.splice(i, 1); renderOverlay(); })));
    } else {
      lineSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      lineSvg.appendChild(lineEl);
      markerLayer.appendChild(dotLayer);
      const update = (end: 0 | 1) => (x: number, y: number): void => {
        if (end === 0) { line.x0 = x; line.y0 = y; } else { line.x1 = x; line.y1 = y; }
      };
      handles = [
        createMarker(line.x0, line.y0, '#000000', 'A', update(0)),
        createMarker(line.x1, line.y1, '#000000', 'B', update(1))
      ];
      handles.forEach((handle) => markerLayer.appendChild(handle));
      updateGradientOverlay();
      return;
    }
    renderResults();
  }

  /** Updates line, stop dots and end handles in place (keeps pointer capture while dragging). */
  function updateGradientOverlay(): void {
    lineEl.setAttribute('x1', String(line.x0)); lineEl.setAttribute('y1', String(line.y0));
    lineEl.setAttribute('x2', String(line.x1)); lineEl.setAttribute('y2', String(line.y1));
    clear(dotLayer);
    const colors = currentColors();
    colors.forEach((hex, i) => {
      const t = i / (colors.length - 1);
      const dot = h('div', { class: 'line-dot', style: `background:${hex}` });
      placeAt(dot, line.x0 + (line.x1 - line.x0) * t, line.y0 + (line.y1 - line.y0) * t);
      dotLayer.appendChild(dot);
    });
    const ends: Array<[number, number, string]> = [[line.x0, line.y0, colors[0]], [line.x1, line.y1, colors[colors.length - 1]]];
    handles.forEach((handle, i) => {
      const [x, y, hex] = ends[i];
      placeAt(handle, x, y);
      handle.style.background = hex;
      handle.style.color = readableTextColor(hex);
      handle.title = hex;
    });
    renderResults();
  }

  function placeAt(el: HTMLElement, x: number, y: number): void {
    const img = getImage();
    if (!img) { return; }
    el.style.left = `${(x / img.pixels.width) * 100}%`;
    el.style.top = `${(y / img.pixels.height) * 100}%`;
  }

  function toImageCoords(e: PointerEvent | MouseEvent): [number, number] {
    const img = getImage() as LoadedImage;
    const rect = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(img.pixels.width - 1, ((e.clientX - rect.left) / rect.width) * img.pixels.width));
    const y = Math.max(0, Math.min(img.pixels.height - 1, ((e.clientY - rect.top) / rect.height) * img.pixels.height));
    return [x, y];
  }

  function createMarker(
    x: number, y: number, hex: string, label: string,
    onMove: (x: number, y: number) => void, onRemove?: () => void
  ): HTMLElement {
    const el = h('div', {
      class: 'pick-marker', style: `background:${hex};color:${readableTextColor(hex)}`,
      title: onRemove ? `${hex} – drag to move, double-click to remove` : hex
    }, label);
    placeAt(el, x, y);
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      const move = (ev: PointerEvent): void => {
        const [nx, ny] = toImageCoords(ev);
        onMove(nx, ny);
        if (mode === 'gradient') {
          updateGradientOverlay();
          return;
        }
        placeAt(el, nx, ny);
        const color = sampleAt((getImage() as LoadedImage).pixels, nx, ny, SAMPLE_RADIUS);
        el.style.background = color;
        el.style.color = readableTextColor(color);
        el.title = color;
        renderResults();
      };
      const up = (): void => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.classList.remove('active');
        if (mode === 'palette') {
          renderOverlay();
        }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
    // Prevent the stage from adding a new marker when a marker is clicked.
    el.addEventListener('click', (e) => e.stopPropagation());
    if (onRemove) {
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); onRemove(); });
    }
    return el;
  }

  function renderResults(): void {
    clear(results);
    const colors = currentColors();
    if (colors.length === 0) {
      results.appendChild(h('p', { class: 'hint' }, 'No colors picked yet.'));
      return;
    }
    const css = toCssGradient('linear', 90, evenStops(colors), 'rgb');
    gradientPreview.style.background = css;
    const row = h('div', { class: 'result-swatches' });
    colors.forEach((hex) => row.appendChild(h('button', {
      class: 'result-swatch', type: 'button', title: `Copy ${hex}`,
      style: `background:${hex};color:${readableTextColor(hex)}`,
      onclick: () => store.copyColor(hex)
    }, hex)));
    const actions = h('div', { class: 'toolbar' },
      h('button', {
        class: 'primary', type: 'button', onclick: () => {
          store.loadColors(colors);
          store.addToHistory(colors);
          toast('Palette replaced with the extracted colors');
        }
      }, 'Use as palette'),
      h('button', {
        type: 'button', onclick: () => {
          const free = MAX_SWATCHES - store.state.swatches.length;
          if (free <= 0) { toast('The palette is full.'); return; }
          store.loadColors([...store.colors, ...colors.slice(0, free)], store.state.name, store.state.paletteId);
        }
      }, 'Append to palette'),
      mode === 'gradient' ? h('button', { type: 'button', onclick: () => store.copyText(`background: ${css};`, 'CSS gradient') }, 'Copy CSS') : null,
      mode === 'gradient' && gradientTargets.length
        ? h('button', { type: 'button', onclick: () => gradientTargets.forEach((t) => t(colors)) }, 'Open in gradient generator')
        : null,
      iconButton(ICONS.copy, 'Copy all colors', () => store.copyText(colors.join(', '), 'all colors')));
    append(results, row, actions);
  }

  const showImage = (img: LoadedImage): void => {
    dropZone.hidden = true;
    workArea.hidden = false;
    stage.querySelector('canvas')?.remove();
    const display = img.canvas.cloneNode() as HTMLCanvasElement;
    display.getContext('2d')?.drawImage(img.canvas, 0, 0);
    display.className = 'image-canvas';
    stage.insertBefore(display, markerLayer);
    const { width, height } = img.pixels;
    line = { x0: width * 0.1, y0: height / 2, x1: width * 0.9, y1: height / 2 };
    autoExtract();
  };
  onImageLoaded(showImage);

  const handleFile = (file: File | undefined | null): void => {
    if (!file) { return; }
    loadImageFile(file).catch((err: Error) => toast(err.message));
  };
  fileInput.addEventListener('change', () => { handleFile(fileInput.files?.[0]); fileInput.value = ''; });

  stage.addEventListener('click', (e) => {
    if (mode !== 'palette' || !getImage()) { return; }
    if (markers.length >= MAX_SWATCHES) {
      toast(`At most ${MAX_SWATCHES} markers are supported.`);
      return;
    }
    const [x, y] = toImageCoords(e);
    markers.push({ x, y, hex: sampleAt((getImage() as LoadedImage).pixels, x, y, SAMPLE_RADIUS) });
    renderOverlay();
  });

  const element = h('section', { class: 'card image-view' }, h('h3', { class: 'panel-title' }, 'Extract colors from an image'),
    dropZone, workArea, fileInput);
  element.addEventListener('dragover', (e) => { e.preventDefault(); element.classList.add('dragover'); });
  element.addEventListener('dragleave', () => element.classList.remove('dragover'));
  element.addEventListener('drop', (e) => {
    e.preventDefault();
    element.classList.remove('dragover');
    handleFile(e.dataTransfer?.files?.[0]);
  });
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      handleFile(item.getAsFile());
    }
  });
  renderControls();

  return { id: 'image', label: 'Image', element };
}
