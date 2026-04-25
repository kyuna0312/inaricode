# LLM-Driven Context Summarization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When conversation history grows large, call the LLM to summarize older turns instead of silently truncating them, so long sessions retain semantic context.

**Architecture:** New `summarize-history.ts` calls the provider with a summary prompt against old turns, injects the result as a `[Session context summary: …]` user-text item, then the existing synchronous `compactHistory` runs as a safety net. A new async wrapper `summarizeAndCompactHistory` in `context-compact.ts` owns the decision logic. `loop.ts` opts in when `summarization.enabled` is set in config.

**Tech Stack:** TypeScript (strict ESM), Vitest, existing `LLMProvider` interface (`packages/cli/src/llm/types.ts`), Zod (`packages/cli/src/config.ts`)

---

## File Structure

| Path | Action | Responsibility |
|------|--------|---------------|
| `packages/cli/src/session/summarize-history.ts` | **Create** | `renderHistoryAsText`, `summarizeHistory` — LLM call + history replacement |
| `packages/cli/test/summarize-history.test.ts` | **Create** | Unit tests for both exports |
| `packages/cli/src/session/context-compact.ts` | **Modify** | Add `SummarizationConfig` type + `summarizeAndCompactHistory` async wrapper |
| `packages/cli/test/context-compact.test.ts` | **Create** | Tests for `summarizeAndCompactHistory` threshold logic |
| `packages/cli/src/config.ts` | **Modify** | Add `summarization` to `RawConfigSchema` and `InariConfig` |
| `packages/cli/src/agent/loop.ts` | **Modify** | Add `summarization` to `AgentTurnOptions`; replace sync compact call with async wrapper |

---

### Task 1: `summarize-history.ts` — render + summarize

**Files:**
- Create: `packages/cli/src/session/summarize-history.ts`
- Create: `packages/cli/test/summarize-history.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/cli/test/summarize-history.test.ts
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
    expect(result).not.toContainEqual(u("turn1"));
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @inaricode/cli test -- test/summarize-history.test.ts
```

Expected: `Cannot find module '../src/session/summarize-history.js'`

- [ ] **Step 3: Create `summarize-history.ts`**

```typescript
// packages/cli/src/session/summarize-history.ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @inaricode/cli test -- test/summarize-history.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/session/summarize-history.ts packages/cli/test/summarize-history.test.ts
git commit -m "feat(session): add LLM-driven history summarization module"
```

---

### Task 2: `context-compact.ts` — async summarization wrapper

**Files:**
- Modify: `packages/cli/src/session/context-compact.ts`
- Create: `packages/cli/test/context-compact.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/cli/test/context-compact.test.ts
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

function makeProvider(reply = "summary text"): { provider: LLMProvider; calls: number } {
  let calls = 0;
  const provider: LLMProvider = {
    async complete() {
      calls++;
      return { stopReason: "end_turn", blocks: [{ type: "text", text: reply }] };
    },
  };
  return { provider, calls: 0, get callCount() { return calls; } } as unknown as {
    provider: LLMProvider;
    calls: number;
  };
}

// Simpler tracking provider
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
  threshold: 1_000, // trigger on tiny history
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
    const h = bigHistory(10); // ~100k chars, well above threshold 1_000
    const result = await summarizeAndCompactHistory(h, provider, ENABLED_LOW);
    expect(callCount()).toBe(1);
    expect(result[0]).toEqual({
      kind: "user_text",
      text: expect.stringContaining("[Session context summary:"),
    });
  });

  it("still returns a compacted history after summarization", async () => {
    const { provider } = trackingProvider("summary of old stuff");
    const h = bigHistory(20); // large, needs both summarization and compaction
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
    expect(total).toBeLessThanOrEqual(50_000 * 1.1); // allow 10% slack for compaction
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @inaricode/cli test -- test/context-compact.test.ts
```

Expected: `SummarizationConfig` and `summarizeAndCompactHistory` not exported.

- [ ] **Step 3: Add exports to `context-compact.ts`**

Open `packages/cli/src/session/context-compact.ts` and add at the top (after existing imports):

```typescript
import { summarizeHistory } from "./summarize-history.js";
import type { LLMProvider } from "../llm/types.js";

export type SummarizationConfig = {
  enabled: boolean;
  /** Char count threshold above which summarization fires (default: 120_000) */
  threshold: number;
  /** Recent user-led turns to keep unsummarized (default: 4) */
  keepRecentTurns: number;
};
```

Then add this function **after** the existing `compactHistory` function:

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @inaricode/cli test -- test/context-compact.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
yarn workspace @inaricode/cli test
```

Expected: all existing + new tests pass, zero failures.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/session/context-compact.ts packages/cli/test/context-compact.test.ts
git commit -m "feat(session): add summarizeAndCompactHistory with threshold guard"
```

---

### Task 3: Config schema — `summarization` key

