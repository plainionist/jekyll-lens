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
  <style>
    body {
      font-family: sans-serif;
      margin: 16px;
      line-height: 1.4;
    }

    .container {
      max-width: 640px;
    }

    .field {
      margin-bottom: 12px;
    }

    label {
      display: block;
      font-weight: 600;
      margin-bottom: 4px;
    }

    input {
      box-sizing: border-box;
      width: 100%;
      padding: 8px;
    }

    button {
      padding: 8px 14px;
      margin-top: 4px;
    }

    .results {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #ccc;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Markdown Search</h1>

    <div class="field">
      <label for="title">Title</label>
      <input id="title" type="text" />
    </div>

    <div class="field">
      <label for="tags">Tags</label>
      <input id="tags" type="text" />
    </div>

    <div class="field">
      <label for="fullText">Full Text</label>
      <input id="fullText" type="text" />
    </div>

    <button id="searchButton" type="button">Search</button>

    <section class="results">
      <h2>Results</h2>
    </section>
  </div>

  <script>
    const searchButton = document.getElementById('searchButton');
    searchButton?.addEventListener('click', () => {
      console.log('Search clicked');
    });
  </script>
</body>
</html>`;
}

export function deactivate(): void {
  // No cleanup needed for this minimal extension.
}
