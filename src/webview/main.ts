/**
 * Webview entry point: layout, header, tabs and host message handling.
 */
import { ColorFormat } from '../core/color.js';
import { WorkingState } from '../core/messages.js';
import { EXPORT_FORMATS, ExportFormat, exportPalette } from '../core/palette.js';
import { getViewState, onHostMessage, post } from './api.js';
import { ICONS, append, h, iconButton, iconText, select } from './dom.js';
import { store } from './store.js';
import { createEditorView } from './views/editor.js';
import { createHistoryView } from './views/history.js';
import { createContrastView } from './views/contrast.js';
import { createDocumentView } from './views/document.js';
import { createGradientView } from './views/gradient.js';
import { createImageView } from './views/image.js';
import { createLibraryView, saveImage } from './views/library.js';
import { createVisionView } from './views/vision.js';
import { createSwatchStrip } from './views/swatches.js';
import { View } from './views/view.js';
import { loadImage } from './imageState.js';
import { toast } from './toast.js';
import { t } from './i18n.js';

const views: View[] = [
  createEditorView(), createDocumentView(), createImageView(), createGradientView(), createContrastView(), createVisionView(), createLibraryView(),
  createHistoryView()
];

function createHeader(): HTMLElement {
  const nameInput = h('input', { class: 'palette-name', type: 'text', 'aria-label': t('Palette name'), spellcheck: 'false' });
  nameInput.addEventListener('change', () => store.set({ name: nameInput.value.trim() || t('Untitled palette') }));

  const undo = iconButton(ICONS.undo, t('Undo (Ctrl+Z)'), () => store.undo());
  const redo = iconButton(ICONS.redo, t('Redo (Ctrl+Y)'), () => store.redo());
  const formatSelect = select<ColorFormat>(
    [{ id: 'hex', label: 'HEX' }, { id: 'rgb', label: 'RGB' }, { id: 'hsl', label: 'HSL' }, { id: 'hsv', label: 'HSV' }],
    store.state.copyFormat, (copyFormat) => store.set({ copyFormat }), t('Color format for labels and copying'));
  const insert = iconButton(ICONS.insert, t('Insert palette into the active editor'), () => {
    post({ type: 'insert', text: exportPalette({ name: store.state.name, colors: store.colors }, store.state.settings.defaultExportFormat) });
  });
  const copyAll = iconButton(ICONS.copy, t('Copy all colors'), () => store.copyText(store.colors.join(', '), t('all colors')));

  const save = h('button', { type: 'button', class: 'primary', title: t('Save palette'), html: iconText(ICONS.save, t('Save')) });
  save.addEventListener('click', () => post({
    type: 'palette:save', palette: { id: store.state.paletteId, name: store.state.name, colors: store.colors }
  }));
  const saveAsNew = h('button', { type: 'button', title: t('Save as a new palette') }, t('Save as new'));
  saveAsNew.addEventListener('click', () => post({ type: 'palette:save', palette: { name: store.state.name, colors: store.colors } }));
  const newPalette = h('button', { type: 'button', title: t('Start a new palette') }, t('New'));
  newPalette.addEventListener('click', () => {
    store.loadColors(store.colors, t('Untitled palette'), undefined);
    store.generate();
  });
  const exportSelect = select<ExportFormat | ''>(
    [{ id: '', label: t('Export…') }, ...EXPORT_FORMATS.map((f) => ({ id: f.id, label: t(f.label) })), { id: 'png' as ExportFormat, label: t('PNG image') }],
    '', (value) => {
      exportSelect.value = '';
      if ((value as string) === 'png') {
        saveImage(store.state.name, store.colors);
      } else if (value) {
        post({ type: 'palette:export', palette: { name: store.state.name, colors: store.colors }, format: value });
      }
    }, t('Export the current palette'));

  const header = h('header', { class: 'app-header' },
    nameInput,
    h('div', { class: 'header-actions', id: 'header-actions' },
      undo, redo, formatSelect, copyAll, insert, exportSelect, newPalette, saveAsNew, save));
  store.subscribe((state) => {
    if (document.activeElement !== nameInput) {
      nameInput.value = state.name;
    }
    undo.disabled = !store.canUndo;
    redo.disabled = !store.canRedo;
    formatSelect.value = state.copyFormat;
  });
  return header;
}

function createTabs(): HTMLElement {
  const tabList = h('div', { class: 'tabs', role: 'tablist' });
  const panels = h('div', { class: 'tab-panels' });
  const buttons = new Map<string, HTMLButtonElement>();
  const show = (id: string): void => {
    views.forEach((view) => {
      const active = view.id === id;
      view.element.hidden = !active;
      buttons.get(view.id)?.setAttribute('aria-selected', String(active));
      if (active) {
        view.onShow?.();
      }
    });
  };
  views.forEach((view) => {
    const button = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: () => show(view.id) }, view.label);
    buttons.set(view.id, button);
    tabList.appendChild(button);
    view.element.setAttribute('role', 'tabpanel');
    panels.appendChild(view.element);
  });
  show(views[0].id);
  window.addEventListener('cpc:show-tab', (e) => show((e as CustomEvent<string>).detail));
  return h('div', {}, tabList, panels);
}

function bindKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      if (e.shiftKey) { store.redo(); } else { store.undo(); }
    } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
      e.preventDefault();
      store.redo();
    } else if (e.code === 'Space' && !typing && target.tagName !== 'BUTTON') {
      e.preventDefault();
      store.generate();
    }
  });
}

function main(): void {
  const app = document.getElementById('app');
  if (!app) {
    return;
  }
  const saved = getViewState<{ working?: WorkingState; copyFormat?: ColorFormat }>();
  if (saved?.working) {
    store.set({ ...saved.working, copyFormat: saved.copyFormat ?? 'hex' });
  }
  append(app, createHeader(), createSwatchStrip(), createTabs());
  bindKeyboard();

  onHostMessage((msg) => {
    switch (msg.type) {
      case 'init':
        store.set({
          history: msg.history,
          palettes: msg.palettes,
          settings: msg.settings,
          ...(!saved?.working && msg.working ? msg.working : {})
        });
        break;
      case 'history':
        store.set({ history: msg.history });
        break;
      case 'palettes':
        store.set({ palettes: msg.palettes });
        break;
      case 'paletteSaved':
        store.set({ paletteId: msg.palette.id, name: msg.palette.name });
        toast(t('Saved "{0}"', msg.palette.name));
        break;
      case 'loadImage':
        loadImage(msg.dataUrl, msg.name).catch((err: Error) => toast(err.message));
        break;
      case 'showTab':
        window.dispatchEvent(new CustomEvent('cpc:show-tab', { detail: msg.tab }));
        break;
      case 'paletteRenamed':
        if (store.state.paletteId === msg.id) {
          store.set({ name: msg.name });
        }
        break;
      case 'paletteImported':
        store.loadColors(msg.palette.colors, msg.palette.name, msg.palette.id);
        toast(t('Imported "{0}"', msg.palette.name));
        break;
      default:
        break;
    }
  });
  post({ type: 'ready' });
}

main();
