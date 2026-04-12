# InariCode

[![CI](https://github.com/kyuna0312/inaricode/actions/workflows/ci.yml/badge.svg)](https://github.com/kyuna0312/inaricode/actions/workflows/ci.yml)

**InariCode** is a local AI coding assistant CLI: multi-turn **chat**, **tool use** (read/write/grep/patch/shell), and a **Rust engine** for sandboxed filesystem and process work. It speaks **Anthropic** and **OpenAI-compatible** APIs (Claude, ChatGPT, Hugging Face router, Google Gemini, Kimi, Qwen, Ollama, etc.). Releases show **semver + patch + a flower codename** (see `packages/cli/package.json` → `inaricode.codename`, or auto from `src/release-flowers.ts`).

## Features

- **`inari chat`** — REPL or **`--tui`** (Ink): streaming, **`--session`**, **`--plain`**, **`--provider`** / **`--model`** (override config), slash commands (**`/pick`** runs the fuzzy file picker); optional **git branch** in the header  
- **`inari providers`** — list **Anthropic, ChatGPT, Kimi, Ollama, Groq, Gemini, HF, …** + **Cursor** (usage row); switch via config, **`INARI_PROVIDER`** / **`INARI_MODEL`**, or chat flags  
- **`inari pick`** — **fuzzy** file chooser (built-in or **`fzf`**); respects `.gitignore` / `.inariignore`  
- **`inari mcp`** — **stdio MCP** server exposing read-only engine tools (`read_file`, `list_dir`, `grep`) for external clients — see **[`docs/integrations/mcp.md`](docs/integrations/mcp.md)**  
- **`inari completion`** — **`zsh`**, **`fish`**, **`bash`** completion scripts  
- **`inari doctor`** — engine IPC, optional Python sidecar, embeddings check; in a monorepo checkout, prints **`packages/skills/examples`** when present  
- **`inari cursor`** — Cursor **Cloud Agents API** (`CURSOR_API_KEY`): list/status/launch agents, models, etc.  
- **`inari init`** / **`inari logo`** — starter config (**`--template beginner`** for read-only + soft theme) and branding  
- **`inari skills list`** — validate **`skills.packs`** from config (declarative prompts + tool allowlists) — see **[`docs/skills.md`](docs/skills.md)**  
- **`inari media`** — Hugging Face text-to-image (and video guidance stub)  
- **Rust `inaricode-engine`** — JSON-line IPC + **Node native** bindings for the same dispatch  
- **Optional** — Python sidecar (`codebase_search`), semantic search via embeddings API, `.inariignore` for grep  
- **Debug** — **`INARI_LOG=json`** — structured JSON lines on stderr from the agent loop (no ANSI)  

UI strings: **English** and **Mongolian** (`locale` / `INARI_LANG`).

## Cursor IDE & Cloud API

- **`.cursor/`** is **gitignored**; keep rules local. Example snippets: **[`docs/integrations/cursor-rules.example.md`](docs/integrations/cursor-rules.example.md)**.
- **`yarn cli cursor`** talks to Cursor’s **Cloud Agents API** when **`CURSOR_API_KEY`** is set — see **[`docs/integrations/cursor.md`](docs/integrations/cursor.md)**.
- **`AGENTS.md`** and terminal **`yarn cli`** still apply. **MCP** roadmap: [plan](docs/plan/inari-code-plan.md).

## Requirements

| Component | Notes |
|-----------|--------|
| **Node.js** | ≥ 20 |
| **Yarn** | Classic v1 (see root `packageManager` in `package.json`) |
| **Rust** | Stable toolchain + **Cargo** (for `packages/engine` and optional native build) |

**Maintainers:** **[`docs/publishing.md`](docs/publishing.md)** — pack contents, manual **`npm publish`**, and **tag-triggered** **[`publish.yml`](.github/workflows/publish.yml)** (needs **`NPM_TOKEN`** in repo secrets).

## Repository layout

| Path | Role |
|------|------|
| **`packages/cli/`** | TypeScript **`inari`** CLI (Ink TUI, LLM drivers, tools, config). Built output: **`dist/`**. |
| **`packages/engine/`** | Rust **`inaricode-engine`** binary — JSON-line IPC, sandboxed fs/grep/patch/shell. |
| **`packages/engine-native/`** | Optional **napi-rs** bindings (multi-target); CI often uses subprocess IPC instead. |
| **`packages/sidecar/`** | Optional Python BM25 helper for **`codebase_search`** (`pip install -r requirements.txt`). |
| **`packages/tasks/`** | Task **templates** for contributors / future automation — **[`packages/tasks/README.md`](packages/tasks/README.md)**. |
| **`packages/skills/`** | Declarative **skill packs** (loaded via **`skills.packs`**) — **[`packages/skills/README.md`](packages/skills/README.md)**, **[`docs/skills.md`](docs/skills.md)**. |
| **`docs/plan/`** | Roadmap **[`inari-code-plan.md`](docs/plan/inari-code-plan.md)** and working **[`TASKS.md`](docs/plan/TASKS.md)**. |
| **`docs/integrations/`** | Cursor and other IDE / host integration notes. |
| **`docs/research/`** | Agent-CLI **comparison** & **supply-chain** notes (educational links only; no third-party code). |
| **`docs/engine-platform.md`** | **IPC** modes, **napi-rs** targets, **`INARI_ENGINE_*`** env vars. |
| **`docs/engine-profiling.md`** | **Profiling budget** for the Rust engine (before any mmap/C++ path). |
| **`docs/publishing.md`** | **npm publish** checklist for **`@inaricode/cli`**. |
| **`packages/README.md`** | Index of every **`packages/*`** directory. |
| Root **`eslint.config.mjs`**, **`turbo.json`** | Lint + Turborepo task graph (see **`package.json`** scripts). |

## Quick start

```bash
git clone https://github.com/kyuna0312/inaricode.git
cd inaricode
yarn install
```

### Contributor check (~5 minutes)

From a **clean clone**, on **Node ≥ 20**, **Yarn classic v1**, and **Rust stable**:

1. `yarn install`
2. `yarn build` — builds **debug** `inaricode-engine` + TypeScript CLI (`packages/cli/dist`)
3. `yarn cli doctor` — expect **engine ipc: ok** (subprocess or native)

Optional full gate before a PR: **`yarn verify`**. Before a release: **`yarn verify:all`**. **Engine / IPC matrix** (subprocess vs native, targets): **[`docs/engine-platform.md`](docs/engine-platform.md)**.

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

- If **`INARI_PROFILE`** or **`INARICODE_PROFILE`** is set (alphanumeric, `_`, `-` only), **`inaricode.<profile>.yaml`** / **`.yml`** are tried **first**, then the list below.
- `inaricode.yaml` / `inaricode.yml` (recommended — use a `keys:` map per provider)
- `inaricode.config.cjs` / `.mjs` / `.js`
- `.inaricoderc.json` / `.yaml` / `.yml`

Run **`inari init`** (default) to create **`inaricode.yaml`** with a `keys:` section, or **`inari init --format cjs`** for `inaricode.config.cjs`.

If both YAML and `.cjs` exist, the YAML file wins (it is listed first). Set API keys under `keys.<provider>` or `apiKey`, or use env vars (see the template comments). Do not commit secrets.

### Language (English / Mongolian)

- Config: `locale: 'en'` or `locale: 'mn'`
- Override: **`INARI_LANG=en`** or **`INARI_LANG=mn`** (wins over config)

## Commands

| Command | Purpose |
|---------|---------|
| `inari chat` | Start chat (add `--tui` for terminal UI) |
| `inari doctor` | Verify engine, sidecar, embeddings; bundled **skills** example dir (dev tree only) |
| `inari init` | Write example **`inaricode.yaml`** (`--format cjs` for `inaricode.config.cjs`) |
| `inari logo` | ASCII banner + bundled mascot path |
| `inari media image` | Text-to-image via **Hugging Face Inference API** (`HF_TOKEN`) |
| `inari media video` | Prints guidance (text-to-video is vendor-specific; not bundled yet) |
| `inari pick` | **Fuzzy file picker** (Ink UI, or **`fzf`** if configured / on PATH) — prints one absolute path |
| `inari mcp` | **Stdio MCP** for Cursor / Claude Desktop–style hosts (`--root` for workspace) |
| `inari completion` | Print **`zsh`**, **`fish`**, or **`bash`** completion script (pipe to `source` / `eval`) |

Common flags: **`--root`**, **`--yes`** (skip confirms), **`--session`**, **`--no-stream`**, **`--read-only`**, **`--tui`**, **`--plain`** (no ANSI; calmer TUI — or **`INARI_PLAIN=1`**).

In chat, slash commands: **`/help`**, **`/pick`** (fuzzy file → next message is the relative path), **`/clear`**, **`/compact [n]`** (trim session to the last *n* user turns, default 8; alias **`/trim`**), **`/exit`** (plus `exit`, `quit`, `гарах`). With **`--session`**, `/clear` and `/compact` update the session file.

### Fuzzy picker & shell completions (zsh / fish style)

- **`inari pick`** — type to **fuzzy-filter** paths (↑/↓, Enter). Uses **`.gitignore`** and **`.inariignore`**. Flags: **`--glob`**, **`--root`**, **`--picker builtin|fzf`**.
- **Config** (optional): `picker: { mode: 'fzf', fzfPath: 'fzf', defaultFileGlob: '**/*.{ts,tsx,js}' }` — default glob when `--glob` is omitted. Env override: **`INARI_PICKER=fzf`** or **`builtin`**.
- **Completions:** fish — `inari completion fish | source`; zsh — `eval "$(inari completion zsh)"`; bash — `eval "$(inari completion bash)"`.

### Hugging Face, Google Gemini, and media

- **Chat:** set `provider: 'huggingface'` and **`HF_TOKEN`** (or `HUGGING_FACE_HUB_TOKEN`), or `provider: 'google'` with **`GOOGLE_API_KEY`** / **`GEMINI_API_KEY`**. Both use OpenAI-compatible chat completions (`router.huggingface.co` and Google’s OpenAI-compat base URL).
- **Image:** `inari media image -p "your prompt"` — default model `black-forest-labs/FLUX.1-schnell` (override with `-m`). **Google Imagen** is not hooked to this subcommand yet; use Gemini for chat via `provider: 'google'`.
- **Video:** no default pipeline in the CLI; use provider APIs directly or follow [`docs/plan/inari-code-plan.md`](docs/plan/inari-code-plan.md) for roadmap.

## Development

Conventions: **strict TypeScript** (`packages/cli/tsconfig.json`), **LF** line endings, **ESLint** + **typescript-eslint** (typed rules via `packages/cli/tsconfig.eslint.json`). Root **`eslint.config.mjs`** applies to the CLI package. From repo root:

```bash
yarn lint               # turbo run lint → @inaricode/cli (ESLint + disk cache)
yarn verify             # turbo: lint + build + test (@inaricode/cli)
yarn verify:all         # verify + cargo test + npm pack --dry-run (CLI tarball)
yarn pack:check         # alone: list files that would ship in @inaricode/cli
yarn workspace @inaricode/cli test
cargo test --manifest-path packages/engine/Cargo.toml
```

Working task list: **[`docs/plan/TASKS.md`](docs/plan/TASKS.md)**.

See **[`AGENTS.md`](AGENTS.md)** for contributor / agent expectations.

## Roadmap & future work

Single source of truth: **[`docs/plan/inari-code-plan.md`](docs/plan/inari-code-plan.md)** (backlog, phases, extensibility, non-goals).

## Related reading (research)

- **[`docs/research/architecture-and-supply-chain.md`](docs/research/architecture-and-supply-chain.md)** — maps common **agent CLI** structure to InariCode, **npm/source-map** hygiene, and pointers to **[kyuna0312/claude-code](https://github.com/kyuna0312/claude-code)** as **third-party educational context** (do **not** copy proprietary snapshot code into this repo).

## Performance & troubleshooting

| Topic | Tip |
|--------|-----|
| Engine | **`INARI_ENGINE_IPC=subprocess`** avoids building **engine-native**; set **`INARI_ENGINE_PATH`** to your `inaricode-engine` binary if needed. |
| Large repos | Use a **tighter glob** for `inari pick` (config `picker.defaultFileGlob` or `--glob`). |
| CI / headless | **`INARI_PLAIN=1`** or **`inari chat --plain`** for logs without ANSI. |
| Keys | Run **`inari doctor`** after **`yarn build`**; sidecar/embeddings are optional. |

## License

MIT — see [`packages/cli/package.json`](packages/cli/package.json) (CLI package).
