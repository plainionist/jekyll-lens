import { ParsedMarkdown } from '../types';

export function parseFrontMatter(content: string): ParsedMarkdown {
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