**Files:**
- Modify: `packages/cli/src/config.ts:113-196` (RawConfigSchema) and `:203-229` (InariConfig)

- [ ] **Step 1: Write the failing test**

```typescript
// Add to packages/cli/test/config-keys.test.ts (inside the existing describe block):

it("loads summarization config with defaults", async () => {
  const dir = mkdtempSync(join(tmpdir(), "inari-sum-"));
  try {
    writeFileSync(
      join(dir, "inaricode.yaml"),
      `provider: anthropic
summarization:
  enabled: true
  threshold: 90000
  keepRecentTurns: 3
`,
      "utf8",
    );
    const cfg = await loadConfig(dir);
    expect(cfg.summarization).toEqual({
      enabled: true,
      threshold: 90000,
      keepRecentTurns: 3,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("summarization defaults to disabled when omitted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "inari-sum2-"));
  try {
    writeFileSync(
      join(dir, "inaricode.yaml"),
      `provider: anthropic\n`,
      "utf8",
    );
    const cfg = await loadConfig(dir);
    expect(cfg.summarization.enabled).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @inaricode/cli test -- test/config-keys.test.ts
```

Expected: `cfg.summarization` is `undefined` → test fails.

- [ ] **Step 3: Add summarization to `RawConfigSchema`**

In `packages/cli/src/config.ts`, inside the `z.object({…})` in `RawConfigSchema`, add after the `plugins` block (around line 178):

```typescript
    /** LLM-driven history summarization (replaces old turns before lossy compact). */
    summarization: z
      .object({
        enabled: z.boolean().optional().default(false),
        /** Char count above which summarization fires (default 120_000). */
        threshold: z.number().int().positive().optional().default(120_000),
        /** Recent user-led turns to keep unsummarized (default 4). */
        keepRecentTurns: z.number().int().min(1).max(20).optional().default(4),
      })
      .optional(),
```

- [ ] **Step 4: Add `summarization` field to `InariConfig`**

In `packages/cli/src/config.ts`, inside the `InariConfig` type (around line 203), add after `chatTheme`:

```typescript
  summarization: {
    enabled: boolean;
    threshold: number;
    keepRecentTurns: number;
  };
```

- [ ] **Step 5: Wire summarization into config normalization**

Find the function that builds an `InariConfig` from the parsed schema (search for `maxHistoryItems: c.maxHistoryItems`). Add:

```typescript
    summarization: {
      enabled: c.summarization?.enabled ?? false,
      threshold: c.summarization?.threshold ?? 120_000,
      keepRecentTurns: c.summarization?.keepRecentTurns ?? 4,
    },
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
yarn workspace @inaricode/cli test -- test/config-keys.test.ts
```

Expected: all tests pass including the two new ones.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/test/config-keys.test.ts
git commit -m "feat(config): add summarization config key with enabled/threshold/keepRecentTurns"
```

---

### Task 4: Wire `summarizeAndCompactHistory` into `loop.ts`

**Files:**
- Modify: `packages/cli/src/agent/loop.ts`

- [ ] **Step 1: Add `summarization` to `AgentTurnOptions`**

In `packages/cli/src/agent/loop.ts`, find `AgentTurnOptions` (around line 12–30). Add a field:

```typescript
  /** LLM-driven context summarization config (from InariConfig). */
  summarization: {
    enabled: boolean;
    threshold: number;
    keepRecentTurns: number;
  };
```

- [ ] **Step 2: Add the import**

At the top of `loop.ts`, replace:

```typescript
import { compactHistory } from "../session/context-compact.js";
```

with:

```typescript
import { compactHistory, summarizeAndCompactHistory } from "../session/context-compact.js";
```

- [ ] **Step 3: Replace the sync compact call with the async wrapper**

Find the line inside `runAgentTurn`:

```typescript
    history = compactHistory(history, { maxChars: 180_000 });
```

Replace it with:

```typescript
    history = await summarizeAndCompactHistory(history, opts.provider, opts.summarization, {
      maxChars: 180_000,
    });
```

- [ ] **Step 4: Pass `summarization` from `cli.ts` call sites**

Search `packages/cli/src/cli.ts` for calls to `runAgentTurn`. Each call must now include `summarization`. Pass it from the loaded config:

```typescript
summarization: config.summarization,
```

(`config` is the `InariConfig` returned by `loadConfig`.)

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
yarn build:cli
```

Expected: `Build succeeded` with zero errors.

- [ ] **Step 6: Run full test suite**

```bash
yarn workspace @inaricode/cli test
```

Expected: all tests pass.

- [ ] **Step 7: Smoke test with the CLI**

```bash
yarn cli doctor
```

