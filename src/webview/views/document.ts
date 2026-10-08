/**
 * Document tab: shows the colors of the currently open file as swatches.
 * Changing a swatch rewrites all its occurrences in the file immediately.
 */
import { formatColor, hexToRgb, readableTextColor } from '../../core/color.js';
import { DocumentColors } from '../../core/messages.js';
import { ColorGroup, colorKey } from '../../core/scan.js';
import { onHostMessage, post } from '../api.js';
import { ColorPicker } from '../components/picker.js';
import { ICONS, append, clear, h, iconButton, select as selectBox } from '../dom.js';
import { MAX_SWATCHES, store } from '../store.js';
import { toast } from '../toast.js';
import { View } from './view.js';
import { t } from '../i18n.js';

/** Minimum time between two edits while dragging (ms). */
const EDIT_INTERVAL = 50;

export function createDocumentView(): View {
  let doc: DocumentColors | undefined;
  let selectedKey: string | undefined;
  let session = 0;
  let sessionKey = '';
  let sessionAlpha = 1;
  let filter = '';
  /** Index of the occurrence shown in the editor for the selected color. */
  let occurrence = 0;
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

  const title = h('h3', { class: 'panel-title grow' }, t('Document colors'));
  const info = h('p', { class: 'hint' });
  const grid = h('div', { class: 'doc-grid', role: 'listbox', 'aria-label': t('Colors in the document') });
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
  const search = h('input', { type: 'text', placeholder: t('Filter by color or variable…'), class: 'grow', 'aria-label': t('Filter colors') });
  search.addEventListener('input', () => { filter = search.value.trim().toLowerCase(); renderGrid(); });

  const reveal = (group: ColorGroup, index: number): void => {
    if (!doc || group.ranges.length === 0) {
      return;
    }
    occurrence = ((index % group.ranges.length) + group.ranges.length) % group.ranges.length;
    post({ type: 'document:reveal', uri: doc.uri, range: group.ranges[occurrence], highlight: group.ranges });
    renderDetail();
  };

  /** Selects a color; clicking the selected color again jumps to its next occurrence. */
  const select = (group: ColorGroup): void => {
    if (group.key === selectedKey) {
      reveal(group, occurrence + 1);
      return;
    }
    flush();
    session++;
    sessionKey = group.key;
    sessionAlpha = group.alpha;
    selectedKey = group.key;
    occurrence = 0;
    picker.setColor(group.hex);
    render();
    reveal(group, 0);
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
        title: `${t('{0} occurrence(s)', group.count)}${group.names.length ? `\n${group.names.join('\n')}` : ''}`,
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
      grid.appendChild(h('p', { class: 'hint' }, doc.groups.length ? t('No colors match the filter.') : t('No color codes found in this file.')));
    }
  }

  function renderDetail(): void {
    const group = doc?.groups.find((g) => g.key === selectedKey);
    detail.hidden = !doc || !selectedKey;
    if (!group || !doc) {
      if (selectedKey && doc) {
        detailTitle.textContent = t('Updating…');
      }
      return;
    }
    if (Date.now() - lastSent > 600) {
      picker.setColor(group.hex); // External change, e.g. typed in the editor.
    }
    detailTitle.textContent = `${groupLabel(group)} · ${t('{0} occurrence(s)', group.count)}`;
    clear(detailMeta);
    occurrence = Math.min(occurrence, group.count - 1);
    const occurrences = selectBox(
      group.lines.map((line, i) => ({
        id: String(i),
        label: `${i + 1} / ${group.count} · ${t('Line {0}', line + 1)}${group.occurrenceNames[i] ? ` · ${group.occurrenceNames[i]}` : ''}`
      })),
      String(occurrence),
      (value) => reveal(group, Number(value)),
      t('Go to occurrence'));
    occurrences.classList.add('grow');
    detailMeta.appendChild(h('div', { class: 'doc-nav' },
      iconButton(ICONS.chevronLeft, t('Previous occurrence'), () => reveal(group, occurrence - 1)),
      occurrences,
      iconButton(ICONS.chevronRight, t('Next occurrence (or click the swatch again)'), () => reveal(group, occurrence + 1))));
    clear(paletteChips);
    store.colors.forEach((hex) => paletteChips.appendChild(h('button', {
      class: 'chip', type: 'button', title: t('Replace with {0}', hex), style: `background:${hex}`,
      onclick: () => { picker.setColor(hex); sendColor(hex); }
    })));
  }

  function render(): void {
    if (!doc) {
      title.textContent = t('Document colors');
      info.textContent = t('Open a file in the editor to see its colors here.');
      clear(grid);
      detail.hidden = true;
      return;
    }
    title.textContent = doc.fileName;
    title.title = doc.path;
    autoSave.checked = doc.autoSave;
    info.textContent = doc.tooLarge
      ? t('This file is too large to be scanned.')
      : t('{0} colors · {1} occurrences · {2}.', doc.groups.length, doc.groups.reduce((n, g) => n + g.count, 0), doc.languageId)
        + ' ' + t('Click a color to jump to it in the editor (click again for the next occurrence) and to change all its occurrences. Each change can be undone in the editor (Ctrl+Z).');
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
    h('div', { class: 'section-label' }, t('Replace with a palette color')), paletteChips);

  const element = h('div', { class: 'document-view' },
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' }, title,
        h('label', { class: 'inline-label', title: t('Save the file after each change, e.g. for live reload servers') }, autoSave, t('Auto-save')),
        iconButton(ICONS.refresh, t('Rescan document'), () => post({ type: 'document:refresh' })),
        h('button', {
          type: 'button', title: t('Load the most used colors into the palette'), onclick: () => {
            if (!doc?.groups.length) { toast(t('No colors to load.')); return; }
            store.loadColors(doc.groups.slice(0, MAX_SWATCHES).map((g) => g.hex), doc.fileName.split('/').pop());
          }
        }, t('Use as palette')),
        iconButton(ICONS.copy, t('Copy all colors'), () => doc && store.copyText(doc.groups.map((g) => formatColor(g.hex, store.state.copyFormat)).join(', '), t('document colors')))),
      info,
      h('div', { class: 'toolbar' }, search),
      grid),
    detail);
  render();
  return { id: 'document', label: t('Document'), element, onShow: () => post({ type: 'document:refresh' }) };
}
