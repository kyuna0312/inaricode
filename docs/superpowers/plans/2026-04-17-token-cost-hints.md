# Token / Cost Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show live estimated token-usage and cost hints in both the REPL chrome line and a `/tokens` slash command, using a local `chars / 4` heuristic with no extra dependencies.

**Architecture:** Two new pure utility modules (`token-estimate.ts`, `token-pricing.ts`) feed a `TokenHintState` object into updated chrome rendering in `chat-chrome.ts`; the REPL prints one hint line after each turn; the TUI shows a persistent footer; `/tokens` slash command prints a detailed breakdown on demand.

**Tech Stack:** TypeScript (strict ESM), Vitest, existing Ink + ANSI palette from `chat-chrome.ts`

---

## File Structure

| Path | Action | Responsibility |
|------|--------|---------------|
| `packages/cli/src/utils/token-estimate.ts` | **Create** | `estimateTokens`, `estimateHistoryTokens`, `formatTokenCount` |
| `packages/cli/src/utils/token-pricing.ts` | **Create** | Bundled pricing/context-window tables, `resolvePricing`, `resolveContextWindow`, `estimateCost` |
| `packages/cli/test/token-estimate.test.ts` | **Create** | Unit tests for estimation + formatting |
| `packages/cli/test/token-pricing.test.ts` | **Create** | Unit tests for pattern matching + cost calculation |
| `packages/cli/src/config.ts` | **Modify** | Add `tokenHints` to `RawConfigSchema` and `InariConfig` |
| `packages/cli/test/config-keys.test.ts` | **Modify** | Add `tokenHints` config tests |
| `packages/cli/src/ui/chat-chrome.ts` | **Modify** | Add `TokenHintState`, `renderTokenHintLine`, `computeTokenHintLine` |
| `packages/cli/src/ui/chat-repl.ts` | **Modify** | Print hint line after each turn |
| `packages/cli/src/ui/chat-tui.tsx` | **Modify** | Add `tokenHint` state + footer Text |
| `packages/cli/src/ui/chat-slash.ts` | **Modify** | Add `model` + `tokenHintsConfig` to `SlashCtx`; handle `/tokens` |
| `packages/cli/test/slash-tokens.test.ts` | **Create** | Unit tests for `/tokens` output |
| `packages/cli/src/i18n/strings.ts` | **Modify** | Add `/tokens` entry to help text |

---

### Task 1: `token-estimate.ts` — estimation + formatting

**Files:**
- Create: `packages/cli/src/utils/token-estimate.ts`
- Create: `packages/cli/test/token-estimate.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/cli/test/token-estimate.test.ts
import { describe, expect, it } from "vitest";
import {
  estimateTokens,
  estimateHistoryTokens,
  formatTokenCount,
} from "../src/utils/token-estimate.js";
import type { AgentHistoryItem } from "../src/llm/types.js";

function u(t: string): AgentHistoryItem { return { kind: "user_text", text: t }; }
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
    expect(estimateTokens("abcd")).toBe(1);     // 4/4 = 1
    expect(estimateTokens("abcde")).toBe(2);    // 5/4 = 1.25 → ceil = 2
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
    expect(formatTokenCount(1250)).toBe("1.3k");   // rounds
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
    expect(result.input).toBe(2);  // user + tool
    expect(result.output).toBe(1);
  });

  it("segments into turns correctly", () => {
    const h: AgentHistoryItem[] = [
      u("aaaa"), a("bbbb"),
      u("cccc"), a("dddd"),
    ];
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
          { type: "tool_use", id: "t1", name: "read_file", input: { path: "x" } },
        ],
      },
    ];
    const result = estimateHistoryTokens(h);
    expect(result.output).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/token-estimate.test.ts
```

Expected: `Cannot find module '../src/utils/token-estimate.js'`

- [ ] **Step 3: Create `token-estimate.ts`**

