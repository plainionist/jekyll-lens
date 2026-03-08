export function getWebviewHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>Jekyll Lens</title>
  <style>
    body {
      font-family: sans-serif;
      margin: 16px;
      line-height: 1.4;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }

    .container {
      width: 100%;
    }

    .field {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
    }

    label {
      font-weight: 600;
      margin: 0;
      color: var(--vscode-foreground);
    }

    input {
      box-sizing: border-box;
      width: 100%;
      padding: 8px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
    }

    input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 0;
    }

    .results {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .results-meta {
      color: var(--vscode-descriptionForeground);
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
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 10px;
      cursor: pointer;
      background: var(--vscode-editorWidget-background);
      color: var(--vscode-foreground);
      box-shadow: 0 0 0 1px var(--vscode-contrastBorder, transparent);
    }

    .result-button:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .result-button:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 0;
    }

    .result-name {
      font-weight: 600;
    }

    .result-path {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-top: 2px;
    }

    .result-snippet {
      margin-top: 8px;
      white-space: pre-wrap;
    }

    mark {
      background: var(--vscode-editor-findMatchHighlightBackground);
      color: var(--vscode-editor-findMatchHighlightForeground);
      padding: 0 1px;
    }

    @media (max-width: 640px) {
      .field {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
  </style>
</head>
<body>
  <div class="container">

    <div class="field">
      <label for="fullText">Full Text</label>
      <input id="fullText" type="text" />
    </div>

    <div class="field">
      <label for="title">Title</label>
      <input id="title" type="text" />
    </div>

    <div class="field">
      <label for="tags">Tag</label>
      <input id="tags" type="text" />
    </div>

    <div class="field">
      <label for="fileNamePattern">File Name Pattern</label>
      <input id="fileNamePattern" type="text" />
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

    function scheduleSearch() {
      if (debounceHandle) {
        clearTimeout(debounceHandle);
      }

      debounceHandle = setTimeout(() => {
        runSearch();
      }, 250);
    }

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
