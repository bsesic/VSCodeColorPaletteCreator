/**
 * Application state of the webview with undo/redo and the palette actions.
 */
import { ColorFormat, formatColor, hexToHsl, hslToHex, mix } from '../core/color.js';
import { HarmonyMode, applyHarmony, generateHarmony } from '../core/harmony.js';
import { Settings, Swatch, WorkingState } from '../core/messages.js';
import { Palette } from '../core/palette.js';
import { post, setViewState } from './api.js';
import { t } from './i18n.js';
import { toast } from './toast.js';

export const MIN_SWATCHES = 2;
export const MAX_SWATCHES = 12;

export interface AppState extends WorkingState {
  selected: number;
  history: string[];
  palettes: Palette[];
  copyFormat: ColorFormat;
  settings: Settings;
}

type Listener = (state: AppState) => void;

const DEFAULT_COLORS = ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'];

class Store {
  state: AppState = {
    name: t('Untitled palette'),
    swatches: DEFAULT_COLORS.map((hex) => ({ hex, locked: false })),
    baseIndex: 0,
    harmony: 'custom',
    selected: 0,
    history: [],
    palettes: [],
    copyFormat: 'hex',
    settings: { defaultExportFormat: 'css' }
  };

  private listeners: Listener[] = [];
  private undoStack: WorkingState[] = [];
  private redoStack: WorkingState[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  subscribe(listener: Listener): void {
    this.listeners.push(listener);
  }

  get working(): WorkingState {
    const { name, paletteId, swatches, baseIndex, harmony } = this.state;
    return { name, paletteId, swatches: swatches.map((s) => ({ ...s })), baseIndex, harmony };
  }

  get colors(): string[] {
    return this.state.swatches.map((s) => s.hex);
  }

  get selectedSwatch(): Swatch {
    return this.state.swatches[this.state.selected];
  }

  /** Updates the state and notifies listeners. Working copy changes are persisted (debounced). */
  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.state.selected = Math.min(this.state.selected, this.state.swatches.length - 1);
    this.state.baseIndex = Math.min(this.state.baseIndex, this.state.swatches.length - 1);
    this.listeners.forEach((l) => l(this.state));
    this.persist();
  }

