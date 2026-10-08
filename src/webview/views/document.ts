/**
 * Document tab: shows the colors of the currently open file as swatches.
 * Changing a swatch rewrites all its occurrences in the file immediately.
 */
import { formatColor, hexToRgb, readableTextColor } from '../../core/color.js';
import { DocumentColors } from '../../core/messages.js';
import { ColorGroup, colorKey } from '../../core/scan.js';
import { onHostMessage, post } from '../api.js';
import { ColorPicker } from '../components/picker.js';
import { ICONS, append, clear, h, iconButton } from '../dom.js';
import { MAX_SWATCHES, store } from '../store.js';
import { toast } from '../toast.js';
import { View } from './view.js';

/** Minimum time between two edits while dragging (ms). */
const EDIT_INTERVAL = 50;

export function createDocumentView(): View {
  let doc: DocumentColors | undefined;
  let selectedKey: string | undefined;
  let session = 0;
  let sessionKey = '';
  let sessionAlpha = 1;
  let filter = '';
  /** Time of the last edit sent; document updates shortly after it must not move the picker. */
  let lastSent = 0;

  // Throttled sending of color changes: the latest value always wins.
  let queued: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (): void => {
    timer = undefined;
    if (queued && doc) {
      post({ type: 'document:replace', uri: doc.uri, session, key: sessionKey, hex: queued });
      selectedKey = colorKey({ ...(hexToRgb(queued) ?? { r: 0, g: 0, b: 0 }), a: sessionAlpha });
      lastSent = Date.now();
      queued = undefined;
      timer = setTimeout(flush, EDIT_INTERVAL);
    }
  };
  const sendColor = (hex: string): void => {
    queued = hex;
    if (!timer) {
      flush();
    }
  };

  const title = h('h3', { class: 'panel-title grow' }, 'Document colors');
  const info = h('p', { class: 'hint' });
  const grid = h('div', { class: 'doc-grid', role: 'listbox', 'aria-label': 'Colors in the document' });
  const detail = h('section', { class: 'card doc-detail', hidden: true });
  const detailTitle = h('h3', { class: 'panel-title' });
  const detailMeta = h('div', { class: 'doc-meta' });
  const paletteChips = h('div', { class: 'chips' });

  const picker = new ColorPicker({
    compact: true,
    onStart: () => undefined,
    onChange: (hex) => sendColor(hex),
    onCommit: (hex) => store.addToHistory([hex]),
    onCopy: (hex, format) => store.copyColor(hex, format)
  });

  const autoSave = h('input', { type: 'checkbox' });
  autoSave.addEventListener('change', () => post({ type: 'document:setAutoSave', enabled: autoSave.checked }));
  const search = h('input', { type: 'text', placeholder: 'Filter by color or variable…', class: 'grow', 'aria-label': 'Filter colors' });
  search.addEventListener('input', () => { filter = search.value.trim().toLowerCase(); renderGrid(); });

  const select = (group: ColorGroup): void => {
    flush();
    session++;
    sessionKey = group.key;
    sessionAlpha = group.alpha;
    selectedKey = group.key;
    picker.setColor(group.hex);
    render();
  };

  function groupLabel(group: ColorGroup): string {
    return group.alpha < 1 ? `${group.hex} · ${Math.round(group.alpha * 100)}%` : group.hex;
  }

  function renderGrid(): void {
    clear(grid);
    if (!doc) {
      return;
    }
    const groups = doc.groups.filter((g) => !filter
      || g.key.toLowerCase().includes(filter)
      || g.names.some((n) => n.toLowerCase().includes(filter)));
    for (const group of groups) {
      const fg = readableTextColor(group.hex);
      const tile = h('button', {
        class: `doc-tile${group.key === selectedKey ? ' selected' : ''}`, type: 'button', role: 'option',
        'aria-selected': String(group.key === selectedKey),
        title: `${group.count} occurrence(s)${group.names.length ? `\n${group.names.join('\n')}` : ''}`,
        onclick: () => select(group)
      },
      h('span', { class: 'doc-tile-color', style: `background:${group.hex};color:${fg};opacity:${Math.max(group.alpha, 0.15)}` },
        h('span', { class: 'doc-count' }, `×${group.count}`)),
      h('span', { class: 'doc-tile-text' },
        h('strong', {}, groupLabel(group)),
        h('small', {}, group.names.slice(0, 2).join(', ') || group.formats.join(', '))));
      grid.appendChild(tile);
    }
    if (groups.length === 0) {
      grid.appendChild(h('p', { class: 'hint' }, doc.groups.length ? 'No colors match the filter.' : 'No color codes found in this file.'));
    }
  }

  function renderDetail(): void {
    const group = doc?.groups.find((g) => g.key === selectedKey);
    detail.hidden = !doc || !selectedKey;
    if (!group || !doc) {
      if (selectedKey && doc) {
        detailTitle.textContent = 'Updating…';
      }
      return;
    }
    if (Date.now() - lastSent > 600) {
      picker.setColor(group.hex); // External change, e.g. typed in the editor.
    }
    detailTitle.textContent = `${groupLabel(group)} · ${group.count} occurrence(s)`;
    clear(detailMeta);
    if (group.names.length) {
      detailMeta.appendChild(h('div', { class: 'doc-names' }, ...group.names.map((n) => h('code', {}, n))));
    }
    const lines = h('div', { class: 'doc-lines' });
    const uri = doc.uri;
    [...new Set(group.lines)].slice(0, 40).forEach((line) => lines.appendChild(h('button', {
      type: 'button', class: 'link-btn', title: 'Go to line', onclick: () => post({ type: 'document:reveal', uri, line })
    }, `Line ${line + 1}`)));
    if (group.lines.length > 40) {
      lines.appendChild(h('span', { class: 'hint' }, `+${group.lines.length - 40} more`));
    }
    append(detailMeta, lines);
    clear(paletteChips);
    store.colors.forEach((hex) => paletteChips.appendChild(h('button', {
      class: 'chip', type: 'button', title: `Replace with ${hex}`, style: `background:${hex}`,
      onclick: () => { picker.setColor(hex); sendColor(hex); }
    })));
  }

  function render(): void {
    if (!doc) {
      title.textContent = 'Document colors';
      info.textContent = 'Open a file in the editor to see its colors here.';
      clear(grid);
      detail.hidden = true;
      return;
    }
    title.textContent = doc.fileName;
    autoSave.checked = doc.autoSave;
    info.textContent = doc.tooLarge
      ? 'This file is too large to be scanned.'
      : `${doc.groups.length} colors · ${doc.groups.reduce((n, g) => n + g.count, 0)} occurrences · ${doc.languageId}. `
        + 'Select a color to change all its occurrences in the file. Each change can be undone in the editor (Ctrl+Z).';
    renderGrid();
    renderDetail();
  }

  onHostMessage((msg) => {
    if (msg.type !== 'document:colors') {
      return;
    }
    if (msg.document?.uri !== doc?.uri) {
      selectedKey = undefined;
      session++;
    }
    doc = msg.document;
    render();
  });
  store.subscribe(() => { if (!detail.hidden) { renderDetail(); } });

  append(detail, detailTitle, detailMeta, picker.element,
    h('div', { class: 'section-label' }, 'Replace with a palette color'), paletteChips);

  const element = h('div', { class: 'document-view' },
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' }, title,
        h('label', { class: 'inline-label', title: 'Save the file after each change, e.g. for live reload servers' }, autoSave, 'Auto-save'),
        iconButton(ICONS.refresh, 'Rescan document', () => post({ type: 'document:refresh' })),
        h('button', {
          type: 'button', title: 'Load the most used colors into the palette', onclick: () => {
            if (!doc?.groups.length) { toast('No colors to load.'); return; }
            store.loadColors(doc.groups.slice(0, MAX_SWATCHES).map((g) => g.hex), doc.fileName.split('/').pop());
          }
        }, 'Use as palette'),
        iconButton(ICONS.copy, 'Copy all colors', () => doc && store.copyText(doc.groups.map((g) => formatColor(g.hex, store.state.copyFormat)).join(', '), 'document colors'))),
      info,
      h('div', { class: 'toolbar' }, search),
      grid),
    detail);
  render();
  return { id: 'document', label: 'Document', element, onShow: () => post({ type: 'document:refresh' }) };
}
