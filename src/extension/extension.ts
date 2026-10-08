import * as vscode from 'vscode';
import { EXPORT_FORMATS, ExportFormat, exportPalette } from '../core/palette';
import { EditorTracker, PalettePanel } from './panel';
import { PaletteStore } from './store';

export function activate(context: vscode.ExtensionContext): void {
  const store = new PaletteStore(context.globalState);
  const editors = new EditorTracker();

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.text = '$(symbol-color) Palette';
  statusItem.tooltip = 'Open Color Palette Creator';
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
    vscode.commands.registerCommand('colorPaletteCreator.clearHistory', async () => {
      await store.clearHistory();
      vscode.window.showInformationMessage('Color history cleared.');
    }),
    vscode.commands.registerCommand('colorPaletteCreator.insertPalette', async () => {
      await insertSavedPalette(store, editors);
    })
  );
}

/** Lets the user pick a saved palette and an export format and inserts the code. */
async function insertSavedPalette(store: PaletteStore, editors: EditorTracker): Promise<void> {
  const palettes = store.palettes;
  if (palettes.length === 0) {
    vscode.window.showInformationMessage('There are no saved palettes yet. Open the Color Palette Creator to create one.');
    return;
  }
  const palette = await vscode.window.showQuickPick(
    palettes.map((p) => ({ label: p.name, description: p.colors.join(' '), palette: p })),
    { placeHolder: 'Select a palette to insert' }
  );
  if (!palette) {
    return;
  }
  const defaultFormat = vscode.workspace.getConfiguration('colorPaletteCreator').get<ExportFormat>('defaultExportFormat', 'css');
  const format = await vscode.window.showQuickPick(
    EXPORT_FORMATS.map((f) => ({ label: f.label, description: f.id === defaultFormat ? 'default' : '', id: f.id })),
    { placeHolder: 'Select the format' }
  );
  if (!format) {
    return;
  }
  const text = exportPalette(palette.palette, format.id);
  const editor = editors.lastEditor;
  if (editor) {
    await editor.edit((edit) => editor.selections.forEach((s) => edit.replace(s, text)));
  } else {
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('No open text editor found. The palette was copied to the clipboard.');
  }
}

export function deactivate(): void {
  // Nothing to clean up; disposables are registered on the context.
}
