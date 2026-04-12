export type NormalizedBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

/** Serializable chat history shared across providers. */
export type AgentHistoryItem =
  | { kind: "user_text"; text: string }
  | { kind: "assistant"; blocks: NormalizedBlock[] }
  | { kind: "tool_outputs"; outputs: { id: string; content: string }[] };

export type InariToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema object (OpenAI `parameters` / Anthropic `input_schema`). */
  input_schema: Record<string, unknown>;
};

export type CompleteResult = {
  stopReason: string | null;
  blocks: NormalizedBlock[];
};

export interface LLMProvider {
  complete(params: {
    system: string;
    history: AgentHistoryItem[];
    tools: InariToolDefinition[];
    /** Stream assistant text as it arrives (tool rounds still buffer until complete). */
    onTextDelta?: (chunk: string) => void;
    signal?: AbortSignal;
  }): Promise<CompleteResult>;
}
