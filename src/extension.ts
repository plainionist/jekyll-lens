import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('markdownSearch.hello', () => {
    vscode.window.showInformationMessage('Hello from Markdown Search');
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // No cleanup needed for this minimal extension.
}
