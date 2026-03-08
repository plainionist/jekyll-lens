import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('markdownSearch.openSearch', () => {
    const panel = vscode.window.createWebviewPanel(
      'markdownSearch',
      'Markdown Search',
      vscode.ViewColumn.Active,
      {}
    );

    panel.webview.html = getWebviewHtml();
  });

  context.subscriptions.push(disposable);
}

function getWebviewHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Search</title>
</head>
<body>
  <h1>Markdown Search</h1>
  <p>Custom search UI will go here</p>
</body>
</html>`;
}

export function deactivate(): void {
  // No cleanup needed for this minimal extension.
}
