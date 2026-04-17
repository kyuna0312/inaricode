import type { AgentHistoryItem, LLMProvider } from "../llm/types.js";
import { segmentHistoryByUserTurns } from "./compact-history.js";

export type SummarizeOptions = {
  provider: LLMProvider;
  /** User-led turns to keep unsummarized from the end (default: 4) */
  keepRecentTurns?: number;
};

/** Render history items as readable text for the summarization prompt. */
export function renderHistoryAsText(history: AgentHistoryItem[]): string {
  const parts: string[] = [];
  for (const item of history) {
    if (item.kind === "user_text") {
      parts.push(`User: ${item.text}`);
    } else if (item.kind === "assistant") {
      const textParts = item.blocks
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""));
      const toolNames = item.blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => (b.type === "tool_use" ? `[called ${b.name}]` : ""));
      const combined = [...textParts, ...toolNames].join(" ").trim();
      parts.push(`Assistant: ${combined}`);
    } else {
      // tool_outputs
      const preview = item.outputs
        .map((o) => o.content.slice(0, 200))
        .join("; ");
      parts.push(`Tool results: ${preview}`);
    }
  }
  return parts.join("\n\n");
}

/**
 * Summarize old conversation turns using the LLM.
 * Replaces all turns older than `keepRecentTurns` user-led segments with a
 * single `[Session context summary: …]` user_text item.
 * Returns the original reference unchanged when there is nothing old to summarize.
 */
export async function summarizeHistory(
  history: AgentHistoryItem[],
  opts: SummarizeOptions,
): Promise<AgentHistoryItem[]> {
  const keepRecentTurns = opts.keepRecentTurns ?? 4;
  const segments = segmentHistoryByUserTurns(history);

  if (segments.length <= keepRecentTurns) return history;

  const oldHistory = segments.slice(0, -keepRecentTurns).flat();
  const recentHistory = segments.slice(-keepRecentTurns).flat();

  const summaryText = await callLLMForSummary(oldHistory, opts.provider);

  return [
    { kind: "user_text", text: `[Session context summary: ${summaryText}]` },
    ...recentHistory,
  ];
}

async function callLLMForSummary(
  history: AgentHistoryItem[],
  provider: LLMProvider,
): Promise<string> {
  const rendered = renderHistoryAsText(history);
  const result = await provider.complete({
    system:
      "You are a conversation summarizer. Summarize the following conversation history " +
      "in 2-4 concise paragraphs. Preserve: the user's goals, key decisions made, " +
      "files read or changed, and current state. Be factual and brief. " +
      "Output only the summary, no preamble.",
    history: [
      { kind: "user_text", text: `Summarize this conversation:\n\n${rendered}` },
    ],
    tools: [],
  });
  const textBlock = result.blocks.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "No summary available.";
}
