export type SearchFilters = {
  filePathPattern: string;
  title: string;
  tags: string;
  fullText: string;
};

export type NormalizedSearchFilters = {
  filePathPattern: string;
  title: string;
  tags: string;
  fullText: string;
};

export type SearchRequestMessage = {
  type: 'search';
  requestId: number;
  payload?: Partial<SearchFilters>;
};

export type OpenFileRequestMessage = {
  type: 'openFile';
  payload?: {
    filePath?: string;
    fileUri?: string;
  };
};

export type WebviewRequestMessage = SearchRequestMessage | OpenFileRequestMessage;

export type SearchResult = {
  filePath: string;
  fileUri: string;
  fileName: string;
  title: string;
  tags: string;
  snippet: string;
};

export type SearchResultsMessage = {
  type: 'searchResults';
  requestId: number;
  payload: SearchResult[];
};

export type ParsedMarkdown = {
  title: string;
  tags: string;
  body: string;
};
