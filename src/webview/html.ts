export function getWebviewHtml(): string {
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
    const titleInput = document.getElementById('title');
    const tagsInput = document.getElementById('tags');
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
      const title = titleInput?.value ?? '';
      const tags = tagsInput?.value ?? '';
      const fullText = fullTextInput?.value ?? '';

      vscodeApi.postMessage({
        type: 'search',
        payload: {
          fileNamePattern,
          title,
          tags,
          fullText
        }
      });

      console.log('Search clicked', { fileNamePattern, title, tags, fullText });
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

        const metadata = document.createElement('div');
        metadata.className = 'result-path';
        const metadataParts = [];

        if (result.title) {
          metadataParts.push('Title: ' + result.title);
        }

        if (result.tags) {
          metadataParts.push('Tags: ' + result.tags);
        }

        metadata.textContent = metadataParts.join(' | ');

        const snippet = document.createElement('div');
        snippet.className = 'result-snippet';
        snippet.textContent = result.snippet;

        item.appendChild(name);
        item.appendChild(path);

        if (metadata.textContent) {
          item.appendChild(metadata);
        }

        item.appendChild(snippet);
        resultsList.appendChild(item);
      }
    }
  </script>
</body>
</html>`;
}
