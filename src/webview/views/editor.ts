/**
 * Editor tab: color wheel with harmony generation and the color picker for
 * the selected swatch.
 */
import { clamp, describeColor, hexToHsv, hsvToHex } from '../../core/color.js';
import { HARMONY_MODES, HarmonyMode } from '../../core/harmony.js';
import { ColorPicker } from '../components/picker.js';
import { ColorWheel } from '../components/wheel.js';
import { ICONS, append, h, select } from '../dom.js';
import { AppState, store } from '../store.js';
import { View } from './view.js';

export function createEditorView(): View {
  let dragOffset = 0;

  const usesHarmony = (): boolean => store.state.harmony !== 'custom' && store.state.harmony !== 'random';

  const wheel = new ColorWheel({
    onSelect: (index) => store.select(index),
    onDragStart: (index) => {
      store.checkpoint();
      const { swatches, baseIndex } = store.state;
      dragOffset = hexToHsv(swatches[index].hex).h - hexToHsv(swatches[baseIndex].hex).h;
    },
    onDrag: (index, hue, sat) => {
      const { swatches, baseIndex } = store.state;
      if (usesHarmony()) {
        // Moving any marker rotates the whole harmony around the wheel.
        const base = hexToHsv(swatches[baseIndex].hex);
        const s = index === baseIndex ? sat : base.s;
        store.setColor(baseIndex, hsvToHex({ h: hue - dragOffset, s, v: base.v }));
      } else {
        const current = hexToHsv(swatches[index].hex);
        store.setColor(index, hsvToHex({ h: hue, s: sat, v: current.v }));
      }
    },
    onDragEnd: (index) => store.addToHistory([store.state.swatches[index].hex])
  });

  const harmonySelect = select(HARMONY_MODES, store.state.harmony, (mode: HarmonyMode) => store.setHarmony(mode), 'Color harmony');
  const generateButton = h('button', { class: 'primary', type: 'button', title: 'Generate (Space)', html: `${ICONS.refresh} Generate` });
  generateButton.addEventListener('click', () => store.generate());

  const brightness = h('input', { type: 'range', min: 0, max: 100, step: 1, class: 'grow', 'aria-label': 'Brightness' });
  const brightnessTarget = (): number => (usesHarmony() ? store.state.baseIndex : store.state.selected);
  brightness.addEventListener('pointerdown', () => store.checkpoint());
  brightness.addEventListener('input', () => {
    const index = brightnessTarget();
    const hsv = hexToHsv(store.state.swatches[index].hex);
    store.setColor(index, hsvToHex({ ...hsv, v: clamp(Number(brightness.value), 0, 100) }));
  });

  const picker = new ColorPicker({
    onStart: () => store.checkpoint(),
    onChange: (hex) => store.setColor(store.state.selected, hex),
    onCommit: (hex) => store.addToHistory([hex]),
    onCopy: (hex, format) => store.copyColor(hex, format)
  });
  const pickerTitle = h('h3', { class: 'panel-title' });

  const wheelColumn = h('section', { class: 'card wheel-card' },
    h('h3', { class: 'panel-title' }, 'Color wheel'),
    h('div', { class: 'toolbar' }, h('label', { class: 'inline-label' }, 'Harmony', harmonySelect), generateButton),
    wheel.element,
    h('label', { class: 'slider-row' }, h('span', {}, 'Brightness'), brightness),
    h('p', { class: 'hint' },
      'Drag the markers to change colors. With a harmony selected, all markers move together around the base color (★). ',
      'Locked swatches are kept when generating.'));
  const pickerColumn = h('section', { class: 'card' }, pickerTitle, picker.element);
  const element = h('div', { class: 'editor-view' });
  append(element, wheelColumn, pickerColumn);

  const render = (state: AppState): void => {
    const colors = state.swatches.map((s) => s.hex);
    const selectedHex = colors[state.selected];
    const target = usesHarmony() ? state.baseIndex : state.selected;
    const v = hexToHsv(colors[target]).v;
    wheel.update(colors, state.baseIndex, state.selected, v);
    if (document.activeElement !== brightness) {
      brightness.value = String(Math.round(v));
    }
    harmonySelect.value = state.harmony;
    picker.setColor(selectedHex);
    pickerTitle.textContent = `Color ${state.selected + 1}${state.selected === state.baseIndex ? ' (base)' : ''} · ${describeColor(selectedHex)}`;
  };
  store.subscribe(render);
  render(store.state);

  return { id: 'editor', label: 'Editor', element };
}
