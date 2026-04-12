---
name: InariCode CLI Assistant
overview: "TS CLI + agent loop + Rust engine; EN/MN UI; pick + completions; future OSS: installable skills/plugins/themes, tmux/vim UX, lower RAM, optional mic→text into chat field, packaging + tree-sitter."
todos:
  - id: scaffold
    content: "Monorepo (Yarn workspaces), packages/cli + packages/engine"
    status: completed
  - id: rust-engine
    content: "inaricode-engine IPC — path sandbox, read/write/list, grep, search_replace, run_cmd"
    status: completed
  - id: phase1-mvp
    content: "Phase 1 — REPL chat, multi-provider LLM, agent loop, engine tools, Zod, confirms, shell policy"
    status: completed
  - id: phase2-core
    content: "Phase 2 — streaming; --session JSON; apply_patch; config shell + readOnly; history trim"
    status: completed
  - id: phase2-native-ui
    content: "Phase 2b — napi-rs engine; Ink TUI"
    status: completed
  - id: phase3-intelligence
    content: "Phase 3 — .inariignore (grep); tool redaction; Python sidecar codebase_search (BM25)"
    status: completed
  - id: phase3plus-semantic
    content: "Phase 3+ — semantic_codebase_search (embeddings API + cache); symbol_outline; globby index"
    status: completed
  - id: i18n-en-mn
    content: "CLI/TUI/REPL strings — English + Mongolian (locale, INARI_LANG)"
    status: completed
  - id: ux-pick-completion
    content: "inari pick (fuzzy + fzf); shell completion zsh/fish/bash; chat slash + --plain + git branch chrome"
    status: completed
  - id: cpp-hotpath
    content: "P3 gated — mmap/cxx only if P1 profiling + Rust-first steps fail (see plan: P3 decision gate)"
    status: pending
  - id: release-packaging
    content: "Phase 4 — npm/publish, prebuilt engine-native matrix, CI: tsc build + vitest + cargo test"
    status: pending
  - id: quality-ast-summaries
    content: "tree-sitter outlines; long-thread summarization; stronger multi-file patch UX"
    status: pending
  - id: extensibility-skills-plugins
    content: "Installable AI skills (prompt+tool packs); plugin API; themes; newbie presets + docs"
    status: pending
  - id: ux-power-modes
    content: "Vim-like TUI keymaps; tmux-friendly workflow doc / optional pane layout; scroll buffer"
    status: pending
  - id: footprint-ram
    content: "RAM budget: trim history, lazy loads, optional low-memory mode; measure + document"
    status: pending
  - id: voice-input-stt
    content: "Optional OSS: microphone speech-to-text → insert full transcript into REPL/TUI input (privacy-first, opt-in)"
    status: pending
source: "Canonical repo plan; original Cursor id inaricode_cli_assistant_8a5f93f5"
---

# InariCode — plan

## Where we are

The **core product loop is done**: chat (REPL + TUI), multi-provider LLM with streaming, agent loop with confirmations, Rust engine IPC + native binding, session files, semantic search (remote embeddings + cache), BM25 sidecar, redaction, `.inariignore`, **English / Mongolian** UI, **`inari pick`** (fuzzy / fzf), **shell completions**, and **chat UX** (slash commands, `--plain`, git branch in header). What remains is mostly **polish, accuracy, performance, and distribution** — not greenfield architecture.

