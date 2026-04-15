import https from "node:https";
import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Message,
  MessageParam,
  TextBlockParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import type { AgentHistoryItem, CompleteResult, InariToolDefinition, LLMProvider, NormalizedBlock } from "./types.js";
import { withRetry } from "../utils/retry-executor.js";

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

function toAnthropicTools(defs: InariToolDefinition[]): Tool[] {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.input_schema as Tool["input_schema"],
  }));
}

/** Wrap system prompt in a single cached block (ephemeral, 5-min TTL). */
function cachedSystem(text: string): TextBlockParam[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

/**
 * Mark the last tool with an ephemeral cache breakpoint.
 * Anthropic caches everything up to and including the breakpoint, so placing it
 * on the last tool caches the entire system + tools prefix on every agent step.
 */
function cachedTools(tools: Tool[]): Tool[] {
  if (tools.length === 0) return tools;
  return tools.map((t, i) =>
    i === tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t,
  );
}

function historyToAnthropicMessages(history: AgentHistoryItem[]): MessageParam[] {
  const out: MessageParam[] = [];
  for (const h of history) {
    if (h.kind === "user_text") {
      out.push({ role: "user", content: h.text });
    } else if (h.kind === "assistant") {
      const content = blocksToAnthropicContent(h.blocks);
      out.push({ role: "assistant", content });
    } else if (h.kind === "tool_outputs") {
      out.push({
        role: "user",
        content: h.outputs.map((o) => ({
          type: "tool_result" as const,
          tool_use_id: o.id,
          content: o.content,
        })),
      });
    }
  }
  return out;
}

function blocksToAnthropicContent(blocks: NormalizedBlock[]): ContentBlockParam[] {
  const content: ContentBlockParam[] = [];
  for (const b of blocks) {
    if (b.type === "text") {
      content.push({ type: "text", text: b.text });
    } else {
      content.push({
        type: "tool_use",
        id: b.id,
        name: b.name,
        input: b.input,
      });
    }
  }
  return content;
}

function messageToBlocks(msg: Message): { stopReason: string | null; blocks: NormalizedBlock[] } {
  const blocks: NormalizedBlock[] = [];
  for (const b of msg.content) {
    if (b.type === "text") {
      blocks.push({ type: "text", text: b.text });
    } else if (b.type === "tool_use") {
      blocks.push({
        type: "tool_use",
        id: b.id,
        name: b.name,
        input: b.input as Record<string, unknown>,
      });
    }
  }
  return { stopReason: msg.stop_reason, blocks };
}

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey, httpAgent: httpsAgent });
    this.model = model;
  }

  async complete(params: {
    system: string;
    history: AgentHistoryItem[];
    tools: InariToolDefinition[];
    onTextDelta?: (chunk: string) => void;
    signal?: AbortSignal;
  }): Promise<CompleteResult> {
    const messages = historyToAnthropicMessages(params.history);
    const tools = cachedTools(toAnthropicTools(params.tools));
    const system = cachedSystem(params.system);

    if (params.onTextDelta) {
      const finalMsg = await withRetry(async () => {
        const stream = this.client.messages.stream(
          {
            model: this.model,
            max_tokens: 8192,
            system,
            messages,
            tools: tools.length > 0 ? tools : undefined,
          },
          { signal: params.signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            params.onTextDelta!(event.delta.text);
          }
        }
        return stream.finalMessage();
      });
      const { stopReason, blocks } = messageToBlocks(finalMsg);
      return { stopReason, blocks };
    }

    const resp = await withRetry(() =>
      this.client.messages.create(
        {
          model: this.model,
          max_tokens: 8192,
          system,
          messages,
          tools: tools.length > 0 ? tools : undefined,
        },
        { signal: params.signal },
      ),
    );

    const { stopReason, blocks } = messageToBlocks(resp);
    return { stopReason, blocks };
  }
}
