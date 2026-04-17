import type { AgentHistoryItem, InariToolDefinition, LLMProvider } from "../llm/types.js";
import { runEngineTool, type ConfirmFn } from "../tools/engine-run.js";
import type { ResolvedShellPolicy } from "../policy/shell.js";
import type { EmbeddingClient } from "../tools/embeddings-api.js";
import { inariJsonLog } from "../observability/json-log.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { summarizeAndCompactHistory, type SummarizationConfig } from "../session/context-compact.js";
import { executeTool } from "../utils/concurrency-pool.js";

function truncJson(s: string, max = 2_000): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export type AgentTurnOptions = {
  workspaceRoot: string;
  provider: LLMProvider;
  tools: InariToolDefinition[];
  systemPrompt: string;
  userText: string;
  history: AgentHistoryItem[];
  maxSteps: number;
  maxHistoryItems: number;
  confirm: ConfirmFn;
  skipConfirm: boolean;
  readOnly: boolean;
  shellPolicy: ResolvedShellPolicy;
  /** Python sidecar argv when `codebase_search` is available */
  sidecarArgv: string[] | null;
  embeddingClient: EmbeddingClient | null;
  streaming: boolean;
  onTextDelta?: (chunk: string) => void;
  signal?: AbortSignal;
  /** LLM-driven context summarization config */
  summarization: SummarizationConfig;
};

export type AgentTurnResult = {
  assistantText: string;
  history: AgentHistoryItem[];
};

function trimHistory(history: AgentHistoryItem[], maxItems: number): AgentHistoryItem[] {
  if (history.length <= maxItems) return history;
  return history.slice(-maxItems);
}

export async function runAgentTurn(opts: AgentTurnOptions): Promise<AgentTurnResult> {
  inariJsonLog({
    event: "agent_turn_start",
    workspaceRoot: opts.workspaceRoot,
    userText: truncJson(opts.userText, 4_000),
  });

  let history: AgentHistoryItem[] = trimHistory(
    [...opts.history, { kind: "user_text", text: opts.userText }],
    opts.maxHistoryItems,
  );
  let assistantText = "";
  let steps = 0;

  while (steps < opts.maxSteps) {
    steps += 1;
    // Compact history if approaching context limits
    history = await summarizeAndCompactHistory(history, opts.provider, opts.summarization, {
      maxChars: 180_000,
    });

    const onDelta =
      opts.streaming && opts.onTextDelta
        ? (chunk: string) => {
            opts.onTextDelta!(chunk);
          }
        : undefined;

    const result = await opts.provider.complete({
      system: opts.systemPrompt,
      history,
      tools: opts.tools,
      onTextDelta: onDelta,
      signal: opts.signal,
    });

    history = trimHistory([...history, { kind: "assistant", blocks: result.blocks }], opts.maxHistoryItems);

    inariJsonLog({
      event: "agent_model_step",
      step: steps,
      blockKinds: result.blocks.map((b) => b.type),
    });

    const textParts = result.blocks.filter((b) => b.type === "text").map((b) => b.text);
    if (textParts.length > 0) {
      assistantText += textParts.join("");
    }

    const toolUses = result.blocks.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      break;
    }

    const outputs: { id: string; content: string }[] = [];
    // Execute independent tool calls in parallel (concurrency-limited) for faster agent loops
    const results = await Promise.all(
      toolUses.map((tu) =>
        executeTool(() =>
          runEngineTool({
            workspaceRoot: opts.workspaceRoot,
            name: tu.name,
            input: tu.input,
            confirm: opts.confirm,
            skipConfirm: opts.skipConfirm,
            readOnly: opts.readOnly,
            shellPolicy: opts.shellPolicy,
            sidecarArgv: opts.sidecarArgv,
            embeddingClient: opts.embeddingClient,
            signal: opts.signal,
          }).then((output) => {
            inariJsonLog({
              event: "tool_result",
              step: steps,
              tool: tu.name,
              input: truncJson(JSON.stringify(tu.input)),
              output: truncJson(output),
            });
            return { id: tu.id, content: output };
          }),
        ),
      ),
    );
    outputs.push(...results);

    history = trimHistory([...history, { kind: "tool_outputs", outputs }], opts.maxHistoryItems);
  }

  inariJsonLog({
    event: "agent_turn_end",
    steps,
    replyChars: assistantText.length,
  });

  return { assistantText, history };
}

export function createChatSystemPrompt(workspaceRoot: string, skillAppendix = ""): string {
  return buildSystemPrompt(workspaceRoot, skillAppendix);
}
