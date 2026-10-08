/**
 * History tab: recently used colors.
 */
import { formatColor, readableTextColor } from '../../core/color.js';
import { ICONS, clear, h, iconButton } from '../dom.js';
import { post } from '../api.js';
import { store } from '../store.js';
import { View } from './view.js';

export function createHistoryView(): View {
  const grid = h('div', { class: 'history-grid' });
  const empty = h('p', { class: 'hint' }, 'Colors you copy, pick or edit appear here.');
  const clearButton = h('button', { type: 'button', html: `${ICONS.trash} Clear history` });
  clearButton.addEventListener('click', () => post({ type: 'history:clear' }));
  const addAll = h('button', { type: 'button', title: 'Use the 5 most recent colors as palette' }, 'Use recent as palette');
  addAll.addEventListener('click', () => store.loadColors(store.state.history.slice(0, 5)));

  let lastRendered = '';
  store.subscribe((state) => {
    const key = state.history.join();
    if (key === lastRendered) {
      return;
    }
    lastRendered = key;
    clear(grid);
    empty.hidden = state.history.length > 0;
    for (const hex of state.history) {
      const apply = (): void => {
        store.checkpoint();
        store.setColor(store.state.selected, hex);
      };
      grid.appendChild(h('div', { class: 'history-item' },
        h('button', {
          class: 'history-swatch', type: 'button', style: `background:${hex};color:${readableTextColor(hex)}`,
          title: `Apply ${hex} to the selected swatch`, onclick: apply
        }, hex),
        h('div', { class: 'history-meta' },
          h('span', {}, formatColor(hex, 'rgb')),
          iconButton(ICONS.copy, `Copy ${hex}`, () => store.copyColor(hex)))));
    }
  });

  const element = h('section', { class: 'card' },
    h('div', { class: 'toolbar' }, h('h3', { class: 'panel-title grow' }, 'History'), addAll, clearButton),
    empty, grid);
  return { id: 'history', label: 'History', element };
}
