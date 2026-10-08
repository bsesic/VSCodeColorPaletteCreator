/**
 * The palette swatch strip: select, edit, copy, lock, set base color, edit
 * tint/shade, reorder via drag and drop, add and delete swatches.
 */
import { describeColor, formatColor, readableTextColor, tintShadeScale } from '../../core/color.js';
import { ICONS, append, clear, h, iconButton } from '../dom.js';
import { AppState, MAX_SWATCHES, MIN_SWATCHES, store } from '../store.js';

export function createSwatchStrip(): HTMLElement {
  const strip = h('div', { class: 'swatch-strip', role: 'listbox', 'aria-label': 'Palette colors' });
  let tintIndex = -1;
  let dragFrom = -1;
  let signature = '';
  const parts: Array<{ root: HTMLElement; hex: HTMLElement; name: HTMLElement; tints?: HTMLElement }> = [];

  const buildTints = (index: number, hex: string): HTMLElement => {
    const box = h('div', { class: 'tint-overlay', role: 'list', 'aria-label': 'Tints and shades' });
    // Light tints on top, dark shades at the bottom.
    for (const tint of tintShadeScale(hex, 11).reverse()) {
      box.appendChild(h('button', {
        class: `tint${tint === hex.toUpperCase() ? ' current' : ''}`, type: 'button', role: 'listitem',
        style: `background:${tint};color:${readableTextColor(tint)}`, title: tint,
        onclick: (e: Event) => {
          e.stopPropagation();
          store.checkpoint();
          store.setColor(index, tint);
          store.addToHistory([tint]);
          tintIndex = -1;
          render(store.state);
        }
      }, tint));
    }
    return box;
  };

  const build = (state: AppState): void => {
    clear(strip);
    parts.length = 0;
    state.swatches.forEach((swatch, index) => {
      const isBase = index === state.baseIndex;
      const hexLabel = h('button', { class: 'swatch-hex', type: 'button', title: 'Copy color code' });
      hexLabel.addEventListener('click', (e) => {
        e.stopPropagation();
        store.copyColor(store.state.swatches[index].hex);
      });
      const name = h('span', { class: 'swatch-name' });
      const actions = h('div', { class: 'swatch-actions' },
        iconButton(swatch.locked ? ICONS.lock : ICONS.unlock, swatch.locked ? 'Unlock' : 'Lock (keep when generating)',
          (e) => { e.stopPropagation(); store.toggleLock(index); }, swatch.locked ? 'active' : ''),
        iconButton(isBase ? ICONS.star : ICONS.starOutline, isBase ? 'Base color' : 'Set as base color',
          (e) => { e.stopPropagation(); store.setBase(index); }, isBase ? 'active' : ''),
        iconButton(ICONS.tint, 'Edit tint / shade', (e) => {
          e.stopPropagation();
          tintIndex = tintIndex === index ? -1 : index;
          render(store.state);
        }, tintIndex === index ? 'active' : ''),
        iconButton(ICONS.copy, 'Copy color code', (e) => { e.stopPropagation(); store.copyColor(store.state.swatches[index].hex); }),
        iconButton(ICONS.plus, 'Add a color after this one', (e) => { e.stopPropagation(); store.addSwatch(index); }),
        state.swatches.length > MIN_SWATCHES
          ? iconButton(ICONS.trash, 'Delete color', (e) => { e.stopPropagation(); store.removeSwatch(index); })
          : null,
        h('span', { class: 'drag-handle', title: 'Drag to reorder', html: ICONS.drag }));

      const root = h('div', {
        class: `swatch${index === state.selected ? ' selected' : ''}${swatch.locked ? ' locked' : ''}`,
        role: 'option', 'aria-selected': String(index === state.selected), tabindex: 0, draggable: 'true'
      }, actions, h('div', { class: 'swatch-label' }, hexLabel, name),
      isBase ? h('span', { class: 'base-badge', title: 'Base color', html: ICONS.star }) : null,
      swatch.locked ? h('span', { class: 'lock-badge', title: 'Locked', html: ICONS.lock }) : null);
      root.addEventListener('click', () => store.select(index));
      root.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { store.select(index); }
        if (e.key === 'Delete') { store.removeSwatch(index); }
      });
      root.addEventListener('dragstart', (e) => {
        dragFrom = index;
        root.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', store.state.swatches[index].hex);
      });
      root.addEventListener('dragend', () => root.classList.remove('dragging'));
      root.addEventListener('dragover', (e) => { e.preventDefault(); root.classList.add('drop-target'); });
      root.addEventListener('dragleave', () => root.classList.remove('drop-target'));
      root.addEventListener('drop', (e) => {
        e.preventDefault();
        root.classList.remove('drop-target');
        if (dragFrom >= 0) {
          store.moveSwatch(dragFrom, index);
        }
        dragFrom = -1;
      });

      const part: { root: HTMLElement; hex: HTMLElement; name: HTMLElement; tints?: HTMLElement } = { root, hex: hexLabel, name };
      if (tintIndex === index) {
        part.tints = buildTints(index, swatch.hex);
        root.appendChild(part.tints);
      }
      parts.push(part);
      strip.appendChild(root);
    });
    if (state.swatches.length < MAX_SWATCHES) {
      strip.appendChild(h('button', {
        class: 'add-swatch', type: 'button', title: 'Add color', 'aria-label': 'Add color', html: ICONS.plus,
        onclick: () => store.addSwatch()
      }));
    }
  };

  const render = (state: AppState): void => {
    if (tintIndex >= state.swatches.length) {
      tintIndex = -1;
    }
    const next = JSON.stringify([state.swatches.map((s) => s.locked), state.baseIndex, state.selected, tintIndex]);
    if (next !== signature) {
      signature = next;
      build(state);
    }
    state.swatches.forEach((swatch, i) => {
      const part = parts[i];
      const fg = readableTextColor(swatch.hex);
      part.root.style.background = swatch.hex;
      part.root.style.color = fg;
      part.hex.textContent = formatColor(swatch.hex, state.copyFormat);
      part.name.textContent = describeColor(swatch.hex);
      part.root.setAttribute('aria-label', `${swatch.hex} ${describeColor(swatch.hex)}`);
    });
  };

  document.addEventListener('click', (e) => {
    if (tintIndex >= 0 && !(e.target as Element).closest('.swatch')) {
      tintIndex = -1;
      render(store.state);
    }
  });
  store.subscribe(render);
  render(store.state);
  const wrapper = h('div', { class: 'swatch-wrapper' });
  append(wrapper, strip);
  return wrapper;
}