| Area | Status | Where |
|------|--------|--------|
| CLI | `init`, `doctor`, `chat` (`--tui`) | [`packages/cli/src/cli.ts`](../../packages/cli/src/cli.ts) |
| i18n | `en` / `mn` (`locale`, `INARI_LANG`) | [`packages/cli/src/i18n/`](../../packages/cli/src/i18n/) |
| Engine | JSON-line IPC + napi `ipcRequest` | [`packages/engine`](../../packages/engine), [`packages/engine-native`](../../packages/engine-native) |
| LLM | Anthropic + OpenAI-compatible | [`packages/cli/src/config.ts`](../../packages/cli/src/config.ts), [`packages/cli/src/llm/`](../../packages/cli/src/llm/) |
| Agent | Turn loop, tool → engine / sidecar | [`packages/cli/src/agent/loop.ts`](../../packages/cli/src/agent/loop.ts) |
| Session | JSON load/save (`--session`) | [`packages/cli/src/session/file-session.ts`](../../packages/cli/src/session/file-session.ts) |
| Sidecar | Python BM25 `codebase_search` (optional) | [`packages/sidecar/`](../../packages/sidecar/), [`packages/cli/src/sidecar/`](../../packages/cli/src/sidecar/) |
| Semantic | `/embeddings` + `.inaricode/semantic-cache-v1.json` | [`semantic-search.ts`](../../packages/cli/src/tools/semantic-search.ts), [`embeddings-api.ts`](../../packages/cli/src/tools/embeddings-api.ts) |
| Outline | `symbol_outline` (regex heuristics) | [`symbol-outline.ts`](../../packages/cli/src/tools/symbol-outline.ts) |
| Picker / UX | `inari pick`, `inari completion`, fuzzy [`fuzzy/match.ts`](../../packages/cli/src/fuzzy/match.ts) | [`packages/cli/src/pick/`](../../packages/cli/src/pick/), [`completion/render.ts`](../../packages/cli/src/completion/render.ts) |

