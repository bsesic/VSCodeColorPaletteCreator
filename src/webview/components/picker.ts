/**
 * Color picker: saturation/value area, hue slider, RGB/HSL/brightness
 * sliders, HEX/RGB/HSL inputs, preset swatches and a screen eyedropper.
 */
import {
  HSV, ColorFormat, clamp, formatColor, hexToRgb, hsvToHex, parseColor, rgbToHex, rgbToHsl,
  rgbToHsv, hslToRgb
} from '../../core/color.js';
import { ICONS, append, h, iconButton } from '../dom.js';
import { toast } from '../toast.js';
import { t } from '../i18n.js';

export const PRESET_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
  '#795548', '#607D8B', '#000000', '#424242', '#9E9E9E', '#E0E0E0', '#F5F5F5', '#FFFFFF'
];

export interface PickerOptions {
  /** Called continuously while the color changes. */
  onChange: (hex: string) => void;
  /** Called once before a user interaction starts (used for undo checkpoints). */
  onStart?: () => void;
  /** Called when a user interaction has finished (used for history). */
  onCommit?: (hex: string) => void;
  onCopy?: (hex: string, format: ColorFormat) => void;
  compact?: boolean;
}

interface EyeDropperResult { sRGBHex: string }
interface EyeDropperCtor { new(): { open(): Promise<EyeDropperResult> } }

interface Slider {
  input: HTMLInputElement;
  value: HTMLInputElement;
  track: HTMLElement;
}

export class ColorPicker {
  readonly element: HTMLElement;
  private hsv: HSV = { h: 0, s: 0, v: 0 };
  private hex = '#000000';
  private area!: HTMLElement;
  private areaThumb!: HTMLElement;
  private hueSlider!: HTMLInputElement;
  private preview!: HTMLElement;
  private sliders: Record<string, Slider> = {};
  private inputs: Partial<Record<ColorFormat, HTMLInputElement>> = {};

  constructor(private readonly options: PickerOptions) {
    this.element = h('div', { class: `picker${options.compact ? ' compact' : ''}` });
    this.build();
  }

  get color(): string {
    return this.hex;
  }

  /** Sets the color from outside without emitting change events. */
  setColor(hex: string): void {
    const normalized = hex.toUpperCase();
    if (normalized === this.hex) {
      return;
    }
    const hsv = rgbToHsv(hexToRgb(normalized) ?? { r: 0, g: 0, b: 0 });
    // Keep the current hue when the new color is achromatic or black.
    if (hsv.s === 0 || hsv.v === 0) {
      hsv.h = this.hsv.h;
    }
    if (hsv.v === 0) {
      hsv.s = this.hsv.s;
    }
    this.hsv = hsv;
    this.hex = normalized;
    this.render();
  }

