# Token / Cost Hints Design

**Date:** 2026-04-17
**Status:** Approved

## Goal

Show live token-usage and estimated cost hints in the chat interface — both as a persistent chrome line and via a `/tokens` slash command — using a local character heuristic (no extra API calls, no telemetry).

---

## Approach

Character-based token estimation: `tokens ≈ chars / 4`. Industry-standard approximation with ~10–15% error margin. All displayed numbers are prefixed with `~` to signal "estimated". Zero added dependencies, zero latency cost, works offline and for all providers.

---

## Architecture

### New files

| File | Responsibility |
|------|---------------|
| `packages/cli/src/utils/token-estimate.ts` | Pure token estimation functions |
| `packages/cli/src/utils/token-pricing.ts` | Bundled pricing + context-window tables, user-override resolution |

### Modified files

| File | Change |
|------|--------|
| `packages/cli/src/config.ts` | Add `tokenHints` to `RawConfigSchema` and `InariConfig` |
| `packages/cli/src/ui/chat-chrome.ts` | Append token hint line to REPL chrome |
| `packages/cli/src/ui/chat-tui.tsx` | Add persistent footer with token hint |
| `packages/cli/src/ui/chat-slash.ts` | Add `/tokens` command handler |
| `packages/cli/src/ui/chat-repl.ts` | Pass token state to chrome + slash |

---

## Token Estimation (`token-estimate.ts`)

```typescript
export type TurnTokens = {
  turn: number;       // 1-based index
  input: number;      // user_text + tool_outputs tokens
  output: number;     // assistant tokens
};

export type HistoryTokens = {
  input: number;
  output: number;
  total: number;
  byTurn: TurnTokens[];
};

export function estimateTokens(text: string): number;
// → Math.ceil(text.length / 4)

export function estimateHistoryTokens(history: AgentHistoryItem[]): HistoryTokens;
// Segments by user turn. user_text + tool_outputs = input. assistant = output.

export function formatTokenCount(n: number): string;
// → "320", "1.2k", "42k", "1.2M"
```

---

## Pricing + Context Window (`token-pricing.ts`)

### Bundled defaults

`DEFAULT_PRICING` — model substring → `{ inputPerMToken: number; outputPerMToken: number }`:

| Pattern | Input $/M | Output $/M |
|---------|-----------|------------|
| `claude-opus-4` | 15.00 | 75.00 |
| `claude-sonnet-4` | 3.00 | 15.00 |
| `claude-haiku-4` | 0.80 | 4.00 |
| `gpt-4o` | 2.50 | 10.00 |
| `gpt-4o-mini` | 0.15 | 0.60 |
| `gemini-2.0-flash` | 0.10 | 0.40 |
| `*` (fallback) | — | — (n/a) |

`DEFAULT_CONTEXT_WINDOW` — model substring → tokens:

| Pattern | Tokens |
|---------|--------|
| `claude` | 200000 |
| `gpt-4o` | 128000 |
| `gemini` | 1000000 |
| `*` (fallback) | 128000 |

### Resolution

`resolvePricing(model: string, userOverrides: Record<string, PricingEntry>): PricingEntry | null`
— longest substring match wins; user overrides checked first.

`resolveContextWindow(model: string, userOverrides: Record<string, number>): number`
— same matching strategy; user overrides checked first.

`estimateCost(input: number, output: number, pricing: PricingEntry | null): number | null`
— returns null when no pricing entry (cost shown as `n/a`).

---

## Config (`tokenHints` key)

### `inaricode.yaml`

```yaml
tokenHints:
  enabled: true                   # default: true; false hides all hints
  pricing:                        # override $/M tokens per model substring
    my-custom-model:
      inputPerMToken: 1.00
      outputPerMToken: 5.00
  contextWindow:                  # override context window in tokens
    my-custom-model: 32000
```

### `InariConfig`

```typescript
tokenHints: {
  enabled: boolean;
  pricing: Record<string, { inputPerMToken: number; outputPerMToken: number }>;
  contextWindow: Record<string, number>;
};
```

Defaults: `enabled: true`, empty override maps (bundled defaults apply).

---

## Chrome Display

### Format

```
~ 4.2k / 200k tokens · $0.013  ▓░░░░░░░░░  2%
```

- `~` prefix on all numbers signals estimation
- Bar: 10 `▓`/`░` characters; filled = `Math.round(pct / 10)` blocks
- Color thresholds (ANSI, skipped when `INARI_PLAIN=1`):
  - < 80% → default color
  - ≥ 80% → yellow
  - ≥ 95% → red
- `INARI_PLAIN=1`: bar replaced with `[2%]`
- Cost omitted (replaced with nothing) when model has no pricing entry
- `tokenHints.enabled: false` → chrome line not rendered; `/tokens` command still works

### Placement

- **REPL**: printed on its own line after each assistant response
- **TUI**: persistent footer line below the input box, updated after each turn via Ink state

---

## `/tokens` Slash Command

Output format (written to transcript / stdout):

```
Session tokens (estimated)
  User + tool input : ~12.4k  $0.037
  Assistant output  : ~ 3.1k  $0.047
  ─────────────────────────────────
  Total             : ~15.5k  $0.084

Context window: ~15.5k / 200k  (8%)

Turn  Input   Output   Cost
   1   ~320     ~180  $0.004
   2  ~1.2k     ~640  $0.012
   3   ~480     ~210  $0.006
```

- Capped at last 10 turns
- `Cost` column shows `n/a` when model has no pricing entry
- Works in both REPL and TUI (writes to transcript in TUI)
- Added to `/help` output

---

## Data Flow

```
AgentHistoryItem[] (after each turn)
  → estimateHistoryTokens()         # token-estimate.ts
  → resolvePricing(model, overrides) # token-pricing.ts
  → estimateCost(input, output)
  → TokenHintState { tokens, cost, pct }
  → chat-chrome.ts / chat-tui.tsx   # chrome bar
  → /tokens handler in chat-slash.ts # on-demand detail
```

`TokenHintState` is computed once per turn and passed as props/args — not stored in session files.

---

## Error Handling

- `estimateTokens` never throws — empty string returns 0
- `resolvePricing` returns `null` on no match — cost shown as `n/a`, not an error
- `resolveContextWindow` always returns a number (fallback: 128000) — bar always renders
- Hint computation failure must not crash the agent loop — wrap in try/catch in chrome render, fall back to hiding the line silently

---

## Testing

| File | What to test |
|------|-------------|
| `test/token-estimate.test.ts` | `estimateTokens`, `estimateHistoryTokens` (segmentation, input/output split), `formatTokenCount` edge cases |
| `test/token-pricing.test.ts` | Model pattern matching (longest match, user override priority), `estimateCost` (null pricing → null), context window resolution |
| `test/config-keys.test.ts` | `tokenHints` config loads; defaults apply when omitted |
| `test/slash-tokens.test.ts` | `/tokens` output format (role breakdown, per-turn table, n/a cost) |

Chrome visual output not unit-tested — validated manually with `yarn cli chat`.

---

## Non-Goals

- Exact token counts (tiktoken, API call) — approximation is intentional
- Persistent cost tracking across sessions — hints are per-session, ephemeral
- Telemetry or usage reporting — all local
- Token budget enforcement / hard limits — read-only hints only
