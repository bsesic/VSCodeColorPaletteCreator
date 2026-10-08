import * as vscode from 'vscode';
import { HostMessage, WebviewMessage } from '../core/messages';
import { ExportFormat, slugify } from '../core/palette';
import { defaultUri, exportPaletteToFile, importPaletteFromFile } from './fileIO';
import { DocumentColorSync } from './documentColors';
import { PaletteStore } from './store';

/**
 * The Color Palette Creator webview panel (singleton).
 */
export class PalettePanel {
  static readonly viewType = 'colorPaletteCreator.panel';
  private static current: PalettePanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly documentColors: DocumentColorSync;
  private ready = false;
  private pendingTab: string | undefined;
  private pendingMessages: HostMessage[] = [];

  static show(context: vscode.ExtensionContext, store: PaletteStore, editors: EditorTracker): PalettePanel {
    if (PalettePanel.current) {
      PalettePanel.current.panel.reveal();
      return PalettePanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      PalettePanel.viewType,
      vscode.l10n.t('Color Palette Creator'),
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );
    PalettePanel.current = new PalettePanel(panel, context, store, editors);
    return PalettePanel.current;
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly store: PaletteStore,
    private readonly editors: EditorTracker
  ) {
    this.documentColors = new DocumentColorSync(editors, (message) => this.post(message), () => panel.viewColumn);
    this.disposables.push(this.documentColors);
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'icon.png');
    panel.webview.html = this.renderHtml();
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => this.handle(msg), null, this.disposables);
    store.onDidChange(() => this.post({ type: 'palettes', palettes: store.palettes }), null, this.disposables);
  }

  /** Shows a tab of the webview (queued until the webview has loaded). */
  showTab(tab: string): void {
    if (this.ready) {
      this.post({ type: 'showTab', tab });
    } else {
      this.pendingTab = tab;
    }
  }

  /** Loads an image file into the Image tab. */
  async loadImage(uri: vscode.Uri): Promise<void> {
    const ext = (uri.path.split('.').pop() ?? 'png').toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const data = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('base64');
    const message: HostMessage = { type: 'loadImage', name: uri.path.split('/').pop() ?? 'image', dataUrl: `data:${mime};base64,${data}` };
    if (this.ready) {
      this.post(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  private async importPalette(): Promise<void> {
    const palette = await importPaletteFromFile(this.store);
    if (palette) {
      this.post({ type: 'paletteImported', palette });
    }
  }

  post(message: HostMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('colorPaletteCreator');
  }

  private async handle(msg: WebviewMessage): Promise<void> {
    try {
      switch (msg.type) {
        case 'ready':
          this.post({
            type: 'init',
            working: this.store.working,
            history: this.store.history,
            palettes: this.store.palettes,
            settings: { defaultExportFormat: this.config.get<ExportFormat>('defaultExportFormat', 'css') }
          });
          this.documentColors.scan();
          this.ready = true;
          if (this.pendingTab) {
            this.post({ type: 'showTab', tab: this.pendingTab });
            this.pendingTab = undefined;
          }
          this.pendingMessages.forEach((m) => this.post(m));
          this.pendingMessages = [];
          break;
        case 'document:refresh':
          this.documentColors.scan();
          break;
        case 'document:replace':
          this.documentColors.replace(msg.uri, msg.session, msg.key, msg.hex);
          break;
        case 'document:reveal':
          await this.documentColors.reveal(msg.uri, msg.range, msg.highlight);
          break;
        case 'document:setAutoSave':
          await this.documentColors.setAutoSave(msg.enabled);
          break;
        case 'copy':
          await vscode.env.clipboard.writeText(msg.text);
          vscode.window.setStatusBarMessage(vscode.l10n.t('Copied {0}', msg.label ?? msg.text), 2500);
          break;
        case 'insert':
          await this.insertIntoEditor(msg.text);
          break;
        case 'notify':
          this.notify(msg.level, msg.message);
          break;
        case 'saveWorking':
          await this.store.setWorking(msg.working);
          break;
        case 'history:add': {
          const history = await this.store.addToHistory(msg.colors, this.config.get<number>('historySize', 60));
          this.post({ type: 'history', history });
          break;
        }
        case 'history:clear':
          await this.store.clearHistory();
          this.post({ type: 'history', history: [] });
          break;
        case 'palette:save': {
          const palette = await this.store.savePalette(msg.palette);
          this.post({ type: 'paletteSaved', palette });
          break;
        }
        case 'palette:rename':
          await this.renamePalette(msg.id);
          break;
        case 'palette:duplicate': {
          const source = this.store.getPalette(msg.id);
          if (source) {
            await this.store.savePalette({ name: vscode.l10n.t('{0} copy', source.name), colors: source.colors });
          }
          break;
        }
        case 'palette:delete':
          await this.deletePalette(msg.id);
          break;
        case 'palette:export':
          await exportPaletteToFile(msg.palette, msg.format);
          break;
        case 'palette:saveImage':
          await this.saveImage(msg.name, msg.dataUrl);
          break;
        case 'palette:import':
          await this.importPalette();
          break;
        default:
          break;
      }
    } catch (err) {
      vscode.window.showErrorMessage(vscode.l10n.t('Color Palette Creator: {0}', err instanceof Error ? err.message : String(err)));
    }
  }

  private notify(level: 'info' | 'warning' | 'error', message: string): void {
    if (level === 'error') {
      vscode.window.showErrorMessage(message);
    } else if (level === 'warning') {
      vscode.window.showWarningMessage(message);
    } else {
      vscode.window.showInformationMessage(message);
    }
  }

  private async renamePalette(id: string): Promise<void> {
    const palette = this.store.getPalette(id);
    if (!palette) {
      return;
    }
    const name = await vscode.window.showInputBox({
      title: vscode.l10n.t('Rename palette'),
      value: palette.name,
      validateInput: (value) => (value.trim() ? undefined : vscode.l10n.t('The name must not be empty.'))
    });
    if (name) {
      await this.store.renamePalette(id, name.trim());
      this.post({ type: 'paletteRenamed', id, name: name.trim() });
    }
  }

  private async deletePalette(id: string): Promise<void> {
    const palette = this.store.getPalette(id);
    if (!palette) {
      return;
    }
    const confirm = vscode.l10n.t('Delete');
    const answer = await vscode.window.showWarningMessage(
      vscode.l10n.t('Delete the palette "{0}"?', palette.name), { modal: true, detail: vscode.l10n.t('This cannot be undone.') }, confirm);
    if (answer === confirm) {
      await this.store.deletePalette(id);
    }
  }

  private async saveImage(name: string, dataUrl: string): Promise<void> {
    const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw new Error(vscode.l10n.t('Invalid image data.'));
    }
    const uri = await vscode.window.showSaveDialog({
      title: vscode.l10n.t('Save palette as image'),
      defaultUri: defaultUri(`${slugify(name)}.png`),
      filters: { [vscode.l10n.t('PNG image')]: ['png'] }
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(match[1], 'base64'));
      vscode.window.showInformationMessage(vscode.l10n.t('Palette image saved to {0}', uri.fsPath));
    }
  }

  /** Inserts text at the cursor(s) of the last active text editor. */
  async insertIntoEditor(text: string): Promise<void> {
    const editor = this.editors.lastEditor;
    if (!editor) {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(vscode.l10n.t('No open text editor found. The text was copied to the clipboard instead.'));
      return;
    }
    await editor.edit((edit) => {
      editor.selections.forEach((selection) => edit.replace(selection, text));
    });
    await vscode.window.showTextDocument(editor.document, editor.viewColumn);
  }

  private renderHtml(): string {
    const webview = this.panel.webview;
    const media = (...parts: string[]): vscode.Uri =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', ...parts));
    const nonce = createNonce();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data: blob:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`
    ].join('; ');
    // The l10n bundle of the display language (undefined for English) is embedded for the webview.
    const bundle = JSON.stringify(vscode.l10n.bundle ?? {}).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${media('styles.css')}">
  <title>Color Palette Creator</title>
</head>
<body>
  <script type="application/json" id="l10n-bundle">${bundle}</script>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${media('out', 'webview', 'main.js')}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    PalettePanel.current = undefined;
    this.disposables.forEach((d) => d.dispose());
  }
}

/** Remembers the last focused text editor, since the webview takes focus. */
export class EditorTracker implements vscode.Disposable {
  private editor: vscode.TextEditor | undefined = EditorTracker.isTextFile(vscode.window.activeTextEditor)
    ? vscode.window.activeTextEditor
    : undefined;

  private readonly subscription = vscode.window.onDidChangeActiveTextEditor((e) => {
    if (EditorTracker.isTextFile(e)) {
      this.editor = e;
    }
  });

  /** Ignores output, debug console and other non-file editors. */
  private static isTextFile(editor: vscode.TextEditor | undefined): editor is vscode.TextEditor {
    return !!editor && ['file', 'untitled', 'vscode-remote', 'vscode-userdata'].includes(editor.document.uri.scheme);
  }

  get lastEditor(): vscode.TextEditor | undefined {
    const open = vscode.window.visibleTextEditors.filter((e) => EditorTracker.isTextFile(e));
    if (this.editor && open.includes(this.editor)) {
      return this.editor;
    }
    return open[0];
  }

  /** Document of the last text editor, even if it is currently hidden behind the panel. */
  get lastDocument(): vscode.TextDocument | undefined {
    const visible = this.lastEditor?.document;
    if (visible) {
      return visible;
    }
    const doc = this.editor?.document;
    return doc && !doc.isClosed ? doc : undefined;
  }

  dispose(): void {
    this.subscription.dispose();
  }
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}
