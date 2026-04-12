import { describe, expect, it } from "vitest";
import { compactHistoryByUserTurns, segmentHistoryByUserTurns } from "../src/session/compact-history.js";
import type { AgentHistoryItem } from "../src/llm/types.js";

function u(t: string): AgentHistoryItem {
  return { kind: "user_text", text: t };
}

function a(text: string): AgentHistoryItem {
  return { kind: "assistant", blocks: [{ type: "text", text }] };
}

describe("compactHistoryByUserTurns", () => {
  it("segments by user_text", () => {
    const h: AgentHistoryItem[] = [u("a"), a("A"), u("b"), a("B")];
    const segs = segmentHistoryByUserTurns(h);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual([u("a"), a("A")]);
    expect(segs[1]).toEqual([u("b"), a("B")]);
  });

  it("keeps last n user turns", () => {
    const h: AgentHistoryItem[] = [u("1"), a("x"), u("2"), a("y"), u("3"), a("z")];
    const out = compactHistoryByUserTurns(h, 2);
    expect(out).toEqual([u("2"), a("y"), u("3"), a("z")]);
  });

  it("no-op when already small", () => {
    const h: AgentHistoryItem[] = [u("1"), a("x")];
    expect(compactHistoryByUserTurns(h, 8)).toEqual(h);
  });
});