**Largest gaps vs “best in class”:** **distribution** (easy install for newbies), **installable skills / plugins / themes** (ecosystem like shell dotfiles), **deeper zsh completions**, **power-user ergonomics** (**vim**/**tmux**-friendly flows), **RAM footprint** (long TUI sessions + Node), **tree-sitter** outlines, **long-context** summarization, optional **C++** mmap (only if profiling justifies it).

---

## How to improve this roadmap (meta)

Use the plan as a **decision log**, not a wishlist.

1. **Lead with outcomes** — e.g. “New contributor can run `inari doctor` successfully in under five minutes” beats “add more docs” without a test.
2. **Order by dependencies** — CI and a single documented **build matrix** unlock everything else; tree-sitter depends on agreeing on **per-language** scope.
3. **Time horizons** — tag items **now (0–4 weeks)**, **next (1–3 months)**, **later (quarter+)** so the table stays honest.
4. **Non-goals** — say what you will *not* do this year (see below); it prevents roadmap noise.
5. **Measurable “done”** — each backlog row should have a **verifiable** completion (test, command, or doc section).

---

## Goals

Ship a **local**, **engine-sandboxed** CLI comparable to other coding agents: multi-turn chat, edits with confirmations, shell under policy, codebase-aware tools — with disk/process work in **Rust**, not ad-hoc Node `fs` / `child_process`.

---

## Architecture

```mermaid
flowchart LR
  subgraph driver [packages_cli_TS]
    REPL[REPL_chat]
    TUI[TUI_Ink]
    Agent[Agent_loop]
    LLM[LLM_providers]
    Zod[Zod_tools]
    Emb[Embeddings_API]
  end
  subgraph engine [packages_engine_Rust]
    IPC[inaricode_engine_ipc]
    FS[Fs_grep_patch_shell]
  end
  subgraph optional [Optional_paths]
    Py[Python_sidecar_BM25]
    Cpp[C++_mmap_hotpath]
  end
  REPL --> Agent
  TUI --> Agent
  Agent --> LLM
  Agent --> Zod
  Zod --> IPC
  Zod -.-> Emb
  IPC --> FS
  Agent -.-> Py
  FS -.-> Cpp
```

**One turn:** user message → LLM (tools) → TS validates → engine IPC (or sidecar/embeddings) → tool results → LLM until stop or step limit.

---

## Stack

| Layer | Choices |
|-------|---------|
| **TS** | Node 20+, strict TS, Commander, Zod, Vitest, cosmiconfig, Yarn workspaces, Ink + React (TUI) |
| **LLM** | `@anthropic-ai/sdk`; `openai` for Chat Completions + tools (OpenAI-compatible URLs) |
| **Rust** | clap, serde_json, ignore, regex, similar, diffy, tokio |

**Provider IDs** live in **`ProviderIdSchema`** in [`config.ts`](../../packages/cli/src/config.ts). **Engine:** JSON line in/out; same payload to **`ipcRequest`** in [`@inaricode/engine-native`](../../packages/engine-native). **`INARI_ENGINE_IPC=subprocess`** forces subprocess; default **`auto`** prefers native when `.node` loads.

**Grep / index:** `.gitignore` + **`.inariignore`**. **Sidecar:** JSON lines; `sidecar.enabled` + optional **`INARI_SIDECAR_CMD`**. **Semantic cache:** under **`.inaricode/`** (root `.gitignore`).

---

## Repo layout

```
inaricode/
  package.json
  packages/cli/src/     # cli, config, llm, agent, tools, media, pick, fuzzy, completion, ui, session, engine client, policy, i18n
  packages/engine/
  packages/engine-native/
  packages/sidecar/
  docs/plan/            # this file
```

---

## Product scope

| Theme | Implemented | Next (prioritized) |
|-------|-------------|---------------------|
| Chat / history | REPL, TUI, `--session`, `maxHistoryItems` | **Compaction / summarization** for long threads |
| Edits | read/write/list/grep/search_replace/**apply_patch** | **Multi-file patch UX**, clearer conflict reporting |
| Shell | `run_cmd` + policy + confirm | Hardening from real-world abuse patterns |
| Context | `--root`; grep + semantic honor ignore files | **tree-sitter** `symbol_outline` (scoped languages first) |
| LLM | Multi-provider (incl. **Hugging Face router**, **Google Gemini** OpenAI-compat), streaming, `--no-stream` | Retry/backoff policy; token budgeting (doc + optional flags) |
| Multimodal | `inari media image` (HF Inference text-to-image); `media video` = guidance only | Google **Imagen** / **Veo**-class APIs; HF video models — wire per vendor when stable |
| i18n | EN + MN across CLI surfaces | More strings as features land; contributor note in README |
| Install | From source (`yarn build`) | **npm/binary story**, **CI**, documented **platform matrix** |
| Picker / shell | `pick`, `completion`, `INARI_PICKER` | **Narrower default globs** in docs; **watch mode** pick; **zsh** deep completion |
| **Skills / plugins / themes** | — (not shipped) | **Installable packs** (prompt + tools + slash); **plugins** (hooks) with sandbox; **themes** (ANSI + Ink); **newbie** preset + guided init |
| **Power-user shells** | REPL readline; Ink TUI | **Vim-like** TUI keymaps; **tmux** layouts + docs; optional **`--stdio`** for scripting |
| **Memory (RAM)** | History trim; lazy imports | **Caps** on transcript/tool buffers; **`--low-memory`**; document typical RSS |

---

## Extensibility roadmap (skills · plugins · themes)

Target: **newcomers** get sensible defaults; **power users** customize without forking.

| Track | Direction | Notes |
|-------|-----------|--------|
| **Installable AI skills** | Folders or packages: **system prompt** snippets, **tool allowlists**, **slash commands** (`/review`, `/test`). | Start with **declarative** YAML/JSON + markdown, Zod-validated; **no arbitrary code** in v1. |
| **Plugins** | Later: allowlisted **JS hooks** or **WASM** at defined lifecycle points. | Default **off**; `plugins: { enabled, allowlist }`; security doc before any code execution. |
| **Themes** | `theme: 'dark' \| 'light' \| <path>` for REPL ANSI + Ink. | Ship **2–3** built-in; contrast notes for a11y. |
| **Newbie-friendly** | `inari init --template beginner`, **`inari onboard`**, richer **`/help`**, “first 5 minutes” in README. | Lowers setup anxiety (keys, engine, workspace). |

---

## Engineering optimizations (ongoing)

Low-risk improvements to keep doing as you touch code:

| Area | Idea |
|------|------|
| **CI** | **`yarn lint`** (ESLint + typescript-eslint) then **`yarn turbo run build test --filter=@inaricode/cli`**. Locally **`yarn verify`** = lint + build + Vitest. Cache: **`.turbo/`** (gitignored). |
| **Cold start** | Lazy `import()` for heavy paths (already used in places); avoid loading Ink until `chat --tui` / `pick`. |
| **Pick scale** | Cap candidate count (already ~25k); document **narrow `picker.defaultFileGlob`** for huge monorepos. |
| **Config** | Split optional **partial config** loaders (picker-only) vs full `loadConfig` to avoid API-key requirement for more commands. |
| **Rust** | `cargo clippy` in CI (optional job); keep **subprocess** IPC path tested (`INARI_ENGINE_IPC=subprocess`). |
| **RAM** | Profile **heap** on 30‑min TUI session; cap **in-memory history** + **streaming buffer**; clear **tool output** from UI buffer after round; optional **external pager** for huge tool results. |
| **Vim / tmux** | Document **`tmux new-session` + split** with `inari chat --tui` in one pane; optional **`$INARICODE_VIM_KEYS=1`** for TUI bindings (j/k, Ctrl‑U/D). |

---

## Ideas & experiments (not committed)

Exploratory — promote to **Prioritized backlog** only when you have capacity and a “done when”.

| Idea | Why it might matter |
|------|---------------------|
| **`/pick` in chat** | Insert `inari pick` result into the REPL transcript (paste path into next user message). |
| **MCP server** | Expose tools to **Cursor / Claude Desktop** via Model Context Protocol (thin wrapper over engine IPC). |
| **Plugin hooks** | User script after each tool round (audit log, custom policy) — high security review cost. |
| **Local embeddings** | Optional Ollama / small model for `semantic_codebase_search` without cloud API. |
| **Structured logging** | `INARI_LOG=json` for CI / debugging agent loops without scraping ANSI. |
| **TUI transcript scroll** | Ink viewport or pager for long sessions (today transcript grows unbounded in memory). |
| **Workspace profiles** | Multiple named configs (e.g. `inaricode.work.json`) for different roots/providers. |
| **Diff preview** | Before `apply_patch`, fish-style inline diff in confirm UI. |
| **Telemetry (opt-in)** | Anonymous crash/feature flags — only with explicit consent and privacy doc. |
| **Skill marketplace (later)** | Curated index (git URL or registry) — only after local skill format stabilizes. |
| **Headless daemon** | Long-running `inari serve` for multiple front-ends — large scope; overlaps MCP. |
| **Voice → chat input (mic)** | **Open-source goal:** user speaks; **full transcript** lands in the **CLI / TUI text field** (append or replace per setting). Needs **opt-in**, clear **privacy** story (local **Whisper**/Vosk vs OS **Web Speech** vs cloud API), push-to-talk or toggle, and **cross-platform** capture (PipeWire/Pulse, CoreAudio, WASAPI). |