```typescript
// packages/cli/src/utils/token-estimate.ts
import type { AgentHistoryItem } from "../llm/types.js";
import { segmentHistoryByUserTurns } from "../session/compact-history.js";

export type TurnTokens = {
  turn: number;
  input: number;
  output: number;
};

export type HistoryTokens = {
  input: number;
  output: number;
  total: number;
  byTurn: TurnTokens[];
};

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export function formatTokenCount(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1_000;
    const rounded = Math.round(k * 10) / 10;
    return rounded >= 100 ? `${Math.round(rounded)}k` : `${rounded}k`.replace(/\.0k$/, "k");
  }
  const m = Math.round((n / 1_000_000) * 10) / 10;
  return `${m}M`.replace(/\.0M$/, "M");
}

export function estimateHistoryTokens(history: AgentHistoryItem[]): HistoryTokens {
  let input = 0;
  let output = 0;
  const byTurn: TurnTokens[] = [];

  const segments = segmentHistoryByUserTurns(history);
  for (let i = 0; i < segments.length; i++) {
    let turnInput = 0;
    let turnOutput = 0;
    for (const item of segments[i]!) {
      if (item.kind === "user_text") {
        turnInput += estimateTokens(item.text);
      } else if (item.kind === "assistant") {
        for (const b of item.blocks) {
          if (b.type === "text") {
            turnOutput += estimateTokens(b.text);
          } else {
            turnOutput += estimateTokens(JSON.stringify(b.input));
          }
        }
      } else {
        for (const o of item.outputs) {
          turnInput += estimateTokens(o.content);
        }
      }
    }
    input += turnInput;
    output += turnOutput;
    byTurn.push({ turn: i + 1, input: turnInput, output: turnOutput });
  }

  return { input, output, total: input + output, byTurn };
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/token-estimate.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/utils/token-estimate.ts packages/cli/test/token-estimate.test.ts
git commit -m "feat(utils): add token estimation and formatting utilities"
```

---

### Task 2: `token-pricing.ts` — pricing + context window

**Files:**
- Create: `packages/cli/src/utils/token-pricing.ts`
- Create: `packages/cli/test/token-pricing.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/cli/test/token-pricing.test.ts
import { describe, expect, it } from "vitest";
import {
  resolvePricing,
  resolveContextWindow,
  estimateCost,
  type PricingEntry,
} from "../src/utils/token-pricing.js";

describe("resolvePricing", () => {
  it("returns null for unknown model with no overrides", () => {
    expect(resolvePricing("my-unknown-model", {})).toBeNull();
  });

  it("matches claude-sonnet-4 by substring", () => {
    const p = resolvePricing("claude-sonnet-4-20250514", {});
    expect(p).not.toBeNull();
    expect(p!.inputPerMToken).toBe(3.0);
    expect(p!.outputPerMToken).toBe(15.0);
  });

  it("prefers longer match: gpt-4o-mini over gpt-4o", () => {
    const p = resolvePricing("gpt-4o-mini", {});
    expect(p!.inputPerMToken).toBe(0.15);
  });

  it("user override takes priority over defaults", () => {
    const overrides: Record<string, PricingEntry> = {
      "claude-sonnet-4": { inputPerMToken: 1.0, outputPerMToken: 2.0 },
    };
    const p = resolvePricing("claude-sonnet-4-20250514", overrides);
    expect(p!.inputPerMToken).toBe(1.0);
  });

  it("user override longest-match wins over shorter user override", () => {
    const overrides: Record<string, PricingEntry> = {
      claude: { inputPerMToken: 9.9, outputPerMToken: 9.9 },
      "claude-sonnet-4": { inputPerMToken: 1.0, outputPerMToken: 2.0 },
    };
    const p = resolvePricing("claude-sonnet-4-20250514", overrides);
    expect(p!.inputPerMToken).toBe(1.0);
  });
});

describe("resolveContextWindow", () => {
  it("returns 128_000 for unknown model", () => {
    expect(resolveContextWindow("my-unknown-model", {})).toBe(128_000);
  });

  it("matches claude to 200_000", () => {
    expect(resolveContextWindow("claude-sonnet-4", {})).toBe(200_000);
  });

  it("user override wins", () => {
    expect(resolveContextWindow("my-model", { "my-model": 32_000 })).toBe(32_000);
  });
});

describe("estimateCost", () => {
  it("returns null when pricing is null", () => {
    expect(estimateCost(1000, 500, null)).toBeNull();
  });

  it("computes cost correctly", () => {
    // 1M input tokens at $3/M = $3.00, 1M output at $15/M = $15.00
    const pricing: PricingEntry = { inputPerMToken: 3.0, outputPerMToken: 15.0 };
    expect(estimateCost(1_000_000, 1_000_000, pricing)).toBeCloseTo(18.0);
  });

  it("returns 0 for zero tokens", () => {
    const pricing: PricingEntry = { inputPerMToken: 3.0, outputPerMToken: 15.0 };
    expect(estimateCost(0, 0, pricing)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/token-pricing.test.ts
```

