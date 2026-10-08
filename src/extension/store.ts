import * as vscode from 'vscode';
import { WorkingState } from '../core/messages';
import { Palette } from '../core/palette';
import { createId } from '../core/random';

const PALETTES_KEY = 'colorPaletteCreator.palettes';
const HISTORY_KEY = 'colorPaletteCreator.history';
const WORKING_KEY = 'colorPaletteCreator.working';

/**
 * Persists palettes, the color history and the working palette in the
 * extension's global state so they are available in every workspace.
 */
export class PaletteStore {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  /** Fires whenever the stored palettes or history change. */
  readonly onDidChange = this.changeEmitter.event;

  constructor(private readonly memento: vscode.Memento) {}

  get palettes(): Palette[] {
    return this.memento.get<Palette[]>(PALETTES_KEY, []);
  }

  get history(): string[] {
    return this.memento.get<string[]>(HISTORY_KEY, []);
  }

  get working(): WorkingState | undefined {
    return this.memento.get<WorkingState>(WORKING_KEY);
  }

  async setWorking(working: WorkingState): Promise<void> {
    await this.memento.update(WORKING_KEY, working);
  }

  getPalette(id: string): Palette | undefined {
    return this.palettes.find((p) => p.id === id);
  }

  /** Creates a new palette or updates an existing one (matched by id). */
  async savePalette(input: { id?: string; name: string; colors: string[] }): Promise<Palette> {
    const now = Date.now();
    const palettes = this.palettes;
    const existing = input.id ? palettes.find((p) => p.id === input.id) : undefined;
    let palette: Palette;
    if (existing) {
      palette = { ...existing, name: input.name, colors: [...input.colors], updatedAt: now };
      palettes[palettes.indexOf(existing)] = palette;
    } else {
      palette = { id: createId(), name: input.name, colors: [...input.colors], createdAt: now, updatedAt: now };
      palettes.unshift(palette);
    }
    await this.memento.update(PALETTES_KEY, palettes);
    this.changeEmitter.fire();
    return palette;
  }

  async renamePalette(id: string, name: string): Promise<void> {
    const palette = this.getPalette(id);
    if (palette) {
      await this.savePalette({ ...palette, name });
    }
  }

  async deletePalette(id: string): Promise<void> {
    await this.memento.update(PALETTES_KEY, this.palettes.filter((p) => p.id !== id));
    this.changeEmitter.fire();
  }

  /** Adds colors to the front of the history, removing duplicates. */
  async addToHistory(colors: string[], limit: number): Promise<string[]> {
    const normalized = colors.map((c) => c.toUpperCase());
    const history = [...new Set([...normalized.reverse(), ...this.history])].slice(0, limit);
    await this.memento.update(HISTORY_KEY, history);
    this.changeEmitter.fire();
    return history;
  }

  async clearHistory(): Promise<void> {
    await this.memento.update(HISTORY_KEY, []);
    this.changeEmitter.fire();
  }
}