  private persist(): void {
    setViewState({ working: this.working, copyFormat: this.state.copyFormat });
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => post({ type: 'saveWorking', working: this.working }), 400);
  }

  /** Records the current working state so it can be restored with undo. */
  checkpoint(): void {
    const snapshot = JSON.stringify(this.working);
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && JSON.stringify(last) === snapshot) {
      return;
    }
    this.undoStack.push(JSON.parse(snapshot) as WorkingState);
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): void {
    const prev = this.undoStack.pop();
    if (prev) {
      this.redoStack.push(this.working);
      this.set(prev);
    }
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push(this.working);
      this.set(next);
    }
  }

  // ----- Palette actions -------------------------------------------------

  /** Loads a list of colors as the working palette. */
  loadColors(colors: string[], name?: string, paletteId?: string): void {
    this.checkpoint();
    const swatches = colors.slice(0, MAX_SWATCHES).map((hex) => ({ hex: hex.toUpperCase(), locked: false }));
    this.set({
      swatches,
      name: name ?? this.state.name,
      paletteId,
      baseIndex: 0,
      selected: 0,
      harmony: 'custom'
    });
  }

  select(index: number): void {
    this.set({ selected: index });
  }

  /**
   * Sets the color of a swatch. Editing the base color re-applies the
   * current harmony; editing another swatch switches to "custom".
   */
  setColor(index: number, hex: string): void {
    const swatches = this.state.swatches.map((s, i) => (i === index ? { ...s, hex: hex.toUpperCase() } : s));
    const { harmony, baseIndex } = this.state;
    if (index === baseIndex && harmony !== 'custom' && harmony !== 'random') {
      const generated = generateHarmony(hex, harmony, swatches.length);
      this.set({ swatches: applyHarmony(swatches, baseIndex, generated) });
    } else if (index !== baseIndex && harmony !== 'custom') {
      this.set({ swatches, harmony: 'custom' });
    } else {
      this.set({ swatches });
    }
  }

  setHarmony(harmony: HarmonyMode): void {
    this.checkpoint();
    this.set({ harmony });
    if (harmony !== 'custom') {
      this.generate();
    }
  }

  /** Regenerates all unlocked swatches from the base color using the current harmony. */
  generate(): void {
    this.checkpoint();
    const { swatches, baseIndex } = this.state;
    let harmony = this.state.harmony;
    let base = swatches[baseIndex].hex;
    if (harmony === 'custom') {
      harmony = 'random';
    }
    if (harmony === 'random' && !swatches[baseIndex].locked) {
      // Random palettes also get a new base color.
      base = hslToHex({ h: Math.random() * 360, s: 40 + Math.random() * 50, l: 35 + Math.random() * 35 });
    }
    const generated = generateHarmony(base, harmony, swatches.length);
    this.set({ swatches: applyHarmony(swatches, baseIndex, generated) });
  }

  addSwatch(afterIndex = this.state.swatches.length - 1): void {
    const { swatches } = this.state;
    if (swatches.length >= MAX_SWATCHES) {
      toast(t('A palette can have at most {0} colors.', MAX_SWATCHES));
      return;
    }
    this.checkpoint();
    const current = swatches[afterIndex].hex;
    const next = swatches[afterIndex + 1]?.hex;
    let hex: string;
    if (next) {
      hex = mix(current, next, 0.5);
    } else {
      const hsl = hexToHsl(current);
      hex = hslToHex({ ...hsl, l: hsl.l > 50 ? hsl.l - 18 : hsl.l + 18 });
    }
    const updated = [...swatches];
    updated.splice(afterIndex + 1, 0, { hex, locked: false });
    const baseIndex = this.state.baseIndex > afterIndex ? this.state.baseIndex + 1 : this.state.baseIndex;
    this.set({ swatches: updated, selected: afterIndex + 1, baseIndex });
  }

  removeSwatch(index: number): void {
    const { swatches } = this.state;
    if (swatches.length <= MIN_SWATCHES) {
      toast(t('A palette needs at least {0} colors.', MIN_SWATCHES));
      return;
    }
    this.checkpoint();
    const updated = swatches.filter((_, i) => i !== index);
    let { baseIndex, selected } = this.state;
    if (baseIndex === index) {
      baseIndex = 0;
    } else if (baseIndex > index) {
      baseIndex--;
    }
    if (selected >= index && selected > 0) {
      selected--;
    }
    this.set({ swatches: updated, baseIndex, selected });
  }

  moveSwatch(from: number, to: number): void {
    if (from === to) {
      return;
    }
    this.checkpoint();
    const updated = [...this.state.swatches];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    const remap = (i: number): number => {
      if (i === from) { return to; }
      if (from < i && i <= to) { return i - 1; }
      if (to <= i && i < from) { return i + 1; }
      return i;
    };
    this.set({ swatches: updated, baseIndex: remap(this.state.baseIndex), selected: remap(this.state.selected) });
  }

  toggleLock(index: number): void {
    const swatches = this.state.swatches.map((s, i) => (i === index ? { ...s, locked: !s.locked } : s));
    this.set({ swatches });
  }

  setBase(index: number): void {
    this.checkpoint();
    this.set({ baseIndex: index, selected: index });
    if (this.state.harmony !== 'custom' && this.state.harmony !== 'random') {
      this.setColor(index, this.state.swatches[index].hex);
    }
  }

  // ----- Clipboard and history --------------------------------------------

  copyColor(hex: string, format: ColorFormat = this.state.copyFormat): void {
    const text = formatColor(hex, format);
    post({ type: 'copy', text });
    this.addToHistory([hex]);
    toast(t('Copied {0}', text), hex);
  }

  copyText(text: string, label: string): void {
    post({ type: 'copy', text, label });
    toast(t('Copied {0}', label));
  }

  addToHistory(colors: string[]): void {
    post({ type: 'history:add', colors });
  }
}

export const store = new Store();
