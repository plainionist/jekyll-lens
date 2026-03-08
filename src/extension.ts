import * as vscode from 'vscode';

type SearchRequestMessage = {
  type: 'search';
  payload?: {
    fileNamePattern?: string;
    fullText?: string;
  };
};

type SearchResult = {
  filePath: string;
  fileName: string;
  snippet: string;
};

type SearchResultsMessage = {
  type: 'searchResults';
  payload: SearchResult[];
};

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('markdownSearch.openSearch', () => {
    const panel = vscode.window.createWebviewPanel(
      'markdownSearch',
      'Markdown Search',
      vscode.ViewColumn.Active,
      {
        enableScripts: true
      }
    );

    panel.webview.html = getWebviewHtml();

    const messageListener = panel.webview.onDidReceiveMessage(async (message: SearchRequestMessage) => {
      if (message.type !== 'search') {
        return;
      }

      const fileNamePattern = message.payload?.fileNamePattern?.trim() ?? '';
      const fullText = message.payload?.fullText?.trim() ?? '';
      const results = await searchMarkdownFiles(fileNamePattern, fullText);
      const response: SearchResultsMessage = {
        type: 'searchResults',
        payload: results
      };

      await panel.webview.postMessage(response);
    });

    context.subscriptions.push(messageListener);
  });

  context.subscriptions.push(disposable);
}

async function searchMarkdownFiles(fileNamePattern: string, fullText: string): Promise<SearchResult[]> {
  const fileNamePatternLower = fileNamePattern.toLowerCase();
  const fullTextLower = fullText.toLowerCase();

  if (!fileNamePatternLower && !fullTextLower) {
    return [];
  }

  const markdownFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
  const results: SearchResult[] = [];

  for (const fileUri of markdownFiles) {
    const fileName = getFileName(fileUri);
    const fileNameLower = fileName.toLowerCase();

    if (fileNamePatternLower && !fileNameLower.includes(fileNamePatternLower)) {
      continue;
    }

    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const content = new TextDecoder('utf-8').decode(bytes);

    let snippet = getFallbackSnippet(content);

    if (fullTextLower) {
      const contentLower = content.toLowerCase();
      const matchIndex = contentLower.indexOf(fullTextLower);

      if (matchIndex === -1) {
        continue;
      }

      snippet = createSnippet(content, matchIndex, fullTextLower.length);
    }

    results.push({
      filePath: vscode.workspace.asRelativePath(fileUri, false),
      fileName,
      snippet
    });
  }

  return results;
}

function getFileName(fileUri: vscode.Uri): string {
  const normalizedPath = fileUri.path.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  return segments[segments.length - 1] || normalizedPath;
}

function createSnippet(content: string, matchIndex: number, matchLength: number): string {
  const radius = 50;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(content.length, matchIndex + matchLength + radius);
  const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${snippet}${suffix}`;
}

function getFallbackSnippet(content: string): string {
  const firstNonEmptyLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstNonEmptyLine) {
    return firstNonEmptyLine.slice(0, 100);
  }

  return content.replace(/\s+/g, ' ').trim().slice(0, 100);
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

    #resultsList {
      list-style: none;
      padding: 0;
      margin: 8px 0 0;
    }

    .result-item {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 10px;
    }

    .result-name {
      font-weight: 600;
    }

    .result-path {
      color: #666;
      font-size: 0.9em;
      margin-top: 2px;
    }

    .result-snippet {
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Markdown Search</h1>

    <div class="field">
      <label for="fileNamePattern">File Name Pattern</label>
      <input id="fileNamePattern" type="text" />
    </div>

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
      <ul id="resultsList"></ul>
    </section>
  </div>

  <script>
    const vscodeApi = acquireVsCodeApi();
    const searchButton = document.getElementById('searchButton');
    const fileNamePatternInput = document.getElementById('fileNamePattern');
    const fullTextInput = document.getElementById('fullText');
    const resultsList = document.getElementById('resultsList');

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message?.type !== 'searchResults') {
        return;
      }

      renderResults(message.payload ?? []);
    });

    searchButton?.addEventListener('click', () => {
      const fileNamePattern = fileNamePatternInput?.value ?? '';
      const fullText = fullTextInput?.value ?? '';

      vscodeApi.postMessage({
        type: 'search',
        payload: {
          fileNamePattern,
          fullText
        }
      });

      console.log('Search clicked', { fileNamePattern, fullText });
    });

    function renderResults(results) {
      if (!resultsList) {
        return;
      }

      resultsList.innerHTML = '';

      if (!results.length) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = 'No results';
        resultsList.appendChild(emptyItem);
        return;
      }

      for (const result of results) {
        const item = document.createElement('li');
        item.className = 'result-item';

        const name = document.createElement('div');
        name.className = 'result-name';
        name.textContent = result.fileName;

        const path = document.createElement('div');
        path.className = 'result-path';
        path.textContent = result.filePath;

        const snippet = document.createElement('div');
        snippet.className = 'result-snippet';
        snippet.textContent = result.snippet;

        item.appendChild(name);
        item.appendChild(path);
        item.appendChild(snippet);
        resultsList.appendChild(item);
      }
    }
  </script>
</body>
</html>`;
}

export function deactivate(): void {
  // No cleanup needed for this minimal extension.
}
