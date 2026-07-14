export type LlmTextMessage = {
  role: "user" | "assistant";
  content: string | LlmContentBlock[];
};

export type LlmContentBlock =
  | LlmTextBlock
  | LlmServerToolUseBlock
  | LlmWebSearchToolResultBlock;

export type LlmTextBlock = {
  type: "text";
  text: string;
  citations?: LlmCitation[];
};

export type LlmCitation = {
  type: "web_search_result_location";
  url: string;
  title?: string | null;
  cited_text?: string;
  encrypted_index?: string;
};

export type LlmServerToolUseBlock = {
  type: "server_tool_use";
  id: string;
  name: string;
  input?: { query?: string };
};

export type LlmWebSearchToolResultBlock = {
  type: "web_search_tool_result";
  tool_use_id: string;
  content:
    | LlmWebSearchResult[]
    | { type: "web_search_tool_result_error"; error_code: string };
};

export type LlmWebSearchResult = {
  type: "web_search_result";
  url: string;
  title?: string | null;
  page_age?: string;
};

export type LlmMessageResponse = {
  id: string;
  role: "assistant";
  content: LlmContentBlock[];
  stop_reason: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
};

export type LlmTool = {
  name: "web_search";
  maxUses?: number;
};

export type LlmMessageInput = {
  messages: LlmTextMessage[];
  system: string;
  maxTokens?: number;
  tools?: LlmTool[];
};
