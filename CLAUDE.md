# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
yarn install

# Build (debug Rust engine + TypeScript CLI)
yarn build

# Build separately
yarn build:engine:dev        # Rust debug build only
yarn build:engine            # Rust release build (thin LTO, stripped)
yarn build:cli               # TypeScript only → packages/cli/dist/
yarn build:native            # Optional napi-rs bindings

# Run CLI from repo root (no global install needed)
yarn cli --help
yarn cli doctor

# Lint
yarn lint                    # turbo → @inaricode/cli ESLint

# Test
yarn workspace @inaricode/cli test          # Vitest (CLI only)
cargo test --manifest-path packages/engine/Cargo.toml  # Rust

# Run a single Vitest test file
yarn workspace @inaricode/cli test -- test/config-keys.test.ts

# Full pre-PR gate
yarn verify                  # lint + build + test (@inaricode/cli)
yarn verify:all              # + cargo test + npm pack --dry-run
```

## Architecture

**Monorepo** with Turborepo. Two Yarn workspaces:
- `packages/cli` — TypeScript `inari` binary (Node ≥ 20, ES modules)
- `packages/engine-native` — optional napi-rs bindings

Non-workspace packages (not in Yarn graph):
- `packages/engine/` — Rust `inaricode-engine` binary (JSON-line IPC)
- `packages/sidecar/` — Python BM25 helper (`codebase_search`)
- `packages/tasks/` — YAML task templates
- `packages/skills/` — declarative skill packs

### CLI internals (`packages/cli/src/`)

| Directory | Role |
|-----------|------|
| `cli.ts` | Commander entry point; all subcommands registered here |
| `config.ts` + `config-paths.ts` | Cosmiconfig loader; `inaricode.yaml` wins over `.cjs` |
| `llm/` | Provider adapters: `anthropic.ts` (Anthropic SDK), `openai-compatible.ts` (OpenAI SDK used for all other providers), `create-provider.ts` factory, `types.ts` interface |
| `agent/` | `loop.ts` — agentic tool-call loop; `engine-run.ts` — dispatches tool calls to the Rust engine; `system-prompt.ts`; semantic search helpers |
| `tools/` | Tool schema definitions exposed to the LLM and to MCP (`inari-tools.ts`) |
| `engine/client.ts` | IPC client — subprocess or napi-rs native (controlled by `INARI_ENGINE_IPC`) |
| `ui/` | Ink components: `chat-tui.tsx` (full TUI), `chat-repl.ts` (plain REPL), `chat-chrome.ts` (shared chrome), `chat-slash.ts` (slash command handling) |
| `session/` | Session persistence (load/save/compact) |
| `providers/` | `inari providers list/show` data |
| `cursor-api/` | Cursor Cloud Agents API client (`CURSOR_API_KEY`) |
| `skills/` | Skill pack loader and validator |
| `policy/` | Shell command allow/deny policy |
| `i18n/` | English + Mongolian strings (`INARI_LANG` / `locale` config) |
| `fuzzy/` | Fuzzy file picker (builtin or fzf) |
| `mcp/` | Stdio MCP server |
| `observability/` | `INARI_LOG=json` structured logging |

### Data flow

1. `cli.ts` parses args → loads config (`config.ts`, cosmiconfig) → selects provider
2. `llm/create-provider.ts` returns an `AnthropicProvider` or `OpenAICompatibleProvider`
3. `agent/loop.ts` drives the multi-turn tool-call loop
4. Tools call `engine/client.ts` → JSON-line IPC to the `inaricode-engine` Rust binary (or native binding)
5. UI renders via Ink (`ui/chat-tui.tsx`) or plain readline (`ui/chat-repl.ts`)

### Config resolution order

`INARI_PROFILE` env → `inaricode.<profile>.yaml` → `inaricode.yaml` → `inaricode.config.cjs/.mjs/.js` → `.inaricoderc.*`

API keys: `keys.<provider>` in YAML, or env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `INARI_PROVIDER`, `INARI_MODEL`, `INARI_BASE_URL`).

## Naming & style (`packages/cli`)

- **Files/folders:** `kebab-case`; `.tsx` only for JSX files
- **Functions:** `camelCase`; React components `PascalCase`
- **Types/interfaces/classes:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE` for true constants; `camelCase` otherwise; Zod schemas use `PascalCase` + `Schema` suffix
- **ES imports:** always `.js` extension (Node ESM resolution)
- On `catch` re-throws, set `error.cause` when the caught value is an `Error`
- Avoid non-null assertions (`!`); prefer `?.` / `??` and type narrowing
- Unused parameters: prefix with `_`

## Rust engine

- Source: `packages/engine/` (separate Cargo workspace)
- IPC: JSON-line protocol over subprocess stdin/stdout, or via napi-rs (`packages/engine-native`)
- Override binary path: `INARI_ENGINE_PATH`; force subprocess mode: `INARI_ENGINE_IPC=subprocess`
- Run `cargo fmt` and `cargo clippy` before touching Rust code

## Key env vars

| Var | Purpose |
|-----|---------|
| `INARI_PROVIDER` / `INARI_MODEL` | Runtime provider/model override |
| `INARI_BASE_URL` | Custom OpenAI-compat base URL |
| `INARI_ENGINE_PATH` | Path to `inaricode-engine` binary |
| `INARI_ENGINE_IPC` | `subprocess` or `native` |
| `INARI_LOG=json` | Structured JSON log lines on stderr |
| `INARI_PLAIN=1` | Disable ANSI in chat output |
| `INARI_LANG` | `en` or `mn` (overrides `locale` config) |
| `CURSOR_API_KEY` | Cursor Cloud Agents API |

## Important constraints

- Do **not** copy code from `kyuna0312/claude-code` or other external agent CLIs into this repo — architecture lessons only
- Do **not** commit `tsc` output under `packages/cli/test/`; compiled output lives in `dist/`
- Lint has `--max-warnings 0`; keep ESLint clean
- `yarn test` (Vitest) does not run `tsc` first; build separately if type errors need catching
