import { describe, expect, it } from "vitest";
import type { AgentHistoryItem, LLMProvider } from "../src/llm/types.js";
import { handleChatSlashInput } from "../src/ui/chat-slash.js";

function u(t: string): AgentHistoryItem { return { kind: "user_text", text: t }; }
function a(t: string): AgentHistoryItem {
  return { kind: "assistant", blocks: [{ type: "text", text: t }] };
}

function mockProvider(reply: string): LLMProvider {
  return {
    async complete() {
      return { stopReason: "end_turn", blocks: [{ type: "text", text: reply }] };
    },
  };
}

function makeCtx(
  trimmed: string,
  history: AgentHistoryItem[],
  provider: LLMProvider,
) {
  const written: string[] = [];
  let current = [...history];
  return {
    ctx: {
      locale: "en" as const,
      cwd: "/tmp",
      workspaceRoot: "/tmp",
      trimmed,
      getHistory: () => current,
      setHistory: (h: AgentHistoryItem[]) => { current = h; },
      persistHistory: async (_h: AgentHistoryItem[]) => {},
      write: async (s: string) => { written.push(s); },
      persistEmpty: async () => {},
      provider,
      summarization: { enabled: true, threshold: 0, keepRecentTurns: 1 },
    },
    written,
    getHistory: () => current,
  };
}

describe("/compact summary", () => {
  it("replaces old history with LLM summary and writes confirmation", async () => {
    const history = [u("q1"), a("a1"), u("q2"), a("a2"), u("q3"), a("a3")];
    const { ctx, written, getHistory } = makeCtx(
      "/compact summary",
      history,
      mockProvider("Summary of the session."),
    );
    const action = await handleChatSlashInput(ctx);
    expect(action.kind).toBe("again");
    expect(written.some((s) => s.toLowerCase().includes("summarized"))).toBe(true);
    expect(
      getHistory().some(
        (h) =>
          h.kind === "user_text" &&
          (h as { kind: "user_text"; text: string }).text.includes("[Session context summary:"),
      ),
    ).toBe(true);
  });

  it("does not call provider for numeric /compact", async () => {
    let providerCalled = false;
    const provider: LLMProvider = {
      async complete() {
        providerCalled = true;
        return { stopReason: "end_turn", blocks: [{ type: "text", text: "x" }] };
      },
    };
    const history = [u("q1"), a("a1"), u("q2"), a("a2"), u("q3"), a("a3"), u("q4"), a("a4"), u("q5"), a("a5")];
    const { ctx } = makeCtx("/compact 2", history, provider);
    await handleChatSlashInput(ctx);
    expect(providerCalled).toBe(false);
  });
});
