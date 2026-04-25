import { describe, expect, it } from "vitest";
import {
  estimateTokens,
  estimateHistoryTokens,
  formatTokenCount,
} from "../src/utils/token-estimate.js";
import type { AgentHistoryItem } from "../src/llm/types.js";

function u(t: string): AgentHistoryItem {
  return { kind: "user_text", text: t };
}
function a(text: string): AgentHistoryItem {
  return { kind: "assistant", blocks: [{ type: "text", text }] };
}
function tool(id: string, content: string): AgentHistoryItem {
  return { kind: "tool_outputs", outputs: [{ id, content }] };
}

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("rounds up chars/4", () => {
    expect(estimateTokens("abcd")).toBe(1); // 4/4 = 1
    expect(estimateTokens("abcde")).toBe(2); // 5/4 = 1.25 → ceil = 2
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });
});

describe("formatTokenCount", () => {
  it("returns plain number below 1000", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(320)).toBe("320");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("formats thousands with one decimal", () => {
    expect(formatTokenCount(1000)).toBe("1k");
    expect(formatTokenCount(1200)).toBe("1.2k");
    expect(formatTokenCount(1250)).toBe("1.3k"); // rounds
    expect(formatTokenCount(42000)).toBe("42k");
  });

  it("formats millions", () => {
    expect(formatTokenCount(1_000_000)).toBe("1M");
    expect(formatTokenCount(1_500_000)).toBe("1.5M");
  });
});

describe("estimateHistoryTokens", () => {
  it("returns zeros for empty history", () => {
    const result = estimateHistoryTokens([]);
    expect(result).toEqual({ input: 0, output: 0, total: 0, byTurn: [] });
  });

  it("counts user_text as input, assistant as output", () => {
    // "aaaa" = 4 chars = 1 token; "bbbbbbbb" = 8 chars = 2 tokens
    const h: AgentHistoryItem[] = [u("aaaa"), a("bbbbbbbb")];
    const result = estimateHistoryTokens(h);
    expect(result.input).toBe(1);
    expect(result.output).toBe(2);
    expect(result.total).toBe(3);
  });

  it("counts tool_outputs as input", () => {
    const h: AgentHistoryItem[] = [
      u("aaaa"),
      { kind: "tool_outputs", outputs: [{ id: "t1", content: "aaaa" }] },
      a("bbbb"),
    ];
    const result = estimateHistoryTokens(h);
    expect(result.input).toBe(2); // user + tool
    expect(result.output).toBe(1);
  });

  it("segments into turns correctly", () => {
    const h: AgentHistoryItem[] = [u("aaaa"), a("bbbb"), u("cccc"), a("dddd")];
    const result = estimateHistoryTokens(h);
    expect(result.byTurn).toHaveLength(2);
    expect(result.byTurn[0]).toEqual({ turn: 1, input: 1, output: 1 });
    expect(result.byTurn[1]).toEqual({ turn: 2, input: 1, output: 1 });
  });

  it("counts tool_use blocks in assistant as output", () => {
    const h: AgentHistoryItem[] = [
      {
        kind: "assistant",
        blocks: [
          { type: "text", text: "aaaa" },
          {
            type: "tool_use",
            id: "t1",
            name: "read_file",
            input: { path: "x" },
          },
        ],
      },
    ];
    const result = estimateHistoryTokens(h);
    expect(result.output).toBeGreaterThan(0);
  });
});
