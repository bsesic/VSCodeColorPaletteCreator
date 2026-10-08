/**
 * Library tab: manage saved palettes (edit, rename, duplicate, delete,
 * export, save as image, copy, insert, import).
 */
import { readableTextColor } from '../../core/color.js';
import { EXPORT_FORMATS, ExportFormat, Palette, exportPalette } from '../../core/palette.js';
import { post } from '../api.js';
import { ICONS, clear, h, iconButton, select } from '../dom.js';
import { renderPaletteImage } from '../paletteImage.js';
import { store } from '../store.js';
import { View } from './view.js';

export function saveImage(name: string, colors: string[]): void {
  post({ type: 'palette:saveImage', name, dataUrl: renderPaletteImage(name, colors) });
}

export function createLibraryView(): View {
  let filter = '';
  let format: ExportFormat = store.state.settings.defaultExportFormat;
  const list = h('div', { class: 'library-list' });
  const search = h('input', { type: 'text', placeholder: 'Search palettes or colors…', class: 'grow', 'aria-label': 'Search palettes' });
  search.addEventListener('input', () => { filter = search.value.trim().toLowerCase(); render(); });
  const formatSelect = select<ExportFormat>(EXPORT_FORMATS, format, (f) => { format = f; }, 'Export format');

  const card = (palette: Palette): HTMLElement => {
    const isCurrent = palette.id === store.state.paletteId;
    const strip = h('div', { class: 'result-swatches library-strip', title: 'Open in editor' });
    palette.colors.forEach((hex) => strip.appendChild(h('div', {
      class: 'result-swatch', style: `background:${hex};color:${readableTextColor(hex)}`
    }, hex)));
    strip.addEventListener('click', () => store.loadColors(palette.colors, palette.name, palette.id));
    const data = { name: palette.name, colors: palette.colors };
    return h('article', { class: `library-card${isCurrent ? ' current' : ''}` },
      h('div', { class: 'library-head' },
        h('strong', { class: 'grow' }, palette.name, isCurrent ? h('span', { class: 'tag' }, 'editing') : null),
        h('small', { class: 'hint' }, `${palette.colors.length} colors · ${new Date(palette.updatedAt).toLocaleString()}`)),
      strip,
      h('div', { class: 'library-actions' },
        h('button', { type: 'button', class: 'primary', onclick: () => store.loadColors(palette.colors, palette.name, palette.id), html: `${ICONS.edit} Edit` }),
        iconButton(ICONS.copy, `Copy as ${format}`, () => store.copyText(exportPalette(data, format), `${palette.name} (${format})`)),
        iconButton(ICONS.insert, 'Insert into editor', () => post({ type: 'insert', text: exportPalette(data, format) })),
        iconButton(ICONS.download, 'Export to file', () => post({ type: 'palette:export', palette: data, format })),
        iconButton(ICONS.image, 'Save as PNG image', () => saveImage(palette.name, palette.colors)),
        h('button', { type: 'button', onclick: () => post({ type: 'palette:rename', id: palette.id }) }, 'Rename'),
        h('button', { type: 'button', onclick: () => post({ type: 'palette:duplicate', id: palette.id }) }, 'Duplicate'),
        iconButton(ICONS.trash, 'Delete palette', () => post({ type: 'palette:delete', id: palette.id }), 'danger')));
  };

  let lastKey = '';
  function render(force = true): void {
    const { palettes, paletteId } = store.state;
    const key = JSON.stringify([palettes, paletteId, filter]);
    if (!force && key === lastKey) {
      return;
    }
    lastKey = key;
    clear(list);
    const matches = palettes.filter((p) => !filter
      || p.name.toLowerCase().includes(filter)
      || p.colors.some((c) => c.toLowerCase().includes(filter)));
    if (matches.length === 0) {
      list.appendChild(h('p', { class: 'hint' }, palettes.length
        ? 'No palettes match your search.'
        : 'No saved palettes yet. Use "Save" in the header to store the current palette.'));
    }
    matches.forEach((p) => list.appendChild(card(p)));
  }
  store.subscribe(() => render(false));
  render();

  const element = h('section', { class: 'card' },
    h('div', { class: 'toolbar' },
      h('h3', { class: 'panel-title grow' }, 'Saved palettes'),
      h('label', { class: 'inline-label' }, 'Format', formatSelect),
      h('button', { type: 'button', onclick: () => post({ type: 'palette:import' }), html: `${ICONS.download} Import…` })),
    h('div', { class: 'toolbar' }, search),
    list);
  return { id: 'library', label: 'Palettes', element, onShow: () => render() };
}
