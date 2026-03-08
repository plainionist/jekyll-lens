import * as vscode from 'vscode';
import { parseFrontMatter } from './parsing/frontMatter';
import { SearchFilters, SearchResult } from './types';

export async function searchMarkdownFiles(filters: SearchFilters): Promise<SearchResult[]> {
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

    if (fileNamePatternLower && !fileName.toLowerCase().includes(fileNamePatternLower)) {
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

    let snippet = getFallbackSnippet(parsed.body);

    if (fullTextLower) {
      const matchIndex = content.toLowerCase().indexOf(fullTextLower);

      if (matchIndex === -1) {
        continue;
      }

      snippet = createMatchSnippet(content, matchIndex, fullTextLower.length);
    }

    results.push({
      filePath: vscode.workspace.asRelativePath(fileUri, false),
      fileName,
      title: parsed.title,
      tags: parsed.tags,
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

function createMatchSnippet(content: string, matchIndex: number, matchLength: number): string {
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
