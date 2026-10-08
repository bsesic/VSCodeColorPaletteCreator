/**
 * Contrast checker: WCAG 2.x ratio, AA/AAA ratings, preview, suggestions
 * and a contrast matrix of the current palette.
 */
import { parseColor } from '../../core/color.js';
import { contrastRatio, rateContrast, suggestForeground } from '../../core/contrast.js';
import { clear, h } from '../dom.js';
import { store } from '../store.js';
import { toast } from '../toast.js';
import { View } from './view.js';
import { t } from '../i18n.js';

export function createContrastView(): View {
  let fg = '#FFFFFF';
  let bg = store.colors[0] ?? '#000000';

  const ratioEl = h('div', { class: 'ratio' });
  const badges = h('div', { class: 'badges' });
  const preview = h('div', { class: 'contrast-preview' },
    h('div', { class: 'large-text' }, t('Large text (24px)')),
    h('p', {}, t('Normal body text (16px). The quick brown fox jumps over the lazy dog.')),
    h('button', { type: 'button', class: 'sample-button', tabindex: -1 }, t('Button')));
  const suggestions = h('div', { class: 'suggestions' });
  const matrix = h('div', { class: 'matrix-wrap' });

  const colorField = (label: string, get: () => string, set: (hex: string) => void): { el: HTMLElement; sync: () => void } => {
    const picker = h('input', { type: 'color', 'aria-label': t('{0} color', label) });
    const text = h('input', { type: 'text', class: 'hex-input', 'aria-label': t('{0} color code', label) });
    const chips = h('div', { class: 'chips' });
    picker.addEventListener('input', () => { set(picker.value.toUpperCase()); render(); });
    text.addEventListener('change', () => {
      const parsed = parseColor(text.value);
      if (parsed) { set(parsed); render(); } else { toast(t('Invalid color')); text.value = get(); }
    });
    const sync = (): void => {
      picker.value = get().toLowerCase();
      if (document.activeElement !== text) { text.value = get(); }
      clear(chips);
      for (const hex of [...new Set([...store.colors, '#FFFFFF', '#000000'])]) {
        chips.appendChild(h('button', {
          class: `chip${hex === get() ? ' active' : ''}`, type: 'button', title: hex, style: `background:${hex}`,
          onclick: () => { set(hex); render(); }
        }));
      }
    };
    return { el: h('div', { class: 'color-field' }, h('span', { class: 'field-label' }, label), h('div', { class: 'picker-row' }, picker, text), chips), sync };
  };

  const fgField = colorField(t('Text / foreground'), () => fg, (v) => { fg = v; });
  const bgField = colorField(t('Background'), () => bg, (v) => { bg = v; });
  const swap = h('button', { type: 'button', title: t('Swap colors'), onclick: () => { [fg, bg] = [bg, fg]; render(); } }, t('⇄ Swap'));

  const badge = (label: string, pass: boolean, detail: string): HTMLElement =>
    h('div', { class: `badge ${pass ? 'pass' : 'fail'}`, title: detail },
      h('strong', {}, pass ? t('Pass') : t('Fail')), h('span', {}, label));

  function render(): void {
    fgField.sync();
    bgField.sync();
    const rating = rateContrast(fg, bg);
    ratioEl.textContent = `${rating.ratio.toFixed(2)} : 1`;
    clear(badges);
    badges.append(
      badge(t('AA normal text'), rating.aaNormal, t('Requires 4.5:1')),
      badge(t('AA large text'), rating.aaLarge, t('Requires 3:1 (24px or 18.66px bold)')),
      badge(t('AAA normal text'), rating.aaaNormal, t('Requires 7:1')),
      badge(t('AAA large text'), rating.aaaLarge, t('Requires 4.5:1')),
      badge(t('UI components'), rating.uiComponents, t('Requires 3:1 for icons, borders and controls')));
    preview.style.background = bg;
    preview.style.color = fg;
    preview.style.setProperty('--sample-border', fg);

    clear(suggestions);
    for (const [label, target] of [['AA', 4.5], ['AAA', 7]] as Array<[string, number]>) {
      if (rating.ratio >= target) { continue; }
      const suggestion = suggestForeground(fg, bg, target);
      suggestions.appendChild(suggestion
        ? h('div', { class: 'suggestion' },
          h('span', { class: 'chip static', style: `background:${suggestion}` }),
          `${label}: ${suggestion} (${contrastRatio(suggestion, bg).toFixed(2)}:1)`,
          h('button', { type: 'button', onclick: () => { fg = suggestion; render(); } }, t('Apply')),
          h('button', { type: 'button', onclick: () => store.copyColor(suggestion) }, t('Copy')))
        : h('div', { class: 'suggestion' }, t('{0}: no foreground with this hue reaches {1}:1 on this background.', label, target)));
    }
    renderMatrix();
  }

  function renderMatrix(): void {
    clear(matrix);
    const colors = store.colors;
    const table = h('table', { class: 'matrix' });
    const head = h('tr', {}, h('th', {}, t('Text ↓ / Background →')));
    colors.forEach((c) => head.appendChild(h('th', {}, h('span', { class: 'chip static', style: `background:${c}` }), c)));
    table.appendChild(head);
    colors.forEach((rowColor) => {
      const tr = h('tr', {}, h('th', {}, h('span', { class: 'chip static', style: `background:${rowColor}` }), rowColor));
      colors.forEach((colColor) => {
        const ratio = contrastRatio(rowColor, colColor);
        const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : '–';
        tr.appendChild(h('td', {
          class: `cell level-${level === '–' ? 'none' : level.replace(' ', '-').toLowerCase()}`,
          style: `background:${colColor};color:${rowColor}`, title: t('Check this pair'),
          onclick: () => { fg = rowColor; bg = colColor; render(); }
        }, h('strong', {}, ratio.toFixed(1)), h('small', {}, level === 'AA Large' ? t('AA Large') : level)));
      });
      table.appendChild(tr);
    });
    matrix.appendChild(table);
  }

  store.subscribe(() => render());
  render();

  const element = h('div', { class: 'contrast-view' },
    h('section', { class: 'card' },
      h('h3', { class: 'panel-title' }, t('Contrast checker (WCAG 2.x)')),
      h('div', { class: 'contrast-grid' },
        h('div', { class: 'contrast-inputs' }, fgField.el, swap, bgField.el),
        h('div', {}, ratioEl, badges, preview, suggestions))),
    h('section', { class: 'card' },
      h('h3', { class: 'panel-title' }, t('Palette contrast matrix')),
      h('p', { class: 'hint' }, t('Click a cell to inspect the pair.')),
      matrix));
  return { id: 'contrast', label: t('Contrast'), element };
}
