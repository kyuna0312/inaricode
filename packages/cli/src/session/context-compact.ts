/** Context compaction: intelligently trim conversation history to stay within provider limits. */

import type { AgentHistoryItem, LLMProvider, NormalizedBlock } from "../llm/types.js";
import { summarizeHistory } from "./summarize-history.js";

export type SummarizationConfig = {
  enabled: boolean;
  /** Char count threshold above which summarization fires (default: 120_000) */
  threshold: number;
  /** Recent user-led turns to keep unsummarized (default: 4) */
  keepRecentTurns: number;
};

export type CompactionOptions = {
  /** Maximum total characters in history (default: 200_000) */
  maxChars?: number;
  /** Minimum user turns to always keep (default: 2) */
  minUserTurns?: number;
  /** Prefer compacting tool_outputs first (default: true) */
  compressToolOutputsFirst?: boolean;
  /** Truncate tool output content to this many chars during compaction */
  toolOutputTruncateChars?: number;
};

const DEFAULT_OPTS: Required<CompactionOptions> = {
  maxChars: 200_000,
  minUserTurns: 2,
  compressToolOutputsFirst: true,
  toolOutputTruncateChars: 500,
};

function countChars(history: AgentHistoryItem[]): number {
  let total = 0;
  for (const h of history) {
    if (h.kind === "user_text") {
      total += h.text.length;
    } else if (h.kind === "assistant") {
      for (const b of h.blocks) {
        if (b.type === "text") total += b.text.length;
        else total += JSON.stringify(b.input).length;
      }
    } else if (h.kind === "tool_outputs") {
      for (const o of h.outputs) total += o.content.length;
    }
  }
  return total;
}

/**
 * Compact history when approaching provider context limits.
 * Strategy: keep recent turns, compress older tool outputs, truncate assistant text.
 */
export function compactHistory(history: AgentHistoryItem[], opts: CompactionOptions = {}): AgentHistoryItem[] {
  const options: Required<CompactionOptions> = { ...DEFAULT_OPTS, ...opts };
  const current = [...history];

  // Fast path: already under limit
  if (countChars(current) <= options.maxChars) return current;

  const result: AgentHistoryItem[] = [];
  let userTurnsKept = 0;

  // Iterate from newest to oldest, keeping recent turns and compressing older ones
  for (let i = current.length - 1; i >= 0; i--) {
    const item = current[i];
    const isUserTurn = item.kind === "user_text";

    if (isUserTurn && userTurnsKept < options.minUserTurns) {
      result.unshift(item);
      userTurnsKept++;
      continue;
    }

    // Keep the last 4 turns uncompressed
    if (i >= current.length - 4) {
      result.unshift(item);
      continue;
    }

    // Compress tool outputs
    if (item.kind === "tool_outputs" && options.compressToolOutputsFirst) {
      const truncatedOutputs = item.outputs.map((o) => ({
        id: o.id,
        content:
          o.content.length > options.toolOutputTruncateChars
            ? o.content.slice(0, options.toolOutputTruncateChars) + "…[truncated]"
            : o.content,
      }));
      result.unshift({ kind: "tool_outputs", outputs: truncatedOutputs });
      continue;
    }

    // Compress assistant text blocks
    if (item.kind === "assistant") {
      // Keep only the first text block, compress rest
      const textBlocks = item.blocks.filter((b) => b.type === "text");
      if (textBlocks.length > 1) {
        const compressedBlocks: NormalizedBlock[] = [textBlocks[0]];
        for (let j = 1; j < textBlocks.length; j++) {
          compressedBlocks.push({
            type: "text",
            text: textBlocks[j].text.slice(0, 200) + "…[compressed]",
          });
        }
        const toolBlocks = item.blocks.filter((b) => b.type === "tool_use");
        result.unshift({ kind: "assistant", blocks: [...compressedBlocks, ...toolBlocks] });
      } else {
        result.unshift(item);
      }
      continue;
    }

    // Keep everything else as-is
    result.unshift(item);
  }

  // Final pass: if still over limit, truncate from oldest end
  while (countChars(result) > options.maxChars && result.length > options.minUserTurns * 2) {
    // Remove oldest non-user item
    const idx = result.findIndex((h) => h.kind !== "user_text");
    if (idx >= 0) result.splice(idx, 1);
    else break;
  }

  return result;
}

/**
 * Summarize old turns with the LLM when over threshold, then run synchronous
 * compaction as a safety net.
 */
export async function summarizeAndCompactHistory(
  history: AgentHistoryItem[],
  provider: LLMProvider,
  summarization: SummarizationConfig,
  compactOpts: CompactionOptions = {},
): Promise<AgentHistoryItem[]> {
  let current = history;

  if (summarization.enabled && countChars(current) > summarization.threshold) {
    current = await summarizeHistory(current, {
      provider,
      keepRecentTurns: summarization.keepRecentTurns,
    });
  }

  return compactHistory(current, compactOpts);
}