  private build(): void {
    this.area = h('div', { class: 'sv-area', tabindex: 0, 'aria-label': t('Saturation and brightness') });
    this.areaThumb = h('div', { class: 'thumb' });
    this.area.appendChild(this.areaThumb);
    this.bindArea();

    this.hueSlider = h('input', { type: 'range', min: 0, max: 360, step: 1, class: 'hue-slider', 'aria-label': t('Hue') });
    this.hueSlider.addEventListener('pointerdown', () => this.options.onStart?.());
    this.hueSlider.addEventListener('input', () => this.updateHsv({ h: Number(this.hueSlider.value) }));
    this.hueSlider.addEventListener('change', () => this.commit());

    this.preview = h('div', { class: 'picker-preview', title: t('Copy color') });
    this.preview.addEventListener('click', () => this.options.onCopy?.(this.hex, 'hex'));

    const eyedropper = iconButton(ICONS.pipette, t('Pick a color from the screen'), () => void this.pickFromScreen());

    const top = h('div', { class: 'picker-top' }, this.area);
    const hueRow = h('div', { class: 'picker-row' }, this.preview, h('div', { class: 'grow' }, this.hueSlider), eyedropper);

    const sliders = h('div', { class: 'sliders' });
    const groups: Array<[string, Array<[string, string, number]>]> = [
      ['RGB', [['r', 'R', 255], ['g', 'G', 255], ['b', 'B', 255]]],
      ['HSL', [['hh', 'H', 360], ['hs', 'S', 100], ['hl', t('Lightness'), 100]]],
      ['HSV', [['vs', t('Saturation'), 100], ['vv', t('Brightness'), 100]]]
    ];
    for (const [group, items] of groups) {
      const fieldset = h('fieldset', { class: 'slider-group' }, h('legend', {}, group));
      for (const [key, label, max] of items) {
        fieldset.appendChild(this.createSlider(key, label, max));
      }
      sliders.appendChild(fieldset);
    }

    const inputs = h('div', { class: 'format-inputs' });
    for (const format of ['hex', 'rgb', 'hsl'] as ColorFormat[]) {
      const input = h('input', { type: 'text', spellcheck: 'false', 'aria-label': format.toUpperCase() });
      input.addEventListener('change', () => {
        const parsed = parseColor(input.value);
        if (!parsed) {
          toast(t('"{0}" is not a valid color', input.value));
          this.render();
          return;
        }
        this.options.onStart?.();
        this.setColor(parsed);
        this.options.onChange(this.hex);
        this.commit();
      });
      this.inputs[format] = input;
      append(inputs, h('label', { class: 'format-input' },
        h('span', {}, format.toUpperCase()),
        input,
        iconButton(ICONS.copy, t('Copy {0}', format.toUpperCase()), () => this.options.onCopy?.(this.hex, format))));
    }

    const presets = h('div', { class: 'presets', role: 'list', 'aria-label': t('Preset colors') });
    for (const color of PRESET_COLORS) {
      presets.appendChild(h('button', {
        class: 'preset', type: 'button', role: 'listitem', title: color, style: `background:${color}`,
        onclick: () => {
          this.options.onStart?.();
          this.setColor(color);
          this.options.onChange(this.hex);
          this.commit();
        }
      }));
    }

    append(this.element, top, hueRow, inputs, sliders, h('div', { class: 'section-label' }, t('Swatches')), presets);
    this.render();
  }

  private createSlider(key: string, label: string, max: number): HTMLElement {
    const input = h('input', { type: 'range', min: 0, max, step: 1, 'aria-label': label });
    const value = h('input', { type: 'number', min: 0, max, step: 1, class: 'slider-value', 'aria-label': t('{0} value', label) });
    const track = h('div', { class: 'slider-track' }, input);
    const apply = (raw: string): void => this.applySlider(key, clamp(Number(raw) || 0, 0, max));
    input.addEventListener('pointerdown', () => this.options.onStart?.());
    input.addEventListener('input', () => apply(input.value));
    input.addEventListener('change', () => this.commit());
    value.addEventListener('change', () => {
      this.options.onStart?.();
      apply(value.value);
      this.commit();
    });
    this.sliders[key] = { input, value, track };
    return h('label', { class: 'slider' }, h('span', { class: 'slider-label' }, label), track, value);
  }

  private applySlider(key: string, value: number): void {
    const rgb = hexToRgb(this.hex) ?? { r: 0, g: 0, b: 0 };
    const hsl = rgbToHsl(rgb);
    hsl.h = this.hsv.h;
    switch (key) {
      case 'r': case 'g': case 'b':
        this.setFromRgb({ ...rgb, [key]: value });
        return;
      case 'hh': this.updateHsv({ h: value }); return;
      case 'hs': this.setFromRgb(hslToRgb({ ...hsl, s: value }), hsl.h); return;
      case 'hl': this.setFromRgb(hslToRgb({ ...hsl, l: value }), hsl.h); return;
      case 'vs': this.updateHsv({ s: value }); return;
      case 'vv': this.updateHsv({ v: value }); return;
    }
  }

  private setFromRgb(rgb: { r: number; g: number; b: number }, keepHue?: number): void {
    const hsv = rgbToHsv(rgb);
    if (keepHue !== undefined && (hsv.s === 0 || hsv.v === 0)) {
      hsv.h = keepHue;
    }
    this.hsv = hsv;
    this.hex = rgbToHex(rgb);
    this.render();
    this.options.onChange(this.hex);
  }

  private updateHsv(patch: Partial<HSV>): void {
    this.hsv = { ...this.hsv, ...patch };
    this.hex = hsvToHex(this.hsv);
    this.render();
    this.options.onChange(this.hex);
  }

  private commit(): void {
    this.options.onCommit?.(this.hex);
  }

