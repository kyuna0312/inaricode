# Agent & contributor notes

Short rules aligned with common **Linux / OSS** CLI practice (predictable tooling, strict types, CI parity).

## Repository layout (where things live)

| Path | Purpose |
|------|---------|
| **`packages/cli/src/`** | CLI entry, commands, LLM, agent loop, tools, i18n, Ink UI — **`kebab-case`** files per ESLint. |
| **`packages/engine/`** | Rust **`inaricode-engine`** (`cargo build --manifest-path packages/engine/Cargo.toml`). |
| **`packages/engine-native/`** | napi-rs workspace package; optional native IPC. |
| **`packages/sidecar/`** | Python sidecar (not a Yarn workspace); BM25 **`codebase_search`**. |
| **`packages/tasks/`** | Task **templates** (`templates/*.yaml`) — not a workspace; see **[`packages/tasks/README.md`](packages/tasks/README.md)**. |
| **`packages/skills/`** | **Skill pack** examples for future declarative skills — **[`packages/skills/README.md`](packages/skills/README.md)**. |
| **`packages/README.md`** | Package index. |
| **`docs/plan/`** | **[`TASKS.md`](docs/plan/TASKS.md)** (checklist) + **[`inari-code-plan.md`](docs/plan/inari-code-plan.md)** (roadmap). |

Config: root **`eslint.config.mjs`**, **`turbo.json`**, **`package.json`** scripts. **`yarn lint`** runs **`turbo run lint`** for **`@inaricode/cli`** only.

## Third-party agent CLI archives

- **[`docs/research/architecture-and-supply-chain.md`](docs/research/architecture-and-supply-chain.md)** explains how we use external repos (e.g. **[kyuna0312/claude-code](https://github.com/kyuna0312/claude-code)**) **only** for architecture/supply-chain **lessons**, not as a code vendor.
- **Do not** paste snapshot or leaked upstream sources into InariCode; implement features **cleanly** with new code and our existing patterns (Zod, engine IPC, Ink).

## LLM providers (chat)

- **Config file:** Prefer **`inaricode.yaml`** (`keys:` per provider) or `inaricode.config.cjs` → `provider` + `model` (Anthropic, OpenAI, Kimi, Ollama, Groq, Gemini, HF router, `custom`, …). YAML is searched before `.cjs` when both exist.
- **Env (session override):** `INARI_PROVIDER`, `INARI_MODEL`, optional `INARI_BASE_URL` — applied after file config, before CLI flags.
- **CLI one-off:** `inari chat --provider ollama --model llama3.2`.
- **Catalog:** `inari providers list` / `inari providers show <id>` (includes **Cursor** cloud row; REPL chat uses `inari cursor`, not `provider: cursor`).

## Cursor IDE

- **`docs/integrations/cursor.md`** — local **`.cursor/`** (not in git); **`yarn cli cursor …`** with **`CURSOR_API_KEY`** for [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints).
- Optional rules: copy from **`docs/integrations/cursor-rules.example.md`** into your own **`.cursor/rules/*.mdc`**.

## Release version line

- **`packages/cli/package.json`**: `version` is **semver** (`major.minor.patch`). The **patch** is the third number and is shown in the CLI banner.
- **Flower codename**: optional top-level **`"inaricode": { "codename": "Sakura" }`**. If omitted, a flower is picked **deterministically** from `version` via `src/release-flowers.ts` (same semver → same flower).
- **`inari --version`** and chat headers use **`cliVersionLine()`**: `vX.Y.Z · patch N · FlowerName`.

## Naming (`packages/cli` TypeScript)

- **Folders:** **`kebab-case`** (e.g. `cursor-api/`, `sidecar/`, `llm/`). One idea per folder; keep names short and descriptive.
- **Files:** **`kebab-case`** before the extension (e.g. `chat-repl.ts`, `openai-compatible.ts`, `run-cursor-cli.ts`). Single-word names are fine when clear (`cli.ts`, `config.ts`). Use **`.tsx`** only when the file contains JSX.
- **Functions & methods:** **`camelCase`** (e.g. `loadConfig`, `resolveSidecarArgv`). **React components** exported as functions may use **`PascalCase`** (e.g. `PickTui`).
- **Types, interfaces, classes:** **`PascalCase`** (e.g. `InariConfig`, `AnthropicProvider`).
- **Module-scope `const` values:** **`camelCase`** for most; **`UPPER_SNAKE_CASE`** for true constants (e.g. `MUTATING_TOOL_NAMES`); **`PascalCase` + `Schema` / similar suffix** is fine for Zod schemas (e.g. `ProviderIdSchema`).
- ESLint enforces file names (**`unicorn/filename-case`**) and TypeScript naming (**`@typescript-eslint/naming-convention`**) where configured in root **`eslint.config.mjs`**.

## TypeScript (`packages/cli`)

- **`strict: true`** plus **`noImplicitReturns`**, **`noFallthroughCasesInSwitch`**, **`noUnusedLocals`**, **`noUnusedParameters`** — keep `tsc` clean; use a leading **`_`** on intentionally unused parameters.
- **`tsc`** uses **`incremental`** + **`.tsbuildinfo`** for faster rebuilds; the published CLI is **bin-only** (no **`declaration`** emit in **`dist/`**).
- **ES modules** only (`"type": "module"`, **`.js` extensions** in imports for Node resolution).
- Prefer **`const`**; avoid **non-null assertions (`!`)** unless unavoidable; prefer **`?.` / `??`** and narrow types.
- When rethrowing after **`catch`**, set **`error.cause`** when the caught value is an **`Error`** (see `sidecar/client.ts`, `embeddings-api.ts`).
- **React 17+ JSX**: do not import default **`React`** only for JSX; import named hooks only.

## Lint & verify

- Run **`yarn lint`** before pushing (**`turbo run lint`** → **`@inaricode/cli`**). **`yarn verify`** = **`turbo run lint build test`** (same filter). Use **`yarn verify:all`** to add **`cargo test`** for **`packages/engine`**. ESLint uses a **disk cache** under **`node_modules/.cache/eslint`**.
- **`yarn test`** / Turbo **`test`** does not run **`tsc`** first; Vitest compiles from source. **`turbo run build`** still runs **`^build`** so workspace deps (e.g. **`@inaricode/engine-native`**) build before the CLI.
- ESLint uses **`typescript-eslint`** with **`packages/cli/tsconfig.eslint.json`** (includes **`test/`** for typed rules without changing **`dist/`** layout).

## Repo hygiene

- **Unix line endings (LF)**; trim trailing whitespace; UTF-8.
- Do not commit **`tsc` output** under `packages/cli/test/` — emit stays in **`dist/`** (ignored patterns in root `.gitignore`).

## Rust engine

- Keep **`cargo fmt`** / **`cargo clippy`** in mind for `packages/engine` (optional CI job per plan).
- **`cargo build --release`** uses **thin LTO** + **`strip = true`** for a smaller **`inaricode-engine`** binary (debug builds unchanged).
