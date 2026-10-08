import * as vscode from 'vscode';

/**
 * Extension entry point. Feature registrations are added in later modules.
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('colorPaletteCreator.open', () => {
      vscode.window.showInformationMessage('Color Palette Creator is being set up.');
    })
  );
}

export function deactivate(): void {
  // Nothing to clean up.
}
