import * as vscode from 'vscode';
import { EXPORT_FORMATS, ExportFormat, Palette, exportPalette, parsePaletteFile, slugify } from '../core/palette';
import { PaletteStore } from './store';

/** Suggested save location: the first workspace folder, if any. */
export function defaultUri(fileName: string): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  return folder ? vscode.Uri.joinPath(folder, fileName) : undefined;
}

/** Asks for a file name and writes the palette in the given format. */
export async function exportPaletteToFile(palette: { name: string; colors: string[] }, format: ExportFormat): Promise<void> {
  const info = EXPORT_FORMATS.find((f) => f.id === format) ?? EXPORT_FORMATS[0];
  const uri = await vscode.window.showSaveDialog({
    title: vscode.l10n.t('Export palette as {0}', vscode.l10n.t(info.label)),
    defaultUri: defaultUri(`${slugify(palette.name)}.${info.extension}`),
    filters: { [vscode.l10n.t(info.label)]: [info.extension] }
  });
  if (!uri) {
    return;
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(exportPalette(palette, format), 'utf8'));
  const open = await vscode.window.showInformationMessage(vscode.l10n.t('Palette exported to {0}', uri.fsPath), vscode.l10n.t('Open'));
  if (open) {
    await vscode.window.showTextDocument(uri);
  }
}

/** Asks for a palette file, parses it and stores it as a new palette. */
export async function importPaletteFromFile(store: PaletteStore): Promise<Palette | undefined> {
  const [uri] = await vscode.window.showOpenDialog({
    title: vscode.l10n.t('Import palette'),
    canSelectMany: false,
    filters: {
      [vscode.l10n.t('Palette files')]: ['json', 'css', 'scss', 'less', 'txt', 'gpl', 'js', 'ts'],
      [vscode.l10n.t('All files')]: ['*']
    }
  }) ?? [];
  if (!uri) {
    return undefined;
  }
  const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  const fileName = uri.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? vscode.l10n.t('Imported palette');
  const parsed = parsePaletteFile(text, fileName);
  if (!parsed) {
    vscode.window.showWarningMessage(vscode.l10n.t('No colors were found in the selected file.'));
    return undefined;
  }
  const palette = await store.savePalette({ name: parsed.name, colors: parsed.colors.slice(0, 12) });
  vscode.window.showInformationMessage(vscode.l10n.t('Imported palette "{0}" with {1} colors.', palette.name, palette.colors.length));
  return palette;
}
