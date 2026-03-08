import * as vscode from 'vscode';
import { searchMarkdownFiles } from './search';
import {
  SearchFilters,
  SearchRequestMessage,
  SearchResultsMessage,
  WebviewRequestMessage
} from './types';
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
    let latestRequestId = 0;

    const messageListener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (isSearchRequestMessage(message)) {
        latestRequestId = Math.max(latestRequestId, message.requestId);
        const requestId = message.requestId;
        const filters = normalizeFilters(message.payload);
        const results = await searchMarkdownFiles(filters);

        if (requestId !== latestRequestId) {
          return;
        }

        const response: SearchResultsMessage = {
          type: 'searchResults',
          requestId,
          payload: results
        };

        await panel.webview.postMessage(response);
        return;
      }

      if (isOpenFileRequestMessage(message)) {
        await openResultFile(message.payload?.filePath, message.payload?.fileUri);
      }
    });

    context.subscriptions.push(messageListener);
  });

  context.subscriptions.push(disposable);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSearchRequestMessage(message: unknown): message is SearchRequestMessage {
  if (!isObject(message)) {
    return false;
  }

  return message.type === 'search' && typeof message.requestId === 'number';
}

function isOpenFileRequestMessage(message: unknown): message is Extract<WebviewRequestMessage, { type: 'openFile' }> {
  return isObject(message) && message.type === 'openFile';
}

function normalizeFilters(payload?: Partial<SearchFilters>): SearchFilters {
  return {
    filePathPattern: payload?.filePathPattern?.trim() ?? '',
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
