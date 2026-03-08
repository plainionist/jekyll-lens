export type SearchFilters = {
  fileNamePattern: string;
  title: string;
  tags: string;
  fullText: string;
};

export type SearchRequestMessage = {
  type: 'search';
  payload?: Partial<SearchFilters>;
};

export type SearchResult = {
  filePath: string;
  fileName: string;
  title: string;
  tags: string;
  snippet: string;
};

export type SearchResultsMessage = {
  type: 'searchResults';
  payload: SearchResult[];
};

export type ParsedMarkdown = {
  title: string;
  tags: string;
  body: string;
};
