# InariCode

**InariCode** is a local AI coding assistant CLI: multi-turn **chat**, **tool use** (read/write/grep/patch/shell), and a **Rust engine** for sandboxed filesystem and process work. It speaks **Anthropic** and **OpenAI-compatible** APIs (Claude, ChatGPT, Kimi, Qwen, Ollama, etc.).

## Features

- **`inari chat`** — REPL or **`--tui`** (Ink) with streaming, session JSON, read-only mode, and confirmations for mutating tools  
- **`inari doctor`** — engine IPC, optional Python sidecar, embeddings check  
- **`inari init`** — writes a starter config next to your project  
- **Rust `inaricode-engine`** — JSON-line IPC + **Node native** bindings for the same dispatch  
- **Optional** — Python sidecar (`codebase_search`), semantic search via embeddings API, `.inariignore` for grep  

UI strings are available in **English** and **Mongolian** (`locale` / `INARI_LANG`).

## Requirements

| Component | Notes |
|-----------|--------|
| **Node.js** | ≥ 20 |
| **Yarn** | Classic v1 (see root `packageManager` in `package.json`) |
| **Rust** | Stable toolchain + **Cargo** (for `packages/engine` and optional native build) |

## Quick start

```bash
git clone https://github.com/kyuna0312/inaricode.git
cd inaricode
yarn install
```

Build the Rust engine (dev) and the CLI:

```bash
yarn build
```

Or separately:

```bash
yarn build:engine:dev   # packages/engine
yarn build:cli          # TypeScript → packages/cli/dist
```

Run the CLI from the workspace (after build):

```bash
node packages/cli/dist/cli.js --help
# or, if linked globally / via yarn workspace:
# inari --help
```

### Engine binary

`inari doctor` expects a built engine or **`INARI_ENGINE_PATH`** pointing at the `inaricode-engine` binary. Build release with:

```bash
yarn build:engine
```

## Configuration

Cosmiconfig searches for **`inaricode`** under the current working directory, in this order:

- `inaricode.config.cjs` / `.mjs` / `.js`
- `.inaricoderc.json` / `.yaml` / `.yml`

Run **`inari init`** to create `inaricode.config.cjs` with comments.

Set API keys and provider options in that file (see the generated template). Do not commit secrets; use env vars where your setup allows.

### Language (English / Mongolian)

- Config: `locale: 'en'` or `locale: 'mn'`
- Override: **`INARI_LANG=en`** or **`INARI_LANG=mn`** (wins over config)

## Commands

| Command | Purpose |
|---------|---------|
| `inari chat` | Start chat (add `--tui` for terminal UI) |
| `inari doctor` | Verify engine, sidecar, embeddings |
| `inari init` | Write example config |
| `inari logo` | ASCII banner + bundled mascot path |

Common flags: **`--root`**, **`--yes`** (skip confirms), **`--session`**, **`--no-stream`**, **`--read-only`**.

## Development

```bash
yarn workspace @inaricode/cli test    # Vitest
cargo test --manifest-path packages/engine/Cargo.toml
```

More detail: [`docs/plan/inari-code-plan.md`](docs/plan/inari-code-plan.md).

## License

MIT — see [`packages/cli/package.json`](packages/cli/package.json) (CLI package).
