import { describe, expect, it } from "vitest";
import {
  renderHistoryAsText,
  summarizeHistory,
} from "../src/session/summarize-history.js";
import type { AgentHistoryItem, LLMProvider } from "../src/llm/types.js";

function u(t: string): AgentHistoryItem { return { kind: "user_text", text: t }; }
function a(text: string): AgentHistoryItem {
  return { kind: "assistant", blocks: [{ type: "text", text }] };
}
function tool(id: string, content: string): AgentHistoryItem {
  return { kind: "tool_outputs", outputs: [{ id, content }] };
}

function mockProvider(reply: string): LLMProvider {
  return {
    async complete() {
      return { stopReason: "end_turn", blocks: [{ type: "text", text: reply }] };
    },
  };
}

describe("renderHistoryAsText", () => {
  it("renders user and assistant items", () => {
    const h: AgentHistoryItem[] = [u("hello"), a("world")];
    const out = renderHistoryAsText(h);
    expect(out).toContain("User: hello");
    expect(out).toContain("Assistant: world");
  });

  it("renders tool_use names in assistant blocks", () => {
    const h: AgentHistoryItem[] = [
      {
        kind: "assistant",
        blocks: [
          { type: "text", text: "Reading..." },
          { type: "tool_use", id: "t1", name: "read_file", input: { path: "x.ts" } },
        ],
      },
    ];
    const out = renderHistoryAsText(h);
    expect(out).toContain("[called read_file]");
  });

  it("truncates long tool output content", () => {
    const longContent = "x".repeat(500);
    const h: AgentHistoryItem[] = [tool("t1", longContent)];
    const out = renderHistoryAsText(h);
    expect(out.length).toBeLessThan(longContent.length + 50);
    expect(out).toContain("Tool results:");
  });
});

describe("summarizeHistory", () => {
  it("returns same reference when too few turns to summarize", async () => {
    const h: AgentHistoryItem[] = [u("q"), a("a")];
    const result = await summarizeHistory(h, {
      provider: mockProvider("summary"),
      keepRecentTurns: 4,
    });
    expect(result).toBe(h);
  });

  it("replaces old turns with summary, keeps recent turns", async () => {
    const h: AgentHistoryItem[] = [
      u("turn1"), a("resp1"),
      u("turn2"), a("resp2"),
      u("turn3"), a("resp3"),
    ];
    const result = await summarizeHistory(h, {
      provider: mockProvider("The user asked three questions."),
      keepRecentTurns: 2,
    });
    // summary first
    expect(result[0]).toEqual({
      kind: "user_text",
      text: expect.stringContaining("[Session context summary:"),
    });
    expect((result[0] as { kind: "user_text"; text: string }).text).toContain(
      "The user asked three questions.",
    );
    // recent turns preserved
    expect(result).toContainEqual(u("turn3"));
    expect(result).toContainEqual(a("resp3"));
    // old turns gone
    expect(
      result.some((h) => h.kind === "user_text" && (h as { kind: "user_text"; text: string }).text === "turn1"),
    ).toBe(false);
  });

  it("calls provider with a system prompt and no tools", async () => {
    const calls: Parameters<LLMProvider["complete"]>[0][] = [];
    const trackingProvider: LLMProvider = {
      async complete(p) {
        calls.push(p);
        return { stopReason: "end_turn", blocks: [{ type: "text", text: "ok" }] };
      },
    };
    const h: AgentHistoryItem[] = [u("a"), a("b"), u("c"), a("d"), u("e"), a("f")];
    await summarizeHistory(h, { provider: trackingProvider, keepRecentTurns: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.tools).toEqual([]);
    expect(calls[0]!.system).toMatch(/summarize/i);
  });
});
