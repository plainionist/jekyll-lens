import * as vscode from 'vscode';
import { parseFrontMatter } from './parsing/frontMatter';
import { SearchFilters, SearchResult } from './types';

export async function searchMarkdownFiles(filters: SearchFilters): Promise<SearchResult[]> {
  const fileNamePatternLower = filters.fileNamePattern.toLowerCase();
  const titleLower = filters.title.toLowerCase();
  const tagsLower = filters.tags.toLowerCase();
  const fullTextLower = filters.fullText.toLowerCase();
  const requiresMarkdownFilters = Boolean(titleLower || tagsLower || fullTextLower);

  if (!fileNamePatternLower && !titleLower && !tagsLower && !fullTextLower) {
    return [];
  }

  const candidateFiles = requiresMarkdownFilters
    ? await vscode.workspace.findFiles('**/*.md', '**/node_modules/**')
    : await vscode.workspace.findFiles('**/*', '**/node_modules/**');

  const results: SearchResult[] = [];

  for (const fileUri of candidateFiles) {
    const fileName = getFileName(fileUri);
    const isMarkdown = isMarkdownFile(fileUri);

    if (fileNamePatternLower && !fileName.toLowerCase().includes(fileNamePatternLower)) {
      continue;
    }

    if (requiresMarkdownFilters && !isMarkdown) {
      continue;
    }

    if (!isMarkdown) {
      results.push({
        filePath: vscode.workspace.asRelativePath(fileUri, false),
        fileUri: fileUri.toString(),
        fileName,
        title: '',
        tags: '',
        snippet: 'File name match'
      });
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
      ? createMatchSnippet(content, fullTextMatchIndex)
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

function isMarkdownFile(fileUri: vscode.Uri): boolean {
  return fileUri.path.toLowerCase().endsWith('.md');
}

function createMatchSnippet(content: string, matchIndex: number): string {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const matchLineIndex = getLineIndexFromOffset(normalized, matchIndex);
  const startLine = Math.max(0, matchLineIndex - 2);
  const endLine = Math.min(lines.length - 1, matchLineIndex + 2);
  const visibleLines = lines.slice(startLine, endLine + 1).map((line) => compactText(line));
  const hasLeadingLines = startLine > 0;
  const hasTrailingLines = endLine < lines.length - 1;
  const prefix = hasLeadingLines ? '...\n' : '';
  const suffix = hasTrailingLines ? '\n...' : '';
  return `${prefix}${visibleLines.join('\n')}${suffix}`;
}

function getLineIndexFromOffset(content: string, offset: number): number {
  let lineIndex = 0;

  for (let i = 0; i < offset && i < content.length; i += 1) {
    if (content[i] === '\n') {
      lineIndex += 1;
    }
  }

  return lineIndex;
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
