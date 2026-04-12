# InariCode

[![CI](https://github.com/kyuna0312/inaricode/actions/workflows/ci.yml/badge.svg)](https://github.com/kyuna0312/inaricode/actions/workflows/ci.yml)

**InariCode** is a local AI coding assistant CLI: multi-turn **chat**, **tool use** (read/write/grep/patch/shell), and a **Rust engine** for sandboxed filesystem and process work. It speaks **Anthropic** and **OpenAI-compatible** APIs (Claude, ChatGPT, Hugging Face router, Google Gemini, Kimi, Qwen, Ollama, etc.). Releases show **semver + patch + a flower codename** (see `packages/cli/package.json` → `inaricode.codename`, or auto from `src/release-flowers.ts`).

## Features

- **`inari chat`** — REPL or **`--tui`** (Ink): streaming, **`--session`**, **`--plain`**, slash commands (`/help`, `/clear`, `/exit`), optional **git branch** in the header  
- **`inari pick`** — **fuzzy** file chooser (built-in or **`fzf`**); respects `.gitignore` / `.inariignore`  
- **`inari completion`** — **`zsh`**, **`fish`**, **`bash`** completion scripts  
- **`inari doctor`** — engine IPC, optional Python sidecar, embeddings check  
- **`inari init`** / **`inari logo`** — starter config and branding  
- **`inari media`** — Hugging Face text-to-image (and video guidance stub)  
- **Rust `inaricode-engine`** — JSON-line IPC + **Node native** bindings for the same dispatch  
- **Optional** — Python sidecar (`codebase_search`), semantic search via embeddings API, `.inariignore` for grep  

UI strings: **English** and **Mongolian** (`locale` / `INARI_LANG`).

## Cursor IDE

Developing **in** Cursor? See **[`docs/integrations/cursor.md`](docs/integrations/cursor.md)** for project rules (`.cursor/rules/`), **`AGENTS.md`**, terminal **`yarn cli`**, and how InariCode complements the editor. A future **MCP** link is on the [plan](docs/plan/inari-code-plan.md).

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
yarn build:cli          # TypeScript via [Turborepo](https://turbo.build) → packages/cli/dist
yarn build:native       # optional: @inaricode/engine-native (napi); CI uses subprocess IPC instead
```

Run the CLI from the workspace (after **`yarn install`** + **`yarn build`**). The name **`inari`** is only on your **`PATH`** if you **`yarn link`** inside `packages/cli` or install a published package — otherwise use one of these from the **repo root**:

```bash
yarn cli --help
yarn cli init
yarn cli doctor

# same binaries Yarn installs locally:
./node_modules/.bin/inari doctor
```

To type **`inari`** anywhere (global link for development):

```bash
cd packages/cli && yarn link
# then: inari doctor
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
| `inari media image` | Text-to-image via **Hugging Face Inference API** (`HF_TOKEN`) |
| `inari media video` | Prints guidance (text-to-video is vendor-specific; not bundled yet) |
| `inari pick` | **Fuzzy file picker** (Ink UI, or **`fzf`** if configured / on PATH) — prints one absolute path |
| `inari completion` | Print **`zsh`**, **`fish`**, or **`bash`** completion script (pipe to `source` / `eval`) |

Common flags: **`--root`**, **`--yes`** (skip confirms), **`--session`**, **`--no-stream`**, **`--read-only`**, **`--tui`**, **`--plain`** (no ANSI; calmer TUI — or **`INARI_PLAIN=1`**).

In chat, slash commands: **`/help`**, **`/clear`**, **`/exit`** (plus `exit`, `quit`, `гарах`). With **`--session`**, `/clear` writes an empty history file.

### Fuzzy picker & shell completions (zsh / fish style)

- **`inari pick`** — type to **fuzzy-filter** paths (↑/↓, Enter). Uses **`.gitignore`** and **`.inariignore`**. Flags: **`--glob`**, **`--root`**, **`--picker builtin|fzf`**.
- **Config** (optional): `picker: { mode: 'fzf', fzfPath: 'fzf', defaultFileGlob: '**/*.{ts,tsx,js}' }` — default glob when `--glob` is omitted. Env override: **`INARI_PICKER=fzf`** or **`builtin`**.
- **Completions:** fish — `inari completion fish | source`; zsh — `eval "$(inari completion zsh)"`; bash — `eval "$(inari completion bash)"`.

### Hugging Face, Google Gemini, and media

- **Chat:** set `provider: 'huggingface'` and **`HF_TOKEN`** (or `HUGGING_FACE_HUB_TOKEN`), or `provider: 'google'` with **`GOOGLE_API_KEY`** / **`GEMINI_API_KEY`**. Both use OpenAI-compatible chat completions (`router.huggingface.co` and Google’s OpenAI-compat base URL).
- **Image:** `inari media image -p "your prompt"` — default model `black-forest-labs/FLUX.1-schnell` (override with `-m`). **Google Imagen** is not hooked to this subcommand yet; use Gemini for chat via `provider: 'google'`.
- **Video:** no default pipeline in the CLI; use provider APIs directly or follow [`docs/plan/inari-code-plan.md`](docs/plan/inari-code-plan.md) for roadmap.

## Development

Conventions: **strict TypeScript** (`packages/cli/tsconfig.json`), **LF** line endings, **ESLint** + **typescript-eslint** (typed rules via `packages/cli/tsconfig.eslint.json`). From repo root:

```bash
yarn lint               # ESLint on CLI src + test/
yarn verify             # lint + Turborepo build + Vitest
yarn workspace @inaricode/cli test
cargo test --manifest-path packages/engine/Cargo.toml
```

See **[`AGENTS.md`](AGENTS.md)** for contributor / agent expectations.

## Roadmap & future work

Single source of truth: **[`docs/plan/inari-code-plan.md`](docs/plan/inari-code-plan.md)** (backlog, phases, extensibility, non-goals).

## Performance & troubleshooting

| Topic | Tip |
|--------|-----|
| Engine | **`INARI_ENGINE_IPC=subprocess`** avoids building **engine-native**; set **`INARI_ENGINE_PATH`** to your `inaricode-engine` binary if needed. |
| Large repos | Use a **tighter glob** for `inari pick` (config `picker.defaultFileGlob` or `--glob`). |
| CI / headless | **`INARI_PLAIN=1`** or **`inari chat --plain`** for logs without ANSI. |
| Keys | Run **`inari doctor`** after **`yarn build`**; sidecar/embeddings are optional. |

## License

MIT — see [`packages/cli/package.json`](packages/cli/package.json) (CLI package).
