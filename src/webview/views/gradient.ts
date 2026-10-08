/**
 * Gradient generator: edit stops, choose type, angle and interpolation
 * space, copy/insert the CSS and convert gradient steps into a palette.
 */
import { parseColor, readableTextColor } from '../../core/color.js';
import {
  GradientStop, GradientType, InterpolationSpace, colorAt, evenStops, gradientSteps, toCssGradient
} from '../../core/gradient.js';
import { post } from '../api.js';
import { ICONS, clear, h, iconButton, iconText, select } from '../dom.js';
import { MAX_SWATCHES, store } from '../store.js';
import { toast } from '../toast.js';
import { gradientTargets } from './image.js';
import { View } from './view.js';
import { t } from '../i18n.js';

export function createGradientView(): View {
  let stops: GradientStop[] = evenStops(store.colors.slice(0, 3));
  let type: GradientType = 'linear';
  let angle = 90;
  let space: InterpolationSpace = 'oklab';
  let steps = 5;

  const preview = h('div', { class: 'gradient-preview', title: t('Click to add a color stop') });
  const stopBar = h('div', { class: 'stop-bar', title: t('Click to add a color stop') });
  const stopList = h('div', { class: 'stop-list' });
  const code = h('pre', { class: 'code' });
  const stepRow = h('div', { class: 'result-swatches' });

  const angleInput = h('input', { type: 'range', min: 0, max: 360, step: 1, value: angle, class: 'grow', 'aria-label': t('Angle') });
  const angleValue = h('span', { class: 'value-label' });
  angleInput.addEventListener('input', () => { angle = Number(angleInput.value); render(); });
  const stepsInput = h('input', { type: 'number', min: 2, max: MAX_SWATCHES, value: steps, 'aria-label': t('Steps') });
  stepsInput.addEventListener('change', () => {
    steps = Math.max(2, Math.min(MAX_SWATCHES, Number(stepsInput.value) || 5));
    stepsInput.value = String(steps);
    render();
  });
  const angleRow = h('label', { class: 'slider-row' }, h('span', {}, t('Angle')), angleInput, angleValue);

  const typeSelect = select<GradientType>([
    { id: 'linear', label: t('Linear') }, { id: 'radial', label: t('Radial') }, { id: 'conic', label: t('Conic') }
  ], type, (t) => { type = t; render(); }, t('Gradient type'));
  const spaceSelect = select<InterpolationSpace>([
    { id: 'oklab', label: t('OKLab (perceptual)') }, { id: 'rgb', label: 'RGB' }, { id: 'hsl', label: 'HSL' }
  ], space, (s) => { space = s; render(); }, t('Interpolation'));

  const setStops = (colors: string[]): void => {
    stops = evenStops(colors);
    render();
  };
  gradientTargets.push((colors) => {
    setStops(colors);
    window.dispatchEvent(new CustomEvent('cpc:show-tab', { detail: 'gradient' }));
  });

  const addStopAt = (e: MouseEvent, target: HTMLElement): void => {
    const rect = target.getBoundingClientRect();
    const position = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    stops.push({ color: colorAt(stops, position, space), position });
    render();
  };
  stopBar.addEventListener('click', (e) => addStopAt(e, stopBar));
  preview.addEventListener('click', (e) => {
    if (type === 'linear') { addStopAt(e, preview); }
  });

  const css = (): string => toCssGradient(type, angle, stops, space);

  function renderStops(): void {
    clear(stopList);
    const sorted = stops.map((s, i) => ({ s, i })).sort((a, b) => a.s.position - b.s.position);
    sorted.forEach(({ s: stop }) => {
      const colorInput = h('input', { type: 'color', value: stop.color.toLowerCase(), 'aria-label': t('Stop color') });
      colorInput.addEventListener('input', () => { stop.color = colorInput.value.toUpperCase(); renderOutput(); updateStopBar(); hexInput.value = stop.color; });
      const hexInput = h('input', { type: 'text', value: stop.color, class: 'hex-input', 'aria-label': t('Stop color code') });
      hexInput.addEventListener('change', () => {
        const parsed = parseColor(hexInput.value);
        if (parsed) { stop.color = parsed; render(); } else { toast(t('Invalid color')); hexInput.value = stop.color; }
      });
      const pos = h('input', { type: 'range', min: 0, max: 100, step: 0.5, value: stop.position, class: 'grow', 'aria-label': t('Stop position') });
      const posLabel = h('span', { class: 'value-label' }, `${stop.position}%`);
      pos.addEventListener('input', () => { stop.position = Number(pos.value); posLabel.textContent = `${stop.position}%`; renderOutput(); updateStopBar(); });
      pos.addEventListener('change', () => renderStops());
      stopList.appendChild(h('div', { class: 'stop-row' }, colorInput, hexInput, pos, posLabel,
        stops.length > 2 ? iconButton(ICONS.trash, t('Remove stop'), () => { stops.splice(stops.indexOf(stop), 1); render(); }) : null));
    });
  }

  function updateStopBar(): void {
    clear(stopBar);
    stopBar.style.background = toCssGradient('linear', 90, stops, space);
    stops.forEach((stop) => stopBar.appendChild(h('span', {
      class: 'stop-handle', style: `left:${stop.position}%;background:${stop.color}`, title: `${stop.color} ${stop.position}%`
    })));
  }

  function renderOutput(): void {
    const value = css();
    preview.style.background = value;
    code.textContent = `background: ${value};`;
    clear(stepRow);
    gradientSteps(stops, steps, space).forEach((hex) => stepRow.appendChild(h('button', {
      class: 'result-swatch', type: 'button', style: `background:${hex};color:${readableTextColor(hex)}`,
      title: t('Copy {0}', hex), onclick: () => store.copyColor(hex)
    }, hex)));
  }

  function render(): void {
    angleValue.textContent = `${angle}°`;
    angleRow.hidden = type === 'radial';
    renderStops();
    updateStopBar();
    renderOutput();
  }

  const element = h('section', { class: 'card gradient-view' },
    h('h3', { class: 'panel-title' }, t('Gradient generator')),
    h('div', { class: 'toolbar' },
      h('label', { class: 'inline-label' }, t('Type'), typeSelect),
      h('label', { class: 'inline-label' }, t('Interpolation'), spaceSelect),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', onclick: () => setStops(store.colors) }, t('Use palette colors')),
      h('button', { type: 'button', onclick: () => setStops([...stops].sort((a, b) => a.position - b.position).map((s) => s.color).reverse()) }, t('Reverse')),
      h('button', { type: 'button', onclick: () => { stops.push({ color: colorAt(stops, 50, space), position: 50 }); render(); }, html: iconText(ICONS.plus, t('Add stop')) })),
    angleRow, preview, stopBar, stopList,
    h('div', { class: 'section-label' }, 'CSS'), code,
    h('div', { class: 'toolbar' },
      h('button', { type: 'button', class: 'primary', onclick: () => store.copyText(code.textContent ?? '', t('CSS gradient')), html: iconText(ICONS.copy, t('Copy CSS')) }),
      h('button', { type: 'button', onclick: () => post({ type: 'insert', text: code.textContent ?? '' }), html: iconText(ICONS.insert, t('Insert into editor')) })),
    h('div', { class: 'section-label' }, t('Gradient steps')),
    h('div', { class: 'toolbar' }, h('label', { class: 'inline-label' }, t('Steps'), stepsInput),
      h('button', { type: 'button', onclick: () => store.loadColors(gradientSteps(stops, steps, space)) }, t('Use steps as palette'))),
    stepRow);
  render();
  return { id: 'gradient', label: t('Gradient'), element };
}
