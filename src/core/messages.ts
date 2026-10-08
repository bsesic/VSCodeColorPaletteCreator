/**
 * Message protocol between the extension host and the webview.
 */
import { HarmonyMode } from './harmony.js';
import { ExportFormat, Palette } from './palette.js';
import { ColorGroup } from './scan.js';

export interface Swatch {
  hex: string;
  locked: boolean;
}

/** The palette currently being edited in the webview. */
export interface WorkingState {
  name: string;
  /** Id of the saved palette this working copy belongs to, if any. */
  paletteId?: string;
  swatches: Swatch[];
  baseIndex: number;
  harmony: HarmonyMode;
}

export interface Settings {
  defaultExportFormat: ExportFormat;
}

/** Colors found in the currently edited text document. */
export interface DocumentColors {
  uri: string;
  /** Workspace relative path, or only the file name for files outside the workspace. */
  fileName: string;
  /** Full path, shown as tooltip only. */
  path: string;
  languageId: string;
  groups: ColorGroup[];
  tooLarge: boolean;
  autoSave: boolean;
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'copy'; text: string; label?: string }
  | { type: 'insert'; text: string }
  | { type: 'notify'; level: 'info' | 'warning' | 'error'; message: string }
  | { type: 'saveWorking'; working: WorkingState }
  | { type: 'history:add'; colors: string[] }
  | { type: 'history:clear' }
  | { type: 'palette:save'; palette: { id?: string; name: string; colors: string[] } }
  | { type: 'palette:rename'; id: string }
  | { type: 'palette:duplicate'; id: string }
  | { type: 'palette:delete'; id: string }
  | { type: 'palette:export'; palette: { name: string; colors: string[] }; format: ExportFormat }
  | { type: 'palette:saveImage'; name: string; dataUrl: string }
  | { type: 'palette:import' }
  | { type: 'document:refresh' }
  | { type: 'document:replace'; uri: string; session: number; key: string; hex: string }
  | { type: 'document:reveal'; uri: string; range: [number, number]; highlight: Array<[number, number]> }
  | { type: 'document:setAutoSave'; enabled: boolean };

export type HostMessage =
  | { type: 'init'; working?: WorkingState; history: string[]; palettes: Palette[]; settings: Settings }
  | { type: 'history'; history: string[] }
  | { type: 'palettes'; palettes: Palette[] }
  | { type: 'paletteSaved'; palette: Palette }
  | { type: 'paletteImported'; palette: Palette }
  | { type: 'paletteRenamed'; id: string; name: string }
  | { type: 'document:colors'; document: DocumentColors | undefined }
  | { type: 'showTab'; tab: string }
  | { type: 'loadImage'; name: string; dataUrl: string };
