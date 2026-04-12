# Task board (working list)

Use this file for **concrete, checkable** work. The long-form roadmap lives in **[`inari-code-plan.md`](./inari-code-plan.md)** — especially **Research-informed sequencing** and **[`../research/architecture-and-supply-chain.md`](../research/architecture-and-supply-chain.md)** for *why* Phase **4** (distribution/supply chain) comes before **6** (skills ecosystem).

When you finish something here, update the plan’s **Where we are** / backlog and the root **README** in the same PR when it’s user-visible.

**Templates:** **[`packages/tasks/`](../packages/tasks/README.md)**, **[`packages/skills/`](../packages/skills/README.md)**. **Package index:** **[`packages/README.md`](../packages/README.md)**.

## Repo & tooling (maintenance)

- [ ] **`yarn verify`** green before push (Turbo lint + build + test for `@inaricode/cli`).
- [ ] **`yarn verify:all`** before releases or engine changes (adds **`cargo test`** + **`yarn pack:check`** — already covers tarball file list; no separate manual pack step needed unless debugging).
- [ ] After shipping, refresh **README** + plan **Where we are** if commands or layout changed.

## Now (0–4 weeks) — Phase 4 focus

Aligned with **research → supply chain + distribution** first.

- [x] **npm publish path** — GitHub Actions **[`.github/workflows/publish.yml`](../../.github/workflows/publish.yml)** (tag + **`workflow_dispatch`**); manual steps in **[`../publishing.md`](../publishing.md)**.
- [x] **Engine-native matrix** — **[`../engine-platform.md`](../engine-platform.md)** (targets, subprocess vs native, env vars).
- [x] **Contributor quickstart** — README **Contributor check (~5 minutes)** + link to engine doc.

## Next (1–3 months) — Phase 5–6

- [x] **tree-sitter / outlines (TS·JS·TSX·JSX)** — [`symbol-outline-ast.ts`](../../packages/cli/src/tools/symbol-outline-ast.ts); Rust/other grammars when **`tree-sitter`** peers align.
- [x] **Session hints in doctor** — **`maxHistoryItems`** / **`maxAgentSteps`** from config (no API keys).
- [x] **Zsh + bash completion depth** — [`completion/render.ts`](../../packages/cli/src/completion/render.ts); see tests.
- [x] **Profiling budget doc** — [`../engine-profiling.md`](../engine-profiling.md).
- [ ] **Summarization** — *beyond* **`/compact [n]`** (auto or slash-driven summary of dropped context); optional token/cost hints in chat (local heuristic, no telemetry).
- [ ] **Optional `tsconfig.publish.json`** — `sourceMap: false` for release tarballs only if you accept stack-trace trade-off ([research](../research/architecture-and-supply-chain.md)).
- [x] **Skills v1 loader** — Zod manifests, **`inari skills list`**, **`skills.packs`** in config, chat system prompt + tool allowlist + **`slash_hints`**; **`docs/skills.md`**.
- [x] **Onboarding slice** — **`inari init --template beginner`** + **`chatTheme`** (**default** / **soft** / **high_contrast**).
- [ ] **Installable themes (beyond chatTheme)** — Ink-wide palettes, user **`theme:`** files (**`extensibility-skills-plugins`**).

## Later (quarter+)

- [ ] **Vim-like TUI / tmux doc** (**`ux-power-modes`**).
- [ ] **RAM / lazy-load audit** — measure long TUI sessions; transcript bounds (**`footprint-ram`**).
- [ ] **MCP** — promote from plan *Ideas* when P1 install story is stable (research: IDE bridge row).
- [ ] **Optional STT** — mic → input (**`voice-input-stt`**).
- [ ] **P3 mmap / C++** — only if profiling gate passes (**`cpp-hotpath`**).

## Done recently (hint)

Prefer **git history** as source of truth; keep this section short.

- **`/compact`**, **`yarn pack:check`** + CI, **`prepublishOnly`**, YAML **`keys:`**, **`inari cursor`**, **`packages/skills`** schema + example, doctor line for bundled skills examples path.
- **`docs/engine-platform.md`**, **`docs/publishing.md`**, README contributor path + layout rows.
- **`publish.yml`** (npm on tag / dispatch), CI **clippy** + **`engine-native-linux`** napi smoke build.
- Phase **5** slice: **tree-sitter** outlines, **doctor** session line, **zsh/bash** completions, **`docs/engine-profiling.md`**.
- Phase **6** slice: **skills.packs**, **`inari skills list`**, **beginner** init + **`chatTheme`**, **`docs/skills.md`**.
