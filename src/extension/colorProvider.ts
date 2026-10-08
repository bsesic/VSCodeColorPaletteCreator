import * as vscode from 'vscode';
import { FoundColor, RGBA, ScanFormat, findColors, presentations } from '../core/scan';

/** Files larger than this are not scanned to keep the editor responsive. */
export const MAX_SCAN_LENGTH = 3_000_000;

const ALL_FORMATS: ScanFormat[] = ['hex', 'rgb', 'hsl', 'hsv', 'rgb-triplet'];
/** Formats VS Code's built-in CSS color provider does not handle. */
const EXTRA_FORMATS: ScanFormat[] = ['hsv', 'rgb-triplet'];

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('colorPaletteCreator.inlineColors');
}

/** Formats to report for a document, avoiding duplicates with built-in color providers. */
function formatsFor(document: vscode.TextDocument): ScanFormat[] {
  const builtIn = config().get<string[]>('builtInLanguages', ['css', 'scss', 'less']);
  return builtIn.includes(document.languageId) ? EXTRA_FORMATS : ALL_FORMATS;
}

const toVsColor = (c: RGBA): vscode.Color => new vscode.Color(c.r / 255, c.g / 255, c.b / 255, c.a);
const fromVsColor = (c: vscode.Color): RGBA => ({ r: c.red * 255, g: c.green * 255, b: c.blue * 255, a: c.alpha });

/**
 * Shows a color box with VS Code's color picker in front of color codes in
 * any language. Changes made with the picker keep the original notation.
 */
export class InlineColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
    if (!config().get<boolean>('enabled', true) || document.getText().length > MAX_SCAN_LENGTH) {
      return [];
    }
    const excluded = config().get<string[]>('excludedLanguages', []);
    if (excluded.includes(document.languageId)) {
      return [];
    }
    return findColors(document.getText(), { formats: formatsFor(document) }).map((found) => new vscode.ColorInformation(
      new vscode.Range(document.positionAt(found.start), document.positionAt(found.end)),
      toVsColor(found.color)
    ));
  }

  provideColorPresentations(
    color: vscode.Color,
    context: { document: vscode.TextDocument; range: vscode.Range }
  ): vscode.ColorPresentation[] {
    const text = context.document.getText(context.range);
    const found: Pick<FoundColor, 'text' | 'format'> =
      findColors(text)[0] ?? { text: /^\d/.test(text) ? text : '#000000', format: /^\d/.test(text) ? 'rgb-triplet' : 'hex' };
    const options = found.format === 'rgb-triplet'
      ? presentations(found, fromVsColor(color)).slice(0, 1) // A triplet must stay a triplet.
      : presentations(found, fromVsColor(color));
    return options.map((label) => {
      const presentation = new vscode.ColorPresentation(label);
      presentation.textEdit = new vscode.TextEdit(context.range, label);
      return presentation;
    });
  }
}

export function registerInlineColors(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.languages.registerColorProvider(
    [{ scheme: 'file' }, { scheme: 'untitled' }, { scheme: 'vscode-remote' }],
    new InlineColorProvider()
  ));
}
