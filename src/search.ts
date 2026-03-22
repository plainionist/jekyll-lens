import * as vscode from 'vscode';
import { decodeSearchableText, isMarkdownFile } from './fileTypes';
import { parseFrontMatter } from './parsing/frontMatter';
import { NormalizedSearchFilters, SearchFilters, SearchResult } from './types';

const MAX_CONCURRENT_FILE_READS = 8;

const SEARCH_WEIGHTS = {
  title: 40,
  tags: 30,
  filePathPattern: 20,
  fullText: 10
} as const;

export async function searchFiles(filters: SearchFilters): Promise<SearchResult[]> {
  const normalizedFilters = normalizeFilters(filters);

  if (!hasAnyFilter(normalizedFilters)) {
    return [];
  }

  const candidateFiles = await findCandidateFiles(normalizedFilters);
  const results = await collectSearchResults(candidateFiles, normalizedFilters);

  results.sort((a, b) => {
    const scoreA = scoreResult(a, normalizedFilters);
    const scoreB = scoreResult(b, normalizedFilters);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return a.filePath.localeCompare(b.filePath);
  });

  return results;
}

function normalizeFilters(filters: SearchFilters): NormalizedSearchFilters {
  return {
    filePathPattern: filters.filePathPattern.trim().toLowerCase(),
    title: filters.title.trim().toLowerCase(),
    tags: filters.tags.trim().toLowerCase(),
    fullText: filters.fullText.trim().toLowerCase()
  };
}

function hasAnyFilter(filters: NormalizedSearchFilters): boolean {
  return Boolean(filters.filePathPattern || filters.title || filters.tags || filters.fullText);
}

function requiresMarkdownMetadataFilters(filters: NormalizedSearchFilters): boolean {
  return Boolean(filters.title || filters.tags);
}

async function findCandidateFiles(filters: NormalizedSearchFilters): Promise<vscode.Uri[]> {
  if (requiresMarkdownMetadataFilters(filters)) {
    return vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
  }

  return vscode.workspace.findFiles('**/*', '**/node_modules/**');
}

async function collectSearchResults(
  candidateFiles: vscode.Uri[],
  filters: NormalizedSearchFilters
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  for (let i = 0; i < candidateFiles.length; i += MAX_CONCURRENT_FILE_READS) {
    const batch = candidateFiles.slice(i, i + MAX_CONCURRENT_FILE_READS);
    const batchResults = await Promise.all(batch.map(async (fileUri) => evaluateCandidate(fileUri, filters)));

    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }
  }

  return results;
}

async function evaluateCandidate(fileUri: vscode.Uri, filters: NormalizedSearchFilters): Promise<SearchResult | undefined> {
  const relativePath = vscode.workspace.asRelativePath(fileUri, false);
  const fileName = getFileName(fileUri);
  const markdown = isMarkdownFile(fileUri);

  if (filters.filePathPattern && !relativePath.toLowerCase().includes(filters.filePathPattern)) {
    return undefined;
  }

  if (requiresMarkdownMetadataFilters(filters) && !markdown) {
    return undefined;
  }

  if (!filters.fullText) {
    if (!markdown) {
      return {
        filePath: relativePath,
        fileUri: fileUri.toString(),
        fileName,
        title: '',
        tags: '',
        snippet: 'File path match'
      };
    }

    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const content = decodeSearchableText(bytes);

    if (content === undefined) {
      return undefined;
    }

    const parsed = parseFrontMatter(content);

    if (filters.title && !parsed.title.toLowerCase().includes(filters.title)) {
      return undefined;
    }

    if (filters.tags && !parsed.tags.toLowerCase().includes(filters.tags)) {
      return undefined;
    }

    return {
      filePath: relativePath,
      fileUri: fileUri.toString(),
      fileName,
      title: parsed.title,
      tags: parsed.tags,
      snippet: getFallbackSnippet(parsed.body)
    };
  }

  const bytes = await vscode.workspace.fs.readFile(fileUri);
  const content = decodeSearchableText(bytes);

  if (content === undefined) {
    return undefined;
  }

  const parsed = markdown ? parseFrontMatter(content) : { title: '', tags: '', body: content };

  if (filters.title && !parsed.title.toLowerCase().includes(filters.title)) {
    return undefined;
  }

  if (filters.tags && !parsed.tags.toLowerCase().includes(filters.tags)) {
    return undefined;
  }

  const fullTextMatchIndex = filters.fullText ? content.toLowerCase().indexOf(filters.fullText) : -1;

  if (filters.fullText && fullTextMatchIndex === -1) {
    return undefined;
  }

  const snippet = filters.fullText && fullTextMatchIndex >= 0
    ? createMatchSnippet(content, fullTextMatchIndex)
    : getFallbackSnippet(parsed.body);

  return {
    filePath: relativePath,
    fileUri: fileUri.toString(),
    fileName,
    title: parsed.title,
    tags: parsed.tags,
    snippet
  };
}

function scoreResult(result: SearchResult, filters: NormalizedSearchFilters): number {
  let score = 0;

  if (filters.title && result.title.toLowerCase().includes(filters.title)) {
    score += SEARCH_WEIGHTS.title;
  }

  if (filters.tags && result.tags.toLowerCase().includes(filters.tags)) {
    score += SEARCH_WEIGHTS.tags;
  }

  if (filters.filePathPattern && result.filePath.toLowerCase().includes(filters.filePathPattern)) {
    score += SEARCH_WEIGHTS.filePathPattern;
  }

  if (filters.fullText) {
    score += SEARCH_WEIGHTS.fullText;
  }

  return score;
}

function getFileName(fileUri: vscode.Uri): string {
  const normalizedPath = fileUri.path.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  return segments[segments.length - 1] || normalizedPath;
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
