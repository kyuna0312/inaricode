# Agent CLI architecture & supply-chain notes

## Scope and ethics

- **[kyuna0312/claude-code](https://github.com/kyuna0312/claude-code)** is described by its maintainer as an **educational / research** archive documenting an agentic CLI stack and related **build-artifact exposure** topics. The upstream product code it discusses remains **Anthropic**’s property.
- **InariCode must not copy or paste** source from that repository (or any similar snapshot) into this codebase. Use it only for **process** and **taxonomy** insight, then implement features here **cleanly** (your own types, prompts, and control flow).

## Supply chain: source maps and published bundles

Public discussion (summarized in the linked archive README) highlighted risks when **source maps** or build output **expose** full source trees or predictable URLs. Lessons that apply to **any** JS/TS CLI or app:

1. **Inspect what you ship** — Before publishing, run **`npm pack`** / **`yarn pack`** on **`@inaricode/cli`** and review the tarball. Our **`package.json` `files`** field is limited to **`dist/`** and **`assets/`** (no `src/`), which reduces accidental leakage of raw TypeScript.
2. **Dev-tooling CVEs** — Vite had a **path-traversal** issue involving optimized-deps **`.map`** handling ([GHSA-4w7w-66w2-5vf9](https://github.com/vitejs/vite/security/advisories/GHSA-4w7w-66w2-5vf9)). This repo pins a **patched Vite** via Vitest / resolutions (see root **`package.json`**).
3. **Maps in `dist/`** — We currently emit **`.js.map`** for the CLI to aid debugging. That is a trade-off: smaller attack surface for **logic secrecy** favors turning maps off for **release** builds only; we have not switched **`sourceMap`** off in **`tsconfig.json`** yet. Revisit when you optimize for **publish** vs **debuggability**.

## Architecture taxonomy (conceptual map)

The archive README outlines a **large** TypeScript + Ink CLI: central **tool registry**, **slash commands**, **doctor**, **skills**, **tasks**, **MCP**, etc. Below is a **high-level** mapping to **InariCode** today (and where gaps are intentional backlog).

| Concept (typical agent CLI) | InariCode today | Notes / backlog |
|----------------------------|-----------------|-----------------|
| Tool registry + Zod (or similar) | `packages/cli/src/llm/inari-tools.ts`, engine tools via Rust IPC | Extend with more tools per **`docs/plan/inari-code-plan.md`**. |
| Slash commands | `/help`, `/clear`, **`/compact [n]`** / `/trim`, `/exit` (+ locale aliases) | **Token/cost** hints, richer meta-commands → **`docs/plan/TASKS.md`**. |
| `doctor` | `inari doctor` | Includes engine, sidecar, embeddings, **bundled skills examples path** in dev trees. |
| **Skills** (declarative packs) | `packages/skills/`, schema **`skill.manifest.schema.json`**, example **`minimal-review`** | Loader not wired yet (skills v1). |
| **Tasks** (templates) | `packages/tasks/templates/` | Automation / `inari tasks` TBD. |
| Subprocess / sandbox for FS & shell | Rust **`inaricode-engine`** (`packages/engine`) | Different stack than “all in Node”; same *idea* (policy + sandbox). |
| MCP / IDE bridge | Cursor **`inari cursor`**, **`docs/integrations/cursor.md`** | Broader MCP story on roadmap. |
| Lazy loading heavy deps | Some `import()` in CLI (e.g. media) | Audit for more lazy loads → **`footprint-ram`** in plan. |
| Permission / policy | Shell policy, confirm prompts, `readOnly` | Align with your product rules; no need to mirror other CLIs’ modes. |

## Features to consider (clean-room)

Inspired only by **product shape**, not by reusing anyone else’s implementation:

- **Context compaction** — **`/compact [n]`** in chat (REPL/TUI) keeps the last *n* **user-led** turns in **`--session`** JSON (lossy trim; no summarization yet). See **`packages/cli/src/session/compact-history.ts`**.
- **Rough token / cost visibility** — optional **`doctor`** or **`/cost`**-style output using local heuristics (no telemetry required).
- **Stricter publish profile** — `tsc` **`sourceMap: false`** for release tarballs only (separate **`tsconfig.publish.json`** if needed).

## Plan alignment

Roadmap **phases and backlog** are ordered using this taxonomy — see **[`docs/plan/inari-code-plan.md`](../plan/inari-code-plan.md) → *Research-informed sequencing***. Supply-chain and `/compact` items are **Phase 4–5**; declarative **skills loader** is **Phase 6**.

## See also

- **[`docs/plan/TASKS.md`](../plan/TASKS.md)** — actionable checklist.
- **[`docs/plan/inari-code-plan.md`](../plan/inari-code-plan.md)** — phases and non-goals.
- **[`packages/skills/README.md`](../../packages/skills/README.md)** — declarative skill direction.
