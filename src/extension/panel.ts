import * as vscode from 'vscode';
import { HostMessage, WebviewMessage } from '../core/messages';
import { ExportFormat } from '../core/palette';
import { PaletteStore } from './store';

/**
 * The Color Palette Creator webview panel (singleton).
 */
export class PalettePanel {
  static readonly viewType = 'colorPaletteCreator.panel';
  private static current: PalettePanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext, store: PaletteStore, editors: EditorTracker): PalettePanel {
    if (PalettePanel.current) {
      PalettePanel.current.panel.reveal();
      return PalettePanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      PalettePanel.viewType,
      'Color Palette Creator',
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
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.svg');
    panel.webview.html = this.renderHtml();
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => this.handle(msg), null, this.disposables);
    store.onDidChange(() => this.post({ type: 'palettes', palettes: store.palettes }), null, this.disposables);
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
          break;
        case 'copy':
          await vscode.env.clipboard.writeText(msg.text);
          vscode.window.setStatusBarMessage(`Copied ${msg.label ?? msg.text}`, 2500);
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
        default:
          break;
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Color Palette Creator: ${err instanceof Error ? err.message : String(err)}`);
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

  /** Inserts text at the cursor(s) of the last active text editor. */
  async insertIntoEditor(text: string): Promise<void> {
    const editor = this.editors.lastEditor;
    if (!editor) {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage('No open text editor found. The text was copied to the clipboard instead.');
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
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${media('styles.css')}">
  <title>Color Palette Creator</title>
</head>
<body>
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
  private editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  private readonly subscription = vscode.window.onDidChangeActiveTextEditor((e) => {
    if (e) {
      this.editor = e;
    }
  });

  get lastEditor(): vscode.TextEditor | undefined {
    const open = vscode.window.visibleTextEditors;
    if (this.editor && open.includes(this.editor)) {
      return this.editor;
    }
    return open[0];
  }

  dispose(): void {
    this.subscription.dispose();
  }
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}