Expected: `Cannot find module '../src/utils/token-pricing.js'`

- [ ] **Step 3: Create `token-pricing.ts`**

```typescript
// packages/cli/src/utils/token-pricing.ts

export type PricingEntry = {
  inputPerMToken: number;
  outputPerMToken: number;
};

// Ordered list — longer patterns must come before shorter ones that are substrings.
// resolvePricing does longest-match, but consistent ordering prevents surprises.
const DEFAULT_PRICING_TABLE: [string, PricingEntry][] = [
  ["claude-opus-4", { inputPerMToken: 15.0, outputPerMToken: 75.0 }],
  ["claude-sonnet-4", { inputPerMToken: 3.0, outputPerMToken: 15.0 }],
  ["claude-haiku-4", { inputPerMToken: 0.8, outputPerMToken: 4.0 }],
  ["gpt-4o-mini", { inputPerMToken: 0.15, outputPerMToken: 0.6 }],
  ["gpt-4o", { inputPerMToken: 2.5, outputPerMToken: 10.0 }],
  ["gemini-2.0-flash", { inputPerMToken: 0.1, outputPerMToken: 0.4 }],
];

const DEFAULT_CONTEXT_WINDOW_TABLE: [string, number][] = [
  ["claude", 200_000],
  ["gpt-4o", 128_000],
  ["gemini", 1_000_000],
];

const FALLBACK_CONTEXT_WINDOW = 128_000;

/** Longest substring match: pick entry whose key is the longest substring of `model`. */
function longestSubstringMatch<T>(
  model: string,
  table: [string, T][],
): T | null {
  const lower = model.toLowerCase();
  let best: T | null = null;
  let bestLen = -1;
  for (const [pattern, value] of table) {
    if (lower.includes(pattern.toLowerCase()) && pattern.length > bestLen) {
      best = value;
      bestLen = pattern.length;
    }
  }
  return best;
}

/**
 * Resolve pricing for `model`. User overrides checked first (also longest-match).
 * Returns null if no entry found — cost should be shown as `n/a`.
 */
export function resolvePricing(
  model: string,
  userOverrides: Record<string, PricingEntry>,
): PricingEntry | null {
  const overrideEntries = Object.entries(userOverrides) as [string, PricingEntry][];
  if (overrideEntries.length > 0) {
    const match = longestSubstringMatch(model, overrideEntries);
    if (match) return match;
  }
  return longestSubstringMatch(model, DEFAULT_PRICING_TABLE);
}

/**
 * Resolve context window size for `model`. Always returns a number (fallback: 128_000).
 */
export function resolveContextWindow(
  model: string,
  userOverrides: Record<string, number>,
): number {
  const overrideEntries = Object.entries(userOverrides) as [string, number][];
  if (overrideEntries.length > 0) {
    const match = longestSubstringMatch(model, overrideEntries);
    if (match !== null) return match;
  }
  return longestSubstringMatch(model, DEFAULT_CONTEXT_WINDOW_TABLE) ?? FALLBACK_CONTEXT_WINDOW;
}

/**
 * Estimate cost in USD. Returns null when pricing is null (no entry for model).
 */
export function estimateCost(
  input: number,
  output: number,
  pricing: PricingEntry | null,
): number | null {
  if (!pricing) return null;
  return (input * pricing.inputPerMToken + output * pricing.outputPerMToken) / 1_000_000;
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/token-pricing.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/utils/token-pricing.ts packages/cli/test/token-pricing.test.ts
git commit -m "feat(utils): add token pricing tables and context window resolution"
```

