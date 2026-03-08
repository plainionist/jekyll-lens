import * as vscode from 'vscode';
import { searchMarkdownFiles } from './search';
import { SearchFilters, SearchRequestMessage, SearchResultsMessage } from './types';
import { getWebviewHtml } from './webview/html';

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

      const filters = normalizeFilters(message.payload);
      const results = await searchMarkdownFiles(filters);
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

function normalizeFilters(payload?: Partial<SearchFilters>): SearchFilters {
  return {
    fileNamePattern: payload?.fileNamePattern?.trim() ?? '',
    title: payload?.title?.trim() ?? '',
    tags: payload?.tags?.trim() ?? '',
    fullText: payload?.fullText?.trim() ?? ''
  };
}

export function deactivate(): void {
  // No cleanup needed for this minimal extension.
}
