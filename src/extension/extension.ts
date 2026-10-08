import * as vscode from 'vscode';
import { EXPORT_FORMATS, ExportFormat, Palette, exportPalette } from '../core/palette';
import { exportPaletteToFile, importPaletteFromFile } from './fileIO';
import { registerInlineColors } from './colorProvider';
import { EditorTracker, PalettePanel } from './panel';
import { PaletteStore } from './store';

export function activate(context: vscode.ExtensionContext): void {
  const store = new PaletteStore(context.globalState);
  const editors = new EditorTracker();

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.text = `$(symbol-color) ${vscode.l10n.t('Palette')}`;
  statusItem.tooltip = vscode.l10n.t('Open Color Palette Creator');
  statusItem.command = 'colorPaletteCreator.open';
  const updateStatusItem = (): void => {
    const show = vscode.workspace.getConfiguration('colorPaletteCreator').get<boolean>('showStatusBarItem', true);
    if (show) {
      statusItem.show();
    } else {
      statusItem.hide();
    }
  };
  updateStatusItem();
  registerInlineColors(context);

  context.subscriptions.push(
    editors,
    statusItem,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('colorPaletteCreator.showStatusBarItem')) {
        updateStatusItem();
      }
    }),
    vscode.commands.registerCommand('colorPaletteCreator.open', () => {
      PalettePanel.show(context, store, editors);
    }),
    ...Object.entries(TAB_COMMANDS).map(([command, tab]) => vscode.commands.registerCommand(command, async (uri?: vscode.Uri) => {
      const panel = PalettePanel.show(context, store, editors);
      panel.showTab(tab);
      // Invoked from the explorer context menu of an image: load that image.
      if (tab === 'image' && uri instanceof vscode.Uri) {
        await panel.loadImage(uri);
      }
    })),
    vscode.commands.registerCommand('colorPaletteCreator.exportPalette', async () => {
      const palette = await pickPalette(store, vscode.l10n.t('Select a palette to export'));
      const format = palette && await pickFormat();
      if (palette && format) {
        await exportPaletteToFile(palette, format);
      }
    }),
    vscode.commands.registerCommand('colorPaletteCreator.importPalette', async () => {
      await importPaletteFromFile(store);
    }),
    vscode.commands.registerCommand('colorPaletteCreator.toggleInlineColors', async () => {
      const config = vscode.workspace.getConfiguration('colorPaletteCreator.inlineColors');
      const enabled = !config.get<boolean>('enabled', true);
      await config.update('enabled', enabled, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(enabled ? vscode.l10n.t('Inline color boxes enabled.') : vscode.l10n.t('Inline color boxes disabled.'));
    }),
    vscode.commands.registerCommand('colorPaletteCreator.clearHistory', async () => {
      await store.clearHistory();
      vscode.window.showInformationMessage(vscode.l10n.t('Color history cleared.'));
    }),
    vscode.commands.registerCommand('colorPaletteCreator.insertPalette', async () => {
      await insertSavedPalette(store, editors);
    })
  );
}

/** Commands that open the panel on a specific tab. */
const TAB_COMMANDS: Record<string, string> = {
  'colorPaletteCreator.openDocumentColors': 'document',
  'colorPaletteCreator.openImageExtraction': 'image',
  'colorPaletteCreator.openGradientGenerator': 'gradient',
  'colorPaletteCreator.openContrastChecker': 'contrast',
  'colorPaletteCreator.openColorBlindnessSimulator': 'vision',
  'colorPaletteCreator.openSavedPalettes': 'library',
  'colorPaletteCreator.openHistory': 'history'
};

async function pickPalette(store: PaletteStore, placeHolder: string): Promise<Palette | undefined> {
  const palettes = store.palettes;
  if (palettes.length === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t('There are no saved palettes yet. Open the Color Palette Creator to create one.'));
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    palettes.map((p) => ({ label: p.name, description: p.colors.join(' '), palette: p })),
    { placeHolder }
  );
  return picked?.palette;
}

async function pickFormat(): Promise<ExportFormat | undefined> {
  const defaultFormat = vscode.workspace.getConfiguration('colorPaletteCreator').get<ExportFormat>('defaultExportFormat', 'css');
  const picked = await vscode.window.showQuickPick(
    EXPORT_FORMATS.map((f) => ({ label: vscode.l10n.t(f.label), description: f.id === defaultFormat ? vscode.l10n.t('default') : '', id: f.id })),
    { placeHolder: vscode.l10n.t('Select the format') }
  );
  return picked?.id;
}

/** Lets the user pick a saved palette and an export format and inserts the code. */
async function insertSavedPalette(store: PaletteStore, editors: EditorTracker): Promise<void> {
  const palette = await pickPalette(store, vscode.l10n.t('Select a palette to insert'));
  const format = palette && await pickFormat();
  if (!palette || !format) {
    return;
  }
  const text = exportPalette(palette, format);
  const editor = editors.lastEditor;
  if (editor) {
    await editor.edit((edit) => editor.selections.forEach((s) => edit.replace(s, text)));
  } else {
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(vscode.l10n.t('No open text editor found. The palette was copied to the clipboard.'));
  }
}

export function deactivate(): void {
  // Nothing to clean up; disposables are registered on the context.
}