---

### Task 3: Config — `tokenHints` key

**Files:**
- Modify: `packages/cli/src/config.ts`
- Modify: `packages/cli/test/config-keys.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the existing `describe("config keys (inaricode.yaml)", ...)` block in `packages/cli/test/config-keys.test.ts`:

```typescript
  it("loads tokenHints with explicit values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-th-"));
    try {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
      writeFileSync(
        join(dir, "inaricode.yaml"),
        `provider: anthropic
tokenHints:
  enabled: false
  pricing:
    my-model:
      inputPerMToken: 1.0
      outputPerMToken: 5.0
  contextWindow:
    my-model: 32000
`,
        "utf8",
      );
      const cfg = await loadConfig(dir);
      expect(cfg.tokenHints.enabled).toBe(false);
      expect(cfg.tokenHints.pricing["my-model"]).toEqual({
        inputPerMToken: 1.0,
        outputPerMToken: 5.0,
      });
      expect(cfg.tokenHints.contextWindow["my-model"]).toBe(32000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tokenHints defaults to enabled with empty override maps", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-th2-"));
    try {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
      writeFileSync(join(dir, "inaricode.yaml"), `provider: anthropic\n`, "utf8");
      const cfg = await loadConfig(dir);
      expect(cfg.tokenHints.enabled).toBe(true);
      expect(cfg.tokenHints.pricing).toEqual({});
      expect(cfg.tokenHints.contextWindow).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run to confirm failure**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/config-keys.test.ts
```

Expected: 2 new tests fail — `cfg.tokenHints` is undefined.

- [ ] **Step 3: Add `tokenHints` to `RawConfigSchema` in `config.ts`**

In `packages/cli/src/config.ts`, inside the `z.object({…})` in `RawConfigSchema`, add after the `summarization` block:

```typescript
    /** Token/cost hints in chat chrome and /tokens command. */
    tokenHints: z
      .object({
        enabled: z.boolean().optional().default(true),
        pricing: z
          .record(
            z.string(),
            z.object({
              inputPerMToken: z.number().nonnegative(),
              outputPerMToken: z.number().nonnegative(),
            }),
          )
          .optional()
          .default({}),
        contextWindow: z.record(z.string(), z.number().int().positive()).optional().default({}),
      })
      .optional(),
```

- [ ] **Step 4: Add `tokenHints` to `InariConfig` type**

In `packages/cli/src/config.ts`, inside the `InariConfig` type, add after `summarization`:

```typescript
  tokenHints: {
    enabled: boolean;
    pricing: Record<string, { inputPerMToken: number; outputPerMToken: number }>;
    contextWindow: Record<string, number>;
  };
```

- [ ] **Step 5: Wire into both normalization return sites**

Search for the two objects returned by `resolveConfigFromRaw` (both contain `summarization: {…}`). Add after each `summarization` block:

```typescript
      tokenHints: {
        enabled: c.tokenHints?.enabled ?? true,
        pricing: c.tokenHints?.pricing ?? {},
        contextWindow: c.tokenHints?.contextWindow ?? {},
      },
```

- [ ] **Step 6: Run to confirm pass**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/config-keys.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/test/config-keys.test.ts
git commit -m "feat(config): add tokenHints config key with enabled/pricing/contextWindow"
```

---

### Task 4: Chrome rendering + REPL wiring

**Files:**
- Modify: `packages/cli/src/ui/chat-chrome.ts`
- Modify: `packages/cli/src/ui/chat-repl.ts`

No new test file — chrome rendering is validated manually. The REPL wiring produces no unit-testable side-effect beyond what config tests cover.

- [ ] **Step 1: Add imports to `chat-chrome.ts`**

At the top of `packages/cli/src/ui/chat-chrome.ts`, add after the existing imports:

```typescript
import type { AgentHistoryItem } from "../llm/types.js";
import { estimateHistoryTokens, formatTokenCount, type HistoryTokens } from "../utils/token-estimate.js";
import { resolvePricing, resolveContextWindow, estimateCost, type PricingEntry } from "../utils/token-pricing.js";
```

- [ ] **Step 2: Add `TokenHintState` + `renderTokenHintLine` to `chat-chrome.ts`**

Append at the end of `packages/cli/src/ui/chat-chrome.ts`:

```typescript
export type TokenHintState = {
  tokens: HistoryTokens;
  cost: number | null;
  contextWindow: number;
};

/** Render the single-line token hint for REPL output. Returns an ANSI-colored string. */
export function renderTokenHintLine(
  state: TokenHintState,
  plain: boolean,
): string {
  const { tokens, cost, contextWindow } = state;
  const pct = Math.min(100, Math.round((tokens.total / contextWindow) * 100));
  const filled = Math.round(pct / 10);

  const bar = plain
    ? `[${pct}%]`
    : `${"▓".repeat(filled)}${"░".repeat(10 - filled)}  ${pct}%`;

  const totalFmt = formatTokenCount(tokens.total);
  const windowFmt = formatTokenCount(contextWindow);
  const costStr = cost !== null ? `  ·  $${cost.toFixed(3)}` : "";

  const line = `~ ${totalFmt} / ${windowFmt} tokens${costStr}  ${bar}`;

  if (plain || !ansiBase()) return line;

  const color =
    pct >= 95 ? "\x1b[31m" : pct >= 80 ? "\x1b[33m" : "\x1b[2m";
  return `${color}${line}\x1b[0m`;
}

/**
 * Compute token hint from history + config and render it.
 * Wraps computation in try/catch — must never crash the agent loop.
 * Returns null on any error or when tokenHints is disabled.
 */
export function computeTokenHintLine(
  history: AgentHistoryItem[],
  model: string,
  tokenHintsConfig: {
    enabled: boolean;
    pricing: Record<string, PricingEntry>;
    contextWindow: Record<string, number>;
  },
  plain: boolean,
): string | null {
  if (!tokenHintsConfig.enabled) return null;
  try {
    const tokens = estimateHistoryTokens(history);
    const pricing = resolvePricing(model, tokenHintsConfig.pricing);
    const cost = estimateCost(tokens.input, tokens.output, pricing);
    const contextWindow = resolveContextWindow(model, tokenHintsConfig.contextWindow);
    return renderTokenHintLine({ tokens, cost, contextWindow }, plain);
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Wire hint into `chat-repl.ts`**

In `packages/cli/src/ui/chat-repl.ts`, add `computeTokenHintLine` to the import from `./chat-chrome.js`:

```typescript
import {
  computeTokenHintLine,
  formatReplSessionWelcome,
  replAssistantLead,
  replPrompt,
  replTurnSeparator,
  replUserBlock,
  useChatAnsi,
} from "./chat-chrome.js";
```

Then, after `history = next;` (around line 179), add the hint output before `replTurnSeparator`:

```typescript
      history = next;
      if (useStream) {
        output.write("\n");
      } else {
        output.write(`${replAssistantLead(plain, cfg.chatTheme)}${assistantText}\n`);
      }
      const hint = computeTokenHintLine(history, cfg.model, cfg.tokenHints, plain);
      if (hint) output.write(`${hint}\n`);
      output.write(replTurnSeparator(plain, cfg.chatTheme));
```

- [ ] **Step 4: TypeScript check**

```bash
node_modules/.bin/tsc -p packages/cli/tsconfig.json --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Run full suite**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/ui/chat-chrome.ts packages/cli/src/ui/chat-repl.ts
git commit -m "feat(ui): add token hint chrome line to REPL"
```

---

### Task 5: TUI footer

**Files:**
- Modify: `packages/cli/src/ui/chat-tui.tsx`

- [ ] **Step 1: Add `tokenHint` state**

In `packages/cli/src/ui/chat-tui.tsx`, add `computeTokenHintLine` to the import from `./chat-chrome.js`:

```typescript
import { buildTuiChromeLines, computeTokenHintLine, tuiAccentColor } from "./chat-chrome.js";
```

In `ChatTuiInner`, add state after the existing `useState` declarations (around line 98):

```typescript
  const [tokenHint, setTokenHint] = useState<string>("");
```

- [ ] **Step 2: Update hint after each turn**

In `ChatTuiInner`, after `setHistory(next);` (around line 197), add:

```typescript
        setHistory(next);
        const hint = computeTokenHintLine(next, props.cfg.model, props.cfg.tokenHints, plain);
        setTokenHint(hint ?? "");
        await persist(next);
```

Also add `props.cfg.model` and `props.cfg.tokenHints` to the `useCallback` dependency array (around line 208–232):

```typescript
      props.cfg.model,
      props.cfg.tokenHints,
```

- [ ] **Step 3: Render footer in the main return block**

In `ChatTuiInner`'s main `return` (around line 299), add the hint line between the transcript box and the input/busy line:

```typescript
  return (
    <Box flexDirection="column">
      {chromePanel}
      <Box marginBottom={1} flexDirection="column">
        <Text dimColor>{transcript}</Text>
        {streaming ? (
          <Box flexDirection="column">
            <Text dimColor>assistant</Text>
            <Text>{streaming}</Text>
          </Box>
        ) : null}
      </Box>
      {tokenHint ? <Text dimColor>{tokenHint}</Text> : null}
      {busy ? (
        plain ? (
          <Text dimColor>{tr(loc, "tuiBusy")}</Text>
        ) : (
          <Text color={accent}>{tr(loc, "tuiBusy")}</Text>
        )
      ) : (
        <Box>
          <Text color={plain ? undefined : "gray"}>{plain ? "> " : "› "}</Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={(value) => {
              void onSubmit(value);
            }}
          />
        </Box>
      )}
    </Box>
  );
```

- [ ] **Step 4: TypeScript check**

```bash
node_modules/.bin/tsc -p packages/cli/tsconfig.json --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Run full suite**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/ui/chat-tui.tsx
git commit -m "feat(ui): add persistent token hint footer to TUI"
```

---

### Task 6: `/tokens` slash command

**Files:**
- Modify: `packages/cli/src/ui/chat-slash.ts`
- Modify: `packages/cli/src/ui/chat-repl.ts`
- Modify: `packages/cli/src/ui/chat-tui.tsx`
- Modify: `packages/cli/src/i18n/strings.ts`
- Create: `packages/cli/test/slash-tokens.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/cli/test/slash-tokens.test.ts
import { describe, expect, it } from "vitest";
import { handleChatSlashInput } from "../src/ui/chat-slash.js";
import type { AgentHistoryItem, LLMProvider } from "../src/llm/types.js";

function u(t: string): AgentHistoryItem { return { kind: "user_text", text: t }; }
function a(t: string): AgentHistoryItem {
  return { kind: "assistant", blocks: [{ type: "text", text: t }] };
}

function mockProvider(): LLMProvider {
  return {
    async complete() {
      return { stopReason: "end_turn", blocks: [{ type: "text", text: "ok" }] };
    },
  };
}

function makeCtx(
  trimmed: string,
  history: AgentHistoryItem[],
  model = "claude-sonnet-4",
  tokenHintsEnabled = true,
) {
  const written: string[] = [];
  return {
    ctx: {
      locale: "en" as const,
      cwd: "/tmp",
      workspaceRoot: "/tmp",
      trimmed,
      getHistory: () => history,
      setHistory: () => {},
      persistHistory: async () => {},
      write: async (s: string) => { written.push(s); },
      persistEmpty: async () => {},
      provider: mockProvider(),
      summarization: { enabled: false, threshold: 120_000, keepRecentTurns: 4 },
      model,
      tokenHintsConfig: {
        enabled: tokenHintsEnabled,
        pricing: {},
        contextWindow: {},
      },
    },
    written,
  };
}

describe("/tokens", () => {
  it("returns kind: again", async () => {
    const { ctx } = makeCtx("/tokens", [u("hello"), a("world")]);
    const result = await handleChatSlashInput(ctx);
    expect(result.kind).toBe("again");
  });

  it("outputs session totals header", async () => {
    const { ctx, written } = makeCtx("/tokens", [u("hello"), a("world")]);
    await handleChatSlashInput(ctx);
    const output = written.join("");
    expect(output).toContain("Session tokens (estimated)");
    expect(output).toContain("User + tool input");
    expect(output).toContain("Assistant output");
    expect(output).toContain("Total");
  });

  it("outputs context window line", async () => {
    const { ctx, written } = makeCtx("/tokens", [u("hello"), a("world")]);
    await handleChatSlashInput(ctx);
    const output = written.join("");
    expect(output).toContain("Context window:");
    expect(output).toContain("200k");  // claude default
  });

  it("outputs per-turn table header", async () => {
    const history: AgentHistoryItem[] = [u("q1"), a("a1"), u("q2"), a("a2")];
    const { ctx, written } = makeCtx("/tokens", history);
    await handleChatSlashInput(ctx);
    const output = written.join("");
    expect(output).toContain("Turn");
    expect(output).toContain("Input");
    expect(output).toContain("Output");
    expect(output).toContain("Cost");
  });

  it("shows n/a cost for unknown model", async () => {
    const history: AgentHistoryItem[] = [u("hello"), a("world")];
    const { ctx, written } = makeCtx("/tokens", history, "my-unknown-model-xyz");
    await handleChatSlashInput(ctx);
    const output = written.join("");
    expect(output).toContain("n/a");
  });

  it("works even when tokenHints.enabled is false", async () => {
    const { ctx, written } = makeCtx("/tokens", [u("hello"), a("world")], "claude-sonnet-4", false);
    const result = await handleChatSlashInput(ctx);
    expect(result.kind).toBe("again");
    expect(written.join("")).toContain("Session tokens");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/slash-tokens.test.ts
```

Expected: tests fail — `SlashCtx` missing `model` + `tokenHintsConfig`, `/tokens` not handled.

- [ ] **Step 3: Add imports + fields to `SlashCtx` in `chat-slash.ts`**

In `packages/cli/src/ui/chat-slash.ts`, add to the imports at the top:

```typescript
import { estimateHistoryTokens, formatTokenCount } from "../utils/token-estimate.js";
import { resolvePricing, resolveContextWindow, estimateCost, type PricingEntry } from "../utils/token-pricing.js";
```

Add fields to `SlashCtx` (after `summarization`):

```typescript
  /** Active model name — used for /tokens cost calculation. */
  model: string;
  tokenHintsConfig: {
    enabled: boolean;
    pricing: Record<string, PricingEntry>;
    contextWindow: Record<string, number>;
  };
```

- [ ] **Step 4: Add `/tokens` handler in `handleChatSlashInput`**

In `packages/cli/src/ui/chat-slash.ts`, add before the `slashUnknown` fallback at the bottom:

```typescript
  if (cmd === "tokens") {
    const history = ctx.getHistory();
    const tokens = estimateHistoryTokens(history);
    const pricing = resolvePricing(ctx.model, ctx.tokenHintsConfig.pricing);
    const cost = estimateCost(tokens.input, tokens.output, pricing);
    const contextWindow = resolveContextWindow(ctx.model, ctx.tokenHintsConfig.contextWindow);
    const pct = Math.min(100, Math.round((tokens.total / contextWindow) * 100));

    const fmtCost = (c: number | null) => (c !== null ? `$${c.toFixed(3)}` : "n/a");
    const inputCost = pricing
      ? fmtCost((tokens.input * pricing.inputPerMToken) / 1_000_000)
      : "n/a";
    const outputCost = pricing
      ? fmtCost((tokens.output * pricing.outputPerMToken) / 1_000_000)
      : "n/a";

    let report = `Session tokens (estimated)\n`;
    report += `  User + tool input : ~${formatTokenCount(tokens.input).padStart(5)}  ${inputCost}\n`;
    report += `  Assistant output  : ~${formatTokenCount(tokens.output).padStart(5)}  ${outputCost}\n`;
    report += `  ${"─".repeat(33)}\n`;
    report += `  Total             : ~${formatTokenCount(tokens.total).padStart(5)}  ${fmtCost(cost)}\n`;
    report += `\n`;
    report += `Context window: ~${formatTokenCount(tokens.total)} / ${formatTokenCount(contextWindow)}  (${pct}%)\n`;

    const recentTurns = tokens.byTurn.slice(-10);
    if (recentTurns.length > 0) {
      report += `\nTurn  Input   Output   Cost\n`;
      for (const t of recentTurns) {
        const turnCost = pricing
          ? fmtCost(
              (t.input * pricing.inputPerMToken + t.output * pricing.outputPerMToken) /
                1_000_000,
            )
          : "n/a";
        report += `${String(t.turn).padStart(4)}  ~${formatTokenCount(t.input).padStart(5)}  ~${formatTokenCount(t.output).padStart(5)}  ${turnCost}\n`;
      }
    }

    await ctx.write(report);
    return { kind: "again" };
  }
```

- [ ] **Step 5: Add `/tokens` to help text**

In `packages/cli/src/i18n/strings.ts`, update both EN and MN `slashHelp` strings to include `/tokens`:

EN (around line 69):
```typescript
  slashHelp:
    "Commands:  /help  /pick  /clear  /compact [n]  /compact summary  /tokens  /exit  (aliases: /h /?  ·  /cls  ·  /trim)\nAlso: exit  quit  гарах",
```

MN (around line 192):
```typescript
  slashHelp:
    "Тушаалууд:  /help  /pick  /clear  /compact [n]  /compact summary  /tokens  /exit  (хочилсон нэрс: /h /?  ·  /cls  ·  /trim)\nМөн: exit  quit  гарах",
```

- [ ] **Step 6: Pass `model` + `tokenHintsConfig` from `chat-repl.ts`**

In `packages/cli/src/ui/chat-repl.ts`, add to the `handleChatSlashInput` call (after `summarization: cfg.summarization`):

```typescript
        model: cfg.model,
        tokenHintsConfig: cfg.tokenHints,
```

- [ ] **Step 7: Pass `model` + `tokenHintsConfig` from `chat-tui.tsx`**

In `packages/cli/src/ui/chat-tui.tsx`, add to the `handleChatSlashInput` call (after `summarization: props.cfg.summarization`):

```typescript
        model: props.cfg.model,
        tokenHintsConfig: props.cfg.tokenHints,
```

Also add `props.cfg.tokenHints` to the `useCallback` dependency array.

- [ ] **Step 8: Run tests to confirm pass**

```bash
/home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run packages/cli/test/slash-tokens.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 9: TypeScript check + full suite**

```bash
node_modules/.bin/tsc -p packages/cli/tsconfig.json --noEmit && /home/kyuna/Desktop/inaricode/node_modules/.bin/vitest run
```

Expected: zero TS errors, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/cli/src/ui/chat-slash.ts packages/cli/src/ui/chat-repl.ts packages/cli/src/ui/chat-tui.tsx packages/cli/src/i18n/strings.ts packages/cli/test/slash-tokens.test.ts
git commit -m "feat(ui): add /tokens slash command with session breakdown and per-turn table"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| `token-estimate.ts` with `estimateTokens`, `estimateHistoryTokens`, `formatTokenCount` | Task 1 |
| `token-pricing.ts` with bundled tables, `resolvePricing`, `resolveContextWindow`, `estimateCost` | Task 2 |
| `tokenHints` config key (`enabled`, `pricing`, `contextWindow`) | Task 3 |
| REPL chrome line after each turn | Task 4 |
| TUI persistent footer | Task 5 |
| `/tokens` command — role breakdown + per-turn table | Task 6 |
| `tokenHints.enabled: false` hides chrome but `/tokens` still works | Task 4 (`computeTokenHintLine` returns null) + Task 6 (reads history directly) |
| Color thresholds (≥80% yellow, ≥95% red) | Task 4 (`renderTokenHintLine`) |
| Plain mode bar replacement | Task 4 (`renderTokenHintLine`) |
| Error handling (never crash loop) | Task 4 (`computeTokenHintLine` try/catch) |

### Placeholder scan

No TBDs or vague steps. All code is complete.

### Type consistency

- `PricingEntry` defined once in `token-pricing.ts`, imported in `chat-chrome.ts` and `chat-slash.ts`
- `TokenHintState` defined once in `chat-chrome.ts`
- `HistoryTokens` / `TurnTokens` defined once in `token-estimate.ts`
- `tokenHintsConfig` shape in `SlashCtx` matches `InariConfig.tokenHints` shape exactly
