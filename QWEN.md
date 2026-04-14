# InariCode — Project Context

## Project Overview

**InariCode** is a local AI coding assistant CLI that provides multi-turn chat, tool use (read/write/grep/patch/shell), and a Rust engine for sandboxed filesystem and process work. It supports **Anthropic** and **OpenAI-compatible** APIs (Claude, ChatGPT, Hugging Face router, Google Gemini, Kimi, Qwen, Ollama, Groq, etc.).

The project is a **monorepo** managed with **Yarn workspaces** and **Turborepo**, containing:
- **TypeScript CLI** (`@inaricode/cli`) — Ink-based TUI, LLM drivers, agent loop, tools, i18n
- **Rust engine** (`inaricode-engine`) — JSON-line IPC binary for sandboxed fs/grep/patch/shell operations
- **Optional native bindings** (`@inaricode/engine-native`) — napi-rs multi-target bindings
- **Python sidecar** — Optional BM25 `codebase_search` helper
- **Declarative skill packs** — Future extensibility layer

**Current version:** `0.1.0` (codename: **Sakura**)

## Repository Layout

| Path | Purpose |
|------|---------|
| `packages/cli/` | TypeScript CLI (`inari` command) — source in `src/`, built output in `dist/` |
| `packages/engine/` | Rust `inaricode-engine` binary (Cargo crate, not a Yarn workspace) |
| `packages/engine-native/` | napi-rs native bindings (optional; CI uses subprocess IPC) |
| `packages/sidecar/` | Python BM25 helper for `codebase_search` |
| `packages/skills/` | Declarative skill pack examples |
| `packages/tasks/` | Task templates for contributors |
| `docs/` | Plans, integrations, research, publishing docs |
| `.cursor/` | Local Cursor IDE rules (gitignored) |

## Building and Running

### Prerequisites

| Component | Version |
|-----------|---------|
| Node.js | ≥ 20 |
| Yarn | Classic v1.22.22 |
| Rust | Stable toolchain + Cargo |

### Commands

```bash
# Install dependencies
yarn install

# Build everything (Rust engine dev + TypeScript CLI)
yarn build

# Build components separately
yarn build:engine:dev    # Rust engine (debug)
yarn build:engine        # Rust engine (release)
yarn build:cli           # TypeScript via Turborepo → packages/cli/dist
yarn build:native        # Optional napi-rs bindings

# Run CLI (from repo root)
yarn cli --help
yarn cli doctor
yarn cli chat
yarn cli init

# Lint and verify
yarn lint                # ESLint for @inaricode/cli
yarn verify              # lint + build + test (@inaricode/cli)
yarn verify:all          # verify + cargo test + npm pack --dry-run
yarn pack:check          # list files that would ship in @inaricode/cli

# Tests
yarn test                # Vitest (CLI) + cargo test (engine)
yarn workspace @inaricode/cli test  # CLI tests only
```

### Global `inari` command (development)

```bash
cd packages/cli && yarn link
# then `inari` is available on PATH
```

## Key CLI Commands

| Command | Purpose |
|---------|---------|
| `inari chat` | Start chat REPL (add `--tui` for terminal UI, `--plain` for no ANSI) |
| `inari doctor` | Verify engine, sidecar, embeddings |
| `inari init` | Create `inaricode.yaml` config |
| `inari pick` | Fuzzy file picker (respects `.gitignore` / `.inariignore`) |
| `inari mcp` | Stdio MCP server for external clients |
| `inari cursor` | Cursor Cloud Agents API (`CURSOR_API_KEY` required) |
| `inari providers list` | List available LLM providers |
| `inari completion` | Shell completion scripts (zsh, fish, bash) |

## Configuration

Cosmiconfig searches for `inaricode` config (order matters):

1. `inaricode.<profile>.yaml` (if `INARI_PROFILE` or `INARICODE_PROFILE` set)
2. `inaricode.yaml` / `inaricode.yml` (recommended — use `keys:` map per provider)
3. `inaricode.config.cjs` / `.mjs` / `.js`
4. `.inaricoderc.json` / `.yaml` / `.yml`

Environment overrides:
- `INARI_PROVIDER`, `INARI_MODEL`, `INARI_BASE_URL` (session override)
- `INARI_LANG=en|mn` (English or Mongolian UI)
- `INARI_PLAIN=1` (no ANSI output)
- `INARI_ENGINE_PATH` (path to `inaricode-engine` binary)
- `INARI_ENGINE_IPC=subprocess` (avoid building engine-native)
- `INARI_LOG=json` (structured JSON lines on stderr)

## Development Conventions

### TypeScript (`packages/cli`)

- **Strict mode**: `strict: true`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`
- **ES modules only**: `"type": "module"`, `.js` extensions in imports
- **Naming**:
  - Folders/files: `kebab-case` (enforced by ESLint)
  - Functions/methods: `camelCase`
  - Types/interfaces/classes: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE` (true constants) or `camelCase` (most)
  - Zod schemas: `PascalCase` + `Schema` suffix
- Prefer `const`, avoid non-null assertions (`!`), use `?.` / `??` for narrowing
- Set `error.cause` when rethrowing caught `Error` values
- React 17+ JSX: import named hooks only, no default `React` import for JSX

### Rust Engine (`packages/engine`)

- Use `cargo fmt` and `cargo clippy`
- Release builds use thin LTO + `strip = true` for smaller binary

### Repo Hygiene

- Unix line endings (LF), UTF-8, trim trailing whitespace
- Do not commit `tsc` output under `packages/cli/test/`
- ESLint disk cache under `node_modules/.cache/eslint`

## Third-Party References

- **`kyuna0312/claude-code`** is used **only** for architecture/supply-chain lessons — do not copy proprietary snapshot code into this repo
- Implement features cleanly with existing patterns (Zod, engine IPC, Ink)

## Documentation

- **Roadmap**: `docs/plan/inari-code-plan.md`
- **Task checklist**: `docs/plan/TASKS.md`
- **Agent/contributor notes**: `AGENTS.md`
- **Engine platform**: `docs/engine-platform.md`
- **Publishing**: `docs/publishing.md`
- **Skills**: `docs/skills.md`
- **Integrations**: `docs/integrations/` (Cursor, MCP, etc.)

## License

MIT (see `packages/cli/package.json`)
