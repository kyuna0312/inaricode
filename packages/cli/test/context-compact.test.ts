import { describe, expect, it } from "vitest";
import {
  summarizeAndCompactHistory,
  type SummarizationConfig,
} from "../src/session/context-compact.js";
import type { AgentHistoryItem, LLMProvider } from "../src/llm/types.js";

function u(t: string): AgentHistoryItem { return { kind: "user_text", text: t }; }
function a(t: string): AgentHistoryItem {
  return { kind: "assistant", blocks: [{ type: "text", text: t }] };
}

function bigHistory(nTurns: number): AgentHistoryItem[] {
  const h: AgentHistoryItem[] = [];
  for (let i = 0; i < nTurns; i++) {
    h.push(u("x".repeat(5_000)));
    h.push(a("y".repeat(5_000)));
  }
  return h;
}

function trackingProvider(reply = "summary"): { provider: LLMProvider; callCount: () => number } {
  let n = 0;
  return {
    provider: {
      async complete() {
        n++;
        return { stopReason: "end_turn", blocks: [{ type: "text", text: reply }] };
      },
    },
    callCount: () => n,
  };
}

const DISABLED: SummarizationConfig = {
  enabled: false,
  threshold: 0,
  keepRecentTurns: 4,
};

const ENABLED_LOW: SummarizationConfig = {
  enabled: true,
  threshold: 1_000,
  keepRecentTurns: 2,
};

describe("summarizeAndCompactHistory", () => {
  it("does not call provider when summarization is disabled", async () => {
    const { provider, callCount } = trackingProvider();
    const h = bigHistory(5);
    await summarizeAndCompactHistory(h, provider, DISABLED);
    expect(callCount()).toBe(0);
  });

  it("does not call provider when history is under threshold", async () => {
    const { provider, callCount } = trackingProvider();
    const h: AgentHistoryItem[] = [u("hi"), a("hello")];
    await summarizeAndCompactHistory(h, provider, {
      enabled: true,
      threshold: 999_999,
      keepRecentTurns: 4,
    });
    expect(callCount()).toBe(0);
  });

  it("calls provider when enabled and over threshold", async () => {
    const { provider, callCount } = trackingProvider("concise summary");
    const h = bigHistory(10);
    const result = await summarizeAndCompactHistory(h, provider, ENABLED_LOW);
    expect(callCount()).toBe(1);
    expect(result[0]).toEqual({
      kind: "user_text",
      text: expect.stringContaining("[Session context summary:"),
    });
  });

  it("still compacts history after summarization when over maxChars", async () => {
    const { provider } = trackingProvider("summary of old stuff");
    const h = bigHistory(20);
    const result = await summarizeAndCompactHistory(h, provider, ENABLED_LOW, {
      maxChars: 50_000,
    });
    let total = 0;
    for (const item of result) {
      if (item.kind === "user_text") total += item.text.length;
      else if (item.kind === "assistant")
        total += item.blocks.reduce(
          (s, b) => s + (b.type === "text" ? b.text.length : 0),
          0,
        );
    }
    // allow 10% slack for compaction heuristics
    expect(total).toBeLessThanOrEqual(50_000 * 1.1);
  });
});
