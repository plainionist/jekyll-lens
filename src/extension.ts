import * as vscode from 'vscode';
import { searchMarkdownFiles } from './search';
import { SearchFilters, SearchResultsMessage, WebviewRequestMessage } from './types';
import { getWebviewHtml } from './webview/html';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('jekyllLens.openSearch', () => {
    const panel = vscode.window.createWebviewPanel(
      'jekyllLens',
      'Jekyll Lens',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
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

    try {
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
      return;
    } catch {
      // Binary files (e.g. images) should be opened with the default editor.
      await vscode.commands.executeCommand('vscode.open', uri);
      return;
    }
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
