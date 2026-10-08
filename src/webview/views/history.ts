/**
 * History tab: recently used colors.
 */
import { formatColor, readableTextColor } from '../../core/color.js';
import { ICONS, clear, h, iconButton, iconText } from '../dom.js';
import { post } from '../api.js';
import { store } from '../store.js';
import { View } from './view.js';
import { t } from '../i18n.js';

export function createHistoryView(): View {
  const grid = h('div', { class: 'history-grid' });
  const empty = h('p', { class: 'hint' }, t('Colors you copy, pick or edit appear here.'));
  const clearButton = h('button', { type: 'button', html: iconText(ICONS.trash, t('Clear history')) });
  clearButton.addEventListener('click', () => post({ type: 'history:clear' }));
  const addAll = h('button', { type: 'button', title: t('Use the 5 most recent colors as palette') }, t('Use recent as palette'));
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
          title: t('Apply {0} to the selected swatch', hex), onclick: apply
        }, hex),
        h('div', { class: 'history-meta' },
          h('span', {}, formatColor(hex, 'rgb')),
          iconButton(ICONS.copy, t('Copy {0}', hex), () => store.copyColor(hex)))));
    }
  });

  const element = h('section', { class: 'card' },
    h('div', { class: 'toolbar' }, h('h3', { class: 'panel-title grow' }, t('History')), addAll, clearButton),
    empty, grid);
  return { id: 'history', label: t('History'), element };
}
