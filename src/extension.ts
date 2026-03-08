import * as vscode from 'vscode';

type SearchFilters = {
  fileNamePattern: string;
  title: string;
  tags: string;
  fullText: string;
};

type SearchRequestMessage = {
  type: 'search';
  payload?: Partial<SearchFilters>;
};

type OpenFileRequestMessage = {
  type: 'openFile';
  payload?: {
    filePath?: string;
    fileUri?: string;
  };
};

type WebviewRequestMessage = SearchRequestMessage | OpenFileRequestMessage;

type SearchResult = {
  filePath: string;
  fileUri: string;
  fileName: string;
  title: string;
  tags: string;
  snippet: string;
  score: number;
};

type SearchResultsMessage = {
  type: 'searchResults';
  payload: SearchResult[];
};

type ParsedMarkdown = {
  title: string;
  tags: string;
  body: string;
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

    const messageListener = panel.webview.onDidReceiveMessage(async (message: WebviewRequestMessage) => {
      if (message.type === 'search') {
        const filters = normalizeFilters(message.payload);
        const results = await searchMarkdownFiles(filters);
        const response: SearchResultsMessage = {
          type: 'searchResults',
          payload: results
        };

        await panel.webview.postMessage(response);
        return;
      }

      if (message.type === 'openFile') {
        await openResultFile(message.payload?.filePath, message.payload?.fileUri);
      }
    });

    context.subscriptions.push(messageListener);
  });

  context.subscriptions.push(disposable);
}

function normalizeFilters(payload?: Partial<SearchFilters>): SearchFilters {
  return {
    fileNamePattern: payload?.fileNamePattern?.trim() ?? '',
    title: payload?.title?.trim() ?? '',
    tags: payload?.tags?.trim() ?? '',
    fullText: payload?.fullText?.trim() ?? ''
  };
}

async function openResultFile(filePath?: string, fileUri?: string): Promise<void> {
  if (!filePath && !fileUri) {
    return;
  }

  try {
    const uri = fileUri ? vscode.Uri.parse(fileUri) : resolveWorkspaceFileUri(filePath ?? '');

    if (!uri) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  } catch {
    vscode.window.showErrorMessage(`Unable to open file: ${filePath ?? fileUri ?? ''}`);
  }
}

function resolveWorkspaceFileUri(filePath: string): vscode.Uri | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  return vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
}

export function deactivate(): void {
  // No cleanup needed for this minimal extension.
}

async function searchMarkdownFiles(filters: SearchFilters): Promise<SearchResult[]> {
  const fileNamePatternLower = filters.fileNamePattern.toLowerCase();
  const titleLower = filters.title.toLowerCase();
  const tagsLower = filters.tags.toLowerCase();
  const fullTextLower = filters.fullText.toLowerCase();

  if (!fileNamePatternLower && !titleLower && !tagsLower && !fullTextLower) {
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
    const parsed = parseFrontMatter(content);

    if (titleLower && !parsed.title.toLowerCase().includes(titleLower)) {
      continue;
    }

    if (tagsLower && !parsed.tags.toLowerCase().includes(tagsLower)) {
      continue;
    }

    const fullTextMatchIndex = fullTextLower ? content.toLowerCase().indexOf(fullTextLower) : -1;

    if (fullTextLower && fullTextMatchIndex === -1) {
      continue;
    }

    const snippet = fullTextLower && fullTextMatchIndex >= 0
      ? createMatchSnippet(content, fullTextMatchIndex, fullTextLower.length)
      : getFallbackSnippet(parsed.body);

    results.push({
      filePath: vscode.workspace.asRelativePath(fileUri, false),
      fileUri: fileUri.toString(),
      fileName,
      title: parsed.title,
      tags: parsed.tags,
      snippet,
      score: scoreResult(
        {
          fileName: fileNameLower,
          title: parsed.title.toLowerCase(),
          tags: parsed.tags.toLowerCase(),
          hasFullTextMatch: fullTextMatchIndex >= 0
        },
        { fileNamePatternLower, titleLower, tagsLower, fullTextLower }
      )
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.filePath.localeCompare(b.filePath);
  });

  return results;
}

function scoreResult(
  source: { fileName: string; title: string; tags: string; hasFullTextMatch: boolean },
  query: { fileNamePatternLower: string; titleLower: string; tagsLower: string; fullTextLower: string }
): number {
  let score = 0;

  if (query.titleLower && source.title.includes(query.titleLower)) {
    score += 40;
  }

  if (query.tagsLower && source.tags.includes(query.tagsLower)) {
    score += 30;
  }

  if (query.fileNamePatternLower && source.fileName.includes(query.fileNamePatternLower)) {
    score += 20;
  }

  if (query.fullTextLower && source.hasFullTextMatch) {
    score += 10;
  }

  return score;
}

function parseFrontMatter(content: string): ParsedMarkdown {
  const normalized = content.replace(/\r\n/g, '\n');

  if (!normalized.startsWith('---\n')) {
    return {
      title: '',
      tags: '',
      body: content
    };
  }

  const lines = normalized.split('\n');
  let closingIndex = -1;

  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return {
      title: '',
      tags: '',
      body: content
    };
  }

  let title = '';
  let tags = '';

  for (let i = 1; i < closingIndex; i += 1) {
    const line = lines[i];
    const separatorIndex = line.indexOf(':');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'title') {
      title = value;
    } else if (key === 'tags') {
      tags = value;
    }
  }

  return {
    title,
    tags,
    body: lines.slice(closingIndex + 1).join('\n')
  };
}

