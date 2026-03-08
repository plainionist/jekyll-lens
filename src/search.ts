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
      snippet
    });
  }

  results.sort((a, b) => {
    const scoreA = scoreResult(a, filters);
    const scoreB = scoreResult(b, filters);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return a.filePath.localeCompare(b.filePath);
  });

  return results;
}

function scoreResult(result: SearchResult, filters: SearchFilters): number {
  let score = 0;

  if (filters.title && result.title.toLowerCase().includes(filters.title.toLowerCase())) {
    score += 40;
  }

  if (filters.tags && result.tags.toLowerCase().includes(filters.tags.toLowerCase())) {
    score += 30;
  }

  if (filters.fileNamePattern && result.fileName.toLowerCase().includes(filters.fileNamePattern.toLowerCase())) {
    score += 20;
  }

  if (filters.fullText) {
    score += 10;
  }

  return score;
}

function getFileName(fileUri: vscode.Uri): string {
  const normalizedPath = fileUri.path.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  return segments[segments.length - 1] || normalizedPath;
}

function createMatchSnippet(content: string, matchIndex: number, matchLength: number): string {
  const radius = 60;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(content.length, matchIndex + matchLength + radius);
  const snippet = compactText(content.slice(start, end));
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
    return compactText(firstNonEmptyLine).slice(0, 100);
  }

  return compactText(content).slice(0, 100);
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