Expected: `engine ipc: ok` — no regressions in startup.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/agent/loop.ts packages/cli/src/cli.ts
git commit -m "feat(agent): wire summarizeAndCompactHistory into agent turn loop"
```

---

### Task 5: `/compact summary` slash command

**Files:**
- Modify: `packages/cli/src/ui/chat-slash.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/cli/test/` a new file `slash-compact.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { AgentHistoryItem } from "../src/llm/types.js";
import { handleChatSlashInput } from "../src/ui/chat-slash.js";
import type { LLMProvider } from "../src/llm/types.js";

// Minimal ctx factory (fills required fields with no-ops)
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
      persistHistory: async () => {},
      write: async (s: string) => { written.push(s); },
      persistEmpty: async () => {},
      provider,
      summarization: { enabled: true, threshold: 0, keepRecentTurns: 1 },
    },
    written,
    getHistory: () => current,
  };
}

function mockProvider(reply: string): LLMProvider {
  return {
    async complete() {
      return { stopReason: "end_turn", blocks: [{ type: "text", text: reply }] };
    },
  };
}

function u(t: string): AgentHistoryItem { return { kind: "user_text", text: t }; }
function a(t: string): AgentHistoryItem {
  return { kind: "assistant", blocks: [{ type: "text", text: t }] };
}

describe("/compact summary", () => {
  it("replaces history with summarized version and writes confirmation", async () => {
    const history = [u("q1"), a("a1"), u("q2"), a("a2"), u("q3"), a("a3")];
    const { ctx, written, getHistory } = makeCtx(
      "/compact summary",
      history,
      mockProvider("Summary of the session."),
    );
    const action = await handleChatSlashInput(ctx);
    expect(action.kind).toBe("again");
    expect(written.some((s) => s.includes("summarized"))).toBe(true);
    expect(getHistory().some(
      (h) => h.kind === "user_text" && h.text.includes("[Session context summary:"),
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @inaricode/cli test -- test/slash-compact.test.ts
```

Expected: `handleChatSlashInput` doesn't handle `compact summary` → action is not `"again"` or test fails on written content.

- [ ] **Step 3: Add `provider` + `summarization` to `SlashCtx`**

In `packages/cli/src/ui/chat-slash.ts`, add to `SlashCtx`:

```typescript
  provider: LLMProvider;
  summarization: { enabled: boolean; threshold: number; keepRecentTurns: number };
```

Add the import at the top:

```typescript
import type { LLMProvider } from "../llm/types.js";
import { summarizeHistory } from "../session/summarize-history.js";
```

- [ ] **Step 4: Handle `/compact summary` inside `handleChatSlashInput`**

Find the `/compact` handler block in `chat-slash.ts`. After the existing `/compact [n]` branch, add:

```typescript
  if (cmd === "compact") {
    const arg = raw.split(/\s+/)[1]?.toLowerCase() ?? "";

    if (arg === "summary") {
      const history = ctx.getHistory();
      const summarized = await summarizeHistory(history, {
        provider: ctx.provider,
        keepRecentTurns: ctx.summarization.keepRecentTurns,
      });
      ctx.setHistory(summarized);
      await ctx.persistHistory(summarized);
      await ctx.write(
        `${tr(ctx.locale, "slashCompactSummarized" as MessageKey) ?? "History summarized via LLM."}\n`,
      );
      return { kind: "again" };
    }

    // existing numeric /compact [n] logic follows …
  }
```

> Note: if `"slashCompactSummarized"` is not yet a key in `packages/cli/src/i18n/strings.ts`, use the literal string `"History summarized via LLM."` directly and add the i18n key in a follow-up.

- [ ] **Step 5: Pass `provider` + `summarization` from chat REPL and TUI call sites**

In `chat-repl.ts` and `chat-tui.tsx`, where `handleChatSlashInput` is called, add:

```typescript
provider: config.provider, // the resolved LLMProvider
summarization: config.summarization,
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
yarn workspace @inaricode/cli test -- test/slash-compact.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Run full suite + build**

```bash
yarn verify
```

Expected: lint + build + test all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/ui/chat-slash.ts packages/cli/src/ui/chat-repl.ts packages/cli/src/ui/chat-tui.tsx packages/cli/test/slash-compact.test.ts
git commit -m "feat(ui): add /compact summary slash command for LLM-driven context reduction"
```

---

## Self-Review

### Spec coverage

| Roadmap item | Task |
|---|---|
| Summarization beyond `/compact [n]` (lossy) | Tasks 1–4 (LLM summary in agent loop) |
| Token/cost hints | **Not in scope** — separate plan |
| `/compact` slash command improvement | Task 5 |

### Placeholder scan

No TBDs or "add appropriate handling" phrases present.

### Type consistency

- `SummarizationConfig` defined once in `context-compact.ts`, imported in `loop.ts` via the existing import.
- `SummarizeOptions` in `summarize-history.ts` uses `keepRecentTurns` consistently across all tasks.
- `AgentTurnOptions.summarization` shape matches `InariConfig.summarization` shape (same three fields).

---