function createMatchSnippet(content: string, matchIndex: number, matchLength: number): string {
  const radius = 60;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(content.length, matchIndex + matchLength + radius);
  const rawSnippet = content.slice(start, end);
  const compactSnippet = compactText(rawSnippet);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${compactSnippet}${suffix}`;
}

function getFallbackSnippet(body: string): string {
  const firstNonEmptyLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstNonEmptyLine) {
    return compactText(firstNonEmptyLine).slice(0, 100);
  }

  return compactText(body).slice(0, 100);
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getFileName(fileUri: vscode.Uri): string {
  const normalizedPath = fileUri.path.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  return segments[segments.length - 1] || normalizedPath;
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
      max-width: 760px;
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
      cursor: pointer;
    }

    .results {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #ccc;
    }

    .results-meta {
      color: #666;
      margin-bottom: 10px;
      font-size: 0.95em;
    }

    #resultsList {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .result-item {
      margin-bottom: 10px;
    }

    .result-button {
      all: unset;
      box-sizing: border-box;
      display: block;
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 10px;
      cursor: pointer;
      background: #fff;
    }

    .result-button:hover {
      background: #f7f7f7;
      border-color: #bbb;
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

    mark {
      background: #ffe28a;
      padding: 0 1px;
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

    <section class="results">
      <h2>Results</h2>
      <div id="resultsMeta" class="results-meta">Enter at least one filter to search.</div>
      <ul id="resultsList"></ul>
    </section>
  </div>

  <script>
    const vscodeApi = acquireVsCodeApi();
    const fileNamePatternInput = document.getElementById('fileNamePattern');
    const titleInput = document.getElementById('title');
    const tagsInput = document.getElementById('tags');
    const fullTextInput = document.getElementById('fullText');
    const resultsMeta = document.getElementById('resultsMeta');
    const resultsList = document.getElementById('resultsList');
    let debounceHandle = undefined;

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message?.type !== 'searchResults') {
        return;
      }

      renderResults(message.payload ?? [], getFilters());
    });

    [fileNamePatternInput, titleInput, tagsInput, fullTextInput].forEach((inputElement) => {
      inputElement?.addEventListener('input', () => {
        scheduleSearch();
      });
    });

    function runSearch() {
      const filters = getFilters();

      if (!hasAnyFilter(filters)) {
        renderNoFilterState();
        return;
      }

      if (resultsMeta) {
        resultsMeta.textContent = 'Searching...';
      }

      vscodeApi.postMessage({
        type: 'search',
        payload: filters
      });
    }

    function scheduleSearch() {
      if (debounceHandle) {
        clearTimeout(debounceHandle);
      }

      debounceHandle = setTimeout(() => {
        runSearch();
      }, 250);
    }

    function getFilters() {
      return {
        fileNamePattern: fileNamePatternInput?.value ?? '',
        title: titleInput?.value ?? '',
        tags: tagsInput?.value ?? '',
        fullText: fullTextInput?.value ?? ''
      };
    }

    function hasAnyFilter(filters) {
      return Boolean(
        filters.fileNamePattern.trim() ||
        filters.title.trim() ||
        filters.tags.trim() ||
        filters.fullText.trim()
      );
    }

    function renderNoFilterState() {
      if (!resultsMeta || !resultsList) {
        return;
      }

      resultsMeta.textContent = 'Enter at least one filter to search.';
      resultsList.innerHTML = '';
    }

    function renderResults(results, filters) {
      if (!resultsList || !resultsMeta) {
        return;
      }

      resultsList.innerHTML = '';

      if (!results.length) {
        resultsMeta.textContent = 'No results found.';
        const emptyItem = document.createElement('li');
        emptyItem.className = 'result-path';
        emptyItem.textContent = 'Try a broader query or remove one of the filters.';
        resultsList.appendChild(emptyItem);
        return;
      }

      resultsMeta.textContent = results.length === 1 ? '1 result' : results.length + ' results';

      for (const result of results) {
        const item = document.createElement('li');
        item.className = 'result-item';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'result-button';
        button.addEventListener('click', () => {
          vscodeApi.postMessage({
            type: 'openFile',
            payload: {
              filePath: result.filePath,
              fileUri: result.fileUri
            }
          });
        });

        const name = document.createElement('div');
        name.className = 'result-name';
        name.innerHTML = highlightText(result.fileName, filters.fileNamePattern);

        const path = document.createElement('div');
        path.className = 'result-path';
        path.innerHTML = escapeHtml(result.filePath);

        const metadata = document.createElement('div');
        metadata.className = 'result-path';
        const metadataParts = [];

        if (result.title) {
          metadataParts.push('Title: ' + highlightText(result.title, filters.title));
        }

        if (result.tags) {
          metadataParts.push('Tags: ' + highlightText(result.tags, filters.tags));
        }

        metadata.innerHTML = metadataParts.join(' | ');

        const snippet = document.createElement('div');
        snippet.className = 'result-snippet';
        snippet.innerHTML = highlightText(result.snippet, filters.fullText);

        button.appendChild(name);
        button.appendChild(path);

        if (metadata.innerHTML) {
          button.appendChild(metadata);
        }

        button.appendChild(snippet);
        item.appendChild(button);
        resultsList.appendChild(item);
      }
    }

    function highlightText(text, query) {
      const normalizedQuery = (query ?? '').trim();

      if (!normalizedQuery) {
        return escapeHtml(text ?? '');
      }

      const regex = new RegExp('(' + escapeRegExp(normalizedQuery) + ')', 'ig');
      const parts = String(text ?? '').split(regex);

      return parts
        .map((part, index) => {
          if (index % 2 === 1) {
            return '<mark>' + escapeHtml(part) + '</mark>';
          }

          return escapeHtml(part);
        })
        .join('');
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
    }
  </script>
</body>
</html>`;
}
