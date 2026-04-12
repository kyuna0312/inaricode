import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { AgentHistoryItem, CompleteResult, InariToolDefinition, LLMProvider, NormalizedBlock } from "./types.js";

function toOpenAiTools(defs: InariToolDefinition[]): ChatCompletionTool[] {
  return defs.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.input_schema,
    },
  }));
}

function historyToOpenAiMessages(history: AgentHistoryItem[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [];
  for (const h of history) {
    if (h.kind === "user_text") {
      out.push({ role: "user", content: h.text });
    } else if (h.kind === "assistant") {
      const textParts = h.blocks.filter((b): b is Extract<NormalizedBlock, { type: "text" }> => b.type === "text");
      const toolParts = h.blocks.filter((b): b is Extract<NormalizedBlock, { type: "tool_use" }> => b.type === "tool_use");
      const text = textParts.map((b) => b.text).join("") || null;
      if (toolParts.length === 0) {
        out.push({ role: "assistant", content: text });
      } else {
        out.push({
          role: "assistant",
          content: text,
          tool_calls: toolParts.map((tu) => ({
            id: tu.id,
            type: "function" as const,
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input ?? {}),
            },
          })),
        });
      }
    } else if (h.kind === "tool_outputs") {
      for (const o of h.outputs) {
        out.push({
          role: "tool",
          tool_call_id: o.id,
          content: o.content,
        });
      }
    }
  }
  return out;
}

export type OpenAICompatibleOptions = {
  apiKey: string;
  model: string;
  baseURL: string;
};

/** ChatGPT, Kimi (Moonshot), Qwen (DashScope compatible), Ollama/Llama, Groq, Together, Azure-compatible, etc. */
export class OpenAICompatibleProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: OpenAICompatibleOptions) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL,
    });
    this.model = opts.model;
  }

  async complete(params: {
    system: string;
    history: AgentHistoryItem[];
    tools: InariToolDefinition[];
    onTextDelta?: (chunk: string) => void;
    signal?: AbortSignal;
  }): Promise<CompleteResult> {
    const userMessages = historyToOpenAiMessages(params.history);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: params.system },
      ...userMessages,
    ];
    const tools = toOpenAiTools(params.tools);
    const body = {
      model: this.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? ("auto" as const) : undefined,
      temperature: 0.2,
    };

    if (params.onTextDelta) {
      const stream = await this.client.chat.completions.create(
        { ...body, stream: true },
        { signal: params.signal },
      );
      let finishReason: string | null = null;
      let textAcc = "";
      const toolAcc = new Map<number, { id: string; name: string; args: string }>();
      for await (const chunk of stream) {
        const ch = chunk.choices[0];
        if (ch?.finish_reason) finishReason = ch.finish_reason;
        const delta = ch?.delta;
        if (delta?.content) {
          textAcc += delta.content;
          params.onTextDelta(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let row = toolAcc.get(idx);
            if (!row) {
              row = { id: "", name: "", args: "" };
              toolAcc.set(idx, row);
            }
            if (tc.id) row.id = tc.id;
            if (tc.function?.name) row.name = tc.function.name;
            if (tc.function?.arguments) row.args += tc.function.arguments;
          }
        }
      }
      const blocks: NormalizedBlock[] = [];
      if (textAcc) blocks.push({ type: "text", text: textAcc });
      const sorted = [...toolAcc.entries()].sort((a, b) => a[0] - b[0]);
      for (const [idx, row] of sorted) {
        if (!row.name) continue;
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(row.args || "{}") as Record<string, unknown>;
        } catch {
          input = { _parse_error: true, raw: row.args };
        }
        blocks.push({
          type: "tool_use",
          id: row.id || `tool_${idx}`,
          name: row.name,
          input,
        });
      }
      return { stopReason: finishReason, blocks };
    }

    const resp = await this.client.chat.completions.create(body, { signal: params.signal });

    const choice = resp.choices[0];
    const msg = choice?.message;
    const blocks: NormalizedBlock[] = [];
    if (msg?.content) {
      blocks.push({ type: "text", text: msg.content });
    }
    for (const tc of msg?.tool_calls ?? []) {
      if (tc.type !== "function") continue;
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        input = { _parse_error: true, raw: tc.function.arguments };
      }
      blocks.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }

    return {
      stopReason: choice?.finish_reason ?? null,
      blocks,
    };
  }
}