---

## Security (baseline)

- Confirm **write_file**, **search_replace**, **run_terminal_cmd** unless `chat --yes`.
- Tool output **redaction** before the model (`packages/cli/src/tools/redact.ts`); extend patterns as you learn leaks.
- Engine enforces workspace path sandbox (no `..` in rel paths).

---

## Prioritized backlog

Rough order: each item unlocks or de-risks the next.

| Priority | Horizon | Item | Done when |
|----------|---------|------|-----------|
| **P0** | Now | **CI** — [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml): **`tsc` build** + Vitest + `cargo test` on push/PR to `main` | Green checks on `main` (enable Actions in repo settings if needed) |
| **P0** | Now | **Contributor quickstart** — exact Node/Yarn/Rust versions, `build:native` pitfalls | README + plan link; `inari doctor` succeeds on clean clone |
| **P1** | Next | **Release path** — `inari` on PATH via `npm link` or published package; engine env vars documented | Install section has two supported flows |
| **P1** | Next | **Zsh completion depth** — match fish richness (`inari chat` flags, `media image` opts) | `inari completion zsh` completes subcommands + key flags without hand-maintaining drift |
| **P1** | Next | **Profiling budget** — when to consider C++ (large-repo grep latency) | One doc section + optional benchmark script |
| **P2** | Later | **tree-sitter** for `symbol_outline` (start with TS/JS or Rust only) | Tests on sample repos; fallback to regex |
| **P2** | Later | **Thread summarization** — optional auto-compact over N turns | Config flag + deterministic behavior |
| **P2** | Later | **Skills v1** — declarative packs (prompt + tools + slash) + **2 themes** + **onboarding** doc | `inari doctor` lists skills; no arbitrary code in pack |
| **P2** | Later | **RAM / memory mode** — caps + measurement doc | README “typical usage” + `--low-memory` or config |
| **P3** | Optional | **Mmap fast path** via Rust + [`cxx`](https://github.com/dtolnay/cxx) (optional C++ core) | **Only** if all steps in [P3 decision gate](#p3-decision-gate-mmap-and-optional-cxx) pass |
| **P3** | Optional | **Plugins v0** — allowlisted local hooks | Threat model written; default off |
| **P3** | Optional | **Voice input (STT)** — mic → REPL/TUI line editor | **Opt-in**; doc lists data paths (local vs cloud); works on Linux + macOS + Windows baseline |

### P3 decision gate: mmap and optional cxx

This item exists so the roadmap remembers a **possible** speed path without committing to a second language stack.

**What it would target:** scan- and IO-heavy work inside **`inaricode-engine`** (primarily **grep / read paths** on very large trees or multi‑GB files), not the TypeScript driver or LLM I/O.

**Order of operations (do not skip):**

1. **P1 — Profiling budget** — Add a short doc (e.g. `docs/engine-profiling.md`) plus an optional reproducible benchmark (fixed corpus + query + `cargo run --release` or script). Capture **wall time** and, if possible, **where** time goes (`perf`, `cargo flamegraph`, etc.).
2. **Rust-first optimizations** — Before any C++, try cheaper changes in `packages/engine` (examples: **`memmap2`** for large-file reads, buffer sizing, avoiding extra copies, parallelism only where correctness and ignore semantics stay clear). Ripgrep-class performance is **not** required; only remove obvious bottlenecks.
3. **Gate — open a C++ path only if all are true:**
   - Profiling shows a **stable** hot slice (e.g. a large fraction of wall time in byte scanning / mmap’d IO) **after** the Rust steps above.
   - The gap matters for **real** usage (document the scenario — e.g. “monorepo grep over X M LOC”).
   - You accept **ongoing cost**: C++ toolchain in CI, `cxx` FFI boundary, security review for unsafe boundaries, and debugging complexity.

**Default outcome:** Close the profiling ticket with “Rust is enough” or “memmap2 / algorithm fix sufficient” and **leave P3 cancelled** until new evidence appears.

---

## Non-goals (near term)

- Replacing the Rust engine with Node for file/shell operations.
- Bundling local **sentence-transformers** (heavy deps); remote `/embeddings` remains the supported default unless you explicitly scope a “local embeddings” project.
- Full IDE / LSP integration (separate product surface).
- Supporting every LLM vendor without maintainer capacity — **document** how to use `custom` + `baseURL` instead.
- **C++ / `cxx`** without completing **P1 profiling** and **Rust-first** attempts — see [P3 decision gate](#p3-decision-gate-mmap-and-optional-cxx).

---

## Risks & dependencies

| Risk | Mitigation |
|------|------------|
| **engine-native** build friction on Windows / ARM | Document matrix; CI builds; optional subprocess-only path (`INARI_ENGINE_IPC=subprocess`) |
| **API cost / leakage** | Redaction + docs on env keys; never log full tool payloads in prod |
| **Scope creep** | Use **non-goals** and **P0/P1** table; defer tree-sitter until CI + install story is stable |
| **Second language (C++)** | Only after P3 gate; otherwise permanent complexity for marginal gain |

---

## Phased delivery (historical)

<details>
<summary>Earlier phase notes (0–3+) — expanded detail</summary>

### Phase 0 — Scaffold (done)

Yarn workspaces, `inaricode-engine` JSON IPC, `init` / `doctor`, Vitest smoke.

### Phase 1 — MVP (done)

`inari chat` REPL, Anthropic + OpenAI-compatible presets, agent loop, engine tools, confirms, shell policy.

### Phase 2 — Parity (done)

Streaming, `--session`, `maxHistoryItems`, `apply_patch`, shell config + `readOnly`, `--no-stream`, napi-rs, Ink TUI.

### Phase 3 — Intelligence (done)

`.inariignore` for grep, redaction, Python BM25 sidecar, `inari doctor` sidecar ping.

### Phase 3+ — Deep features (done / ongoing)

Semantic search + cache, `symbol_outline` heuristics; backlog: tree-sitter, summarization, C++.

### Cross-cutting (shipped; not repeated above)

These landed alongside Phase 2–3+ work and are **done** (see frontmatter todos): **English / Mongolian i18n**, **`inari pick`** (fuzzy + optional **fzf**) + **shell completions**, **`inari media`** (image / video guidance). They do not replace the phase labels above; they extend the product surface after the core agent loop.

</details>

---

## Roadmap snapshot

| Phase | State |
|-------|--------|
| 0 Scaffold | Done |
| 1 MVP agent | Done |
| 2 Parity (+ napi + TUI) | Done |
| 3 Intelligence (+ sidecar + redact) | Done |
| 3+ Semantic + outline | Shipped; **accuracy** = backlog |
| **4 Distribution & quality** | **Active** — install / npm story, contributor quickstart, platform matrix, CI (incl. **Turborepo** for TS tasks) |
| **5 Accuracy & long sessions** | **Planned** — **tree-sitter** outlines, **summarization**, stronger **multi-file patch** UX; **zsh** completion depth; **TUI scroll** / pager |
| **6 Ecosystem & onboarding** | **Planned** — **skills** v1, **themes**, newbie **onboarding**; **vim**/**tmux** docs + optional keymaps; **RAM** / low-memory mode |
| **7 Integrations & input** | **Ideas / later** — **MCP**, **`/pick` in chat**, **`INARI_LOG=json`**, **workspace profiles**, **voice (mic → STT → input)** |
| **8 Extensibility & research** | **Optional** — **plugins** v0, **skill marketplace**, **headless daemon**, **local embeddings**, opt-in **telemetry**; **C++ mmap** only via [P3 gate](#p3-decision-gate-mmap-and-optional-cxx) |

---

## Phased roadmap — improvements & new ideas (4+)

Each phase bundles **improvements** (polish, perf, docs) and **new ideas** from the [Ideas & experiments](#ideas--experiments-not-committed) table. Order reflects **dependencies** (e.g. skills format before marketplace; profiling before mmap).

### Phase 4 — Distribution & quality *(active target)*

**Goal:** A stranger can install, verify, and trust the project.

| Track | Improvements & deliverables |
|-------|----------------------------|
| **Release** | npm / binary publish path; prebuilt **engine-native** matrix; documented **platform matrix** |
| **Contributor** | README + plan quickstart; **`inari doctor`** green on clean clone; exact Node / Yarn / Rust versions |
| **Engineering** | **Partial config** loaders (keyless commands where safe); **pick** glob guidance for huge repos; optional **`cargo clippy`** in CI |
| **Process** | **P0/P1** backlog rows owned or dated; v1 launch notes: [`../v1-launch-and-social.md`](../v1-launch-and-social.md) |

### Phase 5 — Accuracy & long sessions

**Goal:** Smarter code context and sustainable long chats.

| Track | Improvements & deliverables |
|-------|----------------------------|
| **AST / outline** | **tree-sitter** `symbol_outline` (scoped languages first); keep regex fallback |
| **Sessions** | **Thread summarization** / compaction after N turns; config-driven, deterministic |
| **Edits** | Clearer **multi-file patch** flow and conflict reporting; **diff preview** in confirm UI (from Ideas) |
| **Shell UX** | **Zsh** completions on par with fish for flags / subcommands |
| **TUI** | **Transcript scroll** or external pager — bound memory vs unbounded Ink transcript (Ideas + [RAM](#engineering-optimizations-ongoing) row) |
| **Perf (non-C++)** | **Profiling budget** doc + optional benchmark; Rust-first grep/IO tweaks before any C++ |

### Phase 6 — Ecosystem & onboarding

**Goal:** Newbies feel welcome; power users can customize without forking.

| Track | Improvements & deliverables |
|-------|----------------------------|
| **Skills** | **Skills v1** — declarative packs (prompt + tool allowlist + slash); `inari doctor` lists packs; no arbitrary code in v1 |
| **Look & feel** | **Themes** (ANSI + Ink); 2–3 built-in + contrast notes |
| **Onboarding** | `inari init --template beginner`, richer **`/help`**, “first 5 minutes” doc |
| **Power UX** | **Vim-like** TUI keymaps (e.g. `$INARICODE_VIM_KEYS`); **tmux** layout cookbook |
| **Footprint** | **RAM** caps, **low-memory** mode, measured RSS — see ongoing [engineering](#engineering-optimizations-ongoing) table |

### Phase 7 — Integrations & input

**Goal:** Fit into external tools and alternative input paths.

| Track | Ideas → deliverables |
|-------|---------------------|
| **Interop** | **MCP server** — thin wrapper over engine IPC for Cursor / Claude Desktop |
| **Observability** | **`INARI_LOG=json`** for CI and agent-loop debugging (no ANSI scraping) |
| **Chat workflow** | **`/pick` in chat** — pipe `inari pick` result into the next user message |
| **Config** | **Workspace profiles** — multiple named configs / roots / providers |
| **Voice** | **Mic → STT → input** — full transcript into REPL/TUI field; opt-in; local vs cloud STT documented |

### Phase 8 — Extensibility & research *(optional / high cost)*

**Goal:** Deeper extension only after formats and threat models exist.

| Track | Ideas → deliverables |
|-------|---------------------|
| **Plugins** | **Plugins v0** — allowlisted hooks; **default off**; written threat model |
| **Distribution of skills** | **Skill marketplace** (git/registry) — **after** skills v1 stabilizes |
| **Architecture** | **Headless daemon** (`inari serve`) — multiple front-ends; overlaps MCP; large scope |
| **Local ML** | **Local embeddings** (e.g. Ollama) for semantic search — optional parallel to remote `/embeddings` |
| **Trust** | **Telemetry (opt-in)** — crashes / flags; consent + privacy doc |
| **Perf research** | **C++ / mmap** — **only** if [P3 decision gate](#p3-decision-gate-mmap-and-optional-cxx) passes |

### Ideas → phase (quick index)

| Idea (from [Ideas & experiments](#ideas--experiments-not-committed) table) | Phase |
|---------------------------------------------------------------|--------|
| `/pick` in chat | 7 |
| MCP server | 7 |
| Structured logging (`INARI_LOG=json`) | 7 |
| Workspace profiles | 7 |
| Voice → chat input | 7 |
| Plugin hooks (security-heavy) | 8 |
| Local embeddings | 8 |
| TUI transcript scroll | 5 |
| Diff preview | 5 |
| Telemetry (opt-in) | 8 |
| Skill marketplace | 8 |
| Headless daemon | 8 |
| mmap / cxx fast path | 8 (gated) |

---

## Success criteria

**Already met (MVP bar):** small coding task with engine-backed tools, confirmations for risky ops, bounded outputs, Zod validation, engine errors visible to the model.

**Next bar (“v1 credible”):**

- A new machine can follow **README + plan** and get a green **`inari doctor`** without maintainer hand-holding.
- **CI** protects `main` from regressions in CLI tests and Rust tests.
- Roadmap **P0/P1** rows have owners or dates (even rough) so progress is visible.

---

## Maintenance

When you ship a major feature, update in one pass:

1. This file — **Where we are** table + **Prioritized backlog** + **Roadmap snapshot** / **Phased roadmap (4+)** (mark phase progress or move items).
2. Root [`README.md`](../../README.md) — features / commands if user-facing.
3. [`docs/plan/README.md`](./README.md) — only if the entrypoint to the plan changes.
