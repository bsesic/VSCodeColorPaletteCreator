import * as vscode from 'vscode';
import { DocumentColors, HostMessage } from '../core/messages';
import { findColors, groupColors, planReplacement } from '../core/scan';
import { hexToRgb } from '../core/color';
import { MAX_SCAN_LENGTH } from './colorProvider';
import { EditorTracker } from './panel';

/**
 * Keeps the webview's "Document" tab in sync with the colors of the last
 * active text editor and applies color changes to the document.
 */
export class DocumentColorSync implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private scanTimer: ReturnType<typeof setTimeout> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** Latest requested color per edit session (only the newest value matters). */
  private readonly pending = new Map<number, { uri: string; key: string; hex: string }>();
  /** Current color key and original notations of each edit session (keys change with every edit). */
  private readonly sessions = new Map<number, { key: string; templates: string[] }>();
  private busy = false;
  private flashTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly highlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    border: '1px solid',
    borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.findMatchForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Center
  });

  constructor(
    private readonly editors: EditorTracker,
    private readonly post: (message: HostMessage) => void,
    private readonly panelColumn: () => vscode.ViewColumn | undefined
  ) {
    this.disposables.push(this.highlight);
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.scheduleScan(50)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === this.document) {
          this.scheduleScan(120);
        }
      }),
      vscode.workspace.onDidCloseTextDocument(() => this.scheduleScan(50))
    );
  }

  private get document(): vscode.TextDocument | undefined {
    return this.editors.lastDocument;
  }

  private get autoSave(): boolean {
    return vscode.workspace.getConfiguration('colorPaletteCreator.documentColors').get<boolean>('autoSave', false);
  }

  scheduleScan(delay = 0): void {
    clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => this.scan(), delay);
  }

  scan(): void {
    const doc = this.document;
    if (!doc) {
      this.post({ type: 'document:colors', document: undefined });
      return;
    }
    const text = doc.getText();
    const tooLarge = text.length > MAX_SCAN_LENGTH;
    const result: DocumentColors = {
      uri: doc.uri.toString(),
      fileName: vscode.workspace.asRelativePath(doc.uri),
      languageId: doc.languageId,
      groups: tooLarge ? [] : groupColors(text, findColors(text)),
      tooLarge,
      autoSave: this.autoSave
    };
    this.post({ type: 'document:colors', document: result });
  }

  /** Queues a color change; rapid changes from dragging are coalesced. */
  replace(uri: string, session: number, key: string, hex: string): void {
    this.pending.set(session, { uri, key, hex });
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    try {
      while (this.pending.size > 0) {
        const [session, request] = this.pending.entries().next().value as [number, { uri: string; key: string; hex: string }];
        this.pending.delete(session);
        await this.apply(session, request);
      }
    } finally {
      this.busy = false;
    }
  }

  private async apply(session: number, request: { uri: string; key: string; hex: string }): Promise<void> {
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === request.uri);
    const rgb = hexToRgb(request.hex);
    if (!doc || !rgb) {
      return;
    }
    const state = this.sessions.get(session);
    const { edits, newKey, originals } = planReplacement(doc.getText(), state?.key ?? request.key, rgb, state?.templates);
    this.sessions.set(session, { key: newKey, templates: originals });
    if (edits.length === 0) {
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    for (const e of edits) {
      edit.replace(doc.uri, new vscode.Range(doc.positionAt(e.start), doc.positionAt(e.end)), e.text);
    }
    await vscode.workspace.applyEdit(edit);
    if (this.autoSave) {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => void doc.save(), 300);
    }
  }

  /**
   * Selects the color code at `range` in the editor and briefly highlights
   * all `highlight` ranges. The webview keeps the focus; if the document is
   * hidden behind the panel, it is opened in another editor group.
   */
  async reveal(uri: string, range: [number, number], highlight: Array<[number, number]>): Promise<void> {
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri)
      ?? await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
    const visible = vscode.window.visibleTextEditors.find((e) => e.document === doc);
    let column = visible?.viewColumn;
    if (!column) {
      column = this.panelColumn() === vscode.ViewColumn.One ? vscode.ViewColumn.Two : vscode.ViewColumn.One;
    }
    const editor = await vscode.window.showTextDocument(doc, { viewColumn: column, preserveFocus: true, preview: false });
    const toRange = ([start, end]: [number, number]): vscode.Range =>
      new vscode.Range(doc.positionAt(start), doc.positionAt(end));
    const target = toRange(range);
    editor.selection = new vscode.Selection(target.start, target.end);
    editor.revealRange(target, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    editor.setDecorations(this.highlight, highlight.map(toRange));
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => editor.setDecorations(this.highlight, []), 1500);
  }

  async setAutoSave(enabled: boolean): Promise<void> {
    await vscode.workspace.getConfiguration('colorPaletteCreator.documentColors')
      .update('autoSave', enabled, vscode.ConfigurationTarget.Global);
    this.scan();
  }

  dispose(): void {
    clearTimeout(this.scanTimer);
    clearTimeout(this.saveTimer);
    clearTimeout(this.flashTimer);
    this.disposables.forEach((d) => d.dispose());
  }
}