  private bindArea(): void {
    const update = (e: PointerEvent): void => {
      const rect = this.area.getBoundingClientRect();
      const s = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 100;
      const v = (1 - clamp((e.clientY - rect.top) / rect.height, 0, 1)) * 100;
      this.updateHsv({ s, v });
    };
    this.area.addEventListener('pointerdown', (e) => {
      this.options.onStart?.();
      this.area.setPointerCapture(e.pointerId);
      update(e);
      const move = (ev: PointerEvent): void => update(ev);
      const up = (): void => {
        this.area.removeEventListener('pointermove', move);
        this.area.removeEventListener('pointerup', up);
        this.commit();
      };
      this.area.addEventListener('pointermove', move);
      this.area.addEventListener('pointerup', up);
    });
    this.area.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, Partial<HSV>> = {
        ArrowLeft: { s: clamp(this.hsv.s - step, 0, 100) },
        ArrowRight: { s: clamp(this.hsv.s + step, 0, 100) },
        ArrowUp: { v: clamp(this.hsv.v + step, 0, 100) },
        ArrowDown: { v: clamp(this.hsv.v - step, 0, 100) }
      };
      if (moves[e.key]) {
        e.preventDefault();
        this.options.onStart?.();
        this.updateHsv(moves[e.key]);
        this.commit();
      }
    });
  }

  /** Uses the Chromium EyeDropper API to pick a color anywhere on the screen. */
  private async pickFromScreen(): Promise<void> {
    const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!EyeDropper) {
      toast(t('The eyedropper is not supported in this environment.'));
      return;
    }
    try {
      const result = await new EyeDropper().open();
      const parsed = parseColor(result.sRGBHex);
      if (parsed) {
        this.options.onStart?.();
        this.setColor(parsed);
        this.options.onChange(this.hex);
        this.commit();
      }
    } catch {
      // The user cancelled the eyedropper (Escape).
    }
  }

  private render(): void {
    const { h: hue, s, v } = this.hsv;
    const rgb = hexToRgb(this.hex) ?? { r: 0, g: 0, b: 0 };
    const hsl = rgbToHsl(rgb);
    const pure = hsvToHex({ h: hue, s: 100, v: 100 });

    this.area.style.background =
      `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})`;
    this.areaThumb.style.left = `${s}%`;
    this.areaThumb.style.top = `${100 - v}%`;
    this.areaThumb.style.background = this.hex;
    this.hueSlider.value = String(Math.round(hue));
    this.preview.style.background = this.hex;

    const rgbCss = (r: number, g: number, b: number): string => `rgb(${r},${g},${b})`;
    const hslStops = (fn: (t: number) => string): string =>
      `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(fn).join(', ')})`;
    const values: Record<string, [number, string]> = {
      r: [rgb.r, `linear-gradient(to right, ${rgbCss(0, rgb.g, rgb.b)}, ${rgbCss(255, rgb.g, rgb.b)})`],
      g: [rgb.g, `linear-gradient(to right, ${rgbCss(rgb.r, 0, rgb.b)}, ${rgbCss(rgb.r, 255, rgb.b)})`],
      b: [rgb.b, `linear-gradient(to right, ${rgbCss(rgb.r, rgb.g, 0)}, ${rgbCss(rgb.r, rgb.g, 255)})`],
      hh: [hue, 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'],
      hs: [hsl.s, hslStops((x) => `hsl(${hue}, ${x * 100}%, ${hsl.l}%)`)],
      hl: [hsl.l, `linear-gradient(to right, #000, hsl(${hue}, ${hsl.s}%, 50%), #fff)`],
      vs: [s, `linear-gradient(to right, ${hsvToHex({ h: hue, s: 0, v })}, ${hsvToHex({ h: hue, s: 100, v })})`],
      vv: [v, `linear-gradient(to right, #000, ${hsvToHex({ h: hue, s, v: 100 })})`]
    };
    for (const [key, [value, gradient]] of Object.entries(values)) {
      const slider = this.sliders[key];
      if (!slider) { continue; }
      slider.input.value = String(Math.round(value));
      if (document.activeElement !== slider.value) {
        slider.value.value = String(Math.round(value));
      }
      slider.track.style.background = gradient;
    }
    for (const [format, input] of Object.entries(this.inputs)) {
      if (input && document.activeElement !== input) {
        input.value = formatColor(this.hex, format as ColorFormat);
      }
    }
  }
}
