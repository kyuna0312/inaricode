# InariCode

[![CI](https://github.com/kyuna0312/inaricode/actions/workflows/ci.yml/badge.svg)](https://github.com/kyuna0312/inaricode/actions/workflows/ci.yml)

**InariCode** — OpenCode-powered CLI coding assistant with nyan.nvim integration.

## Features

- **`inari chat`** — REPL or TUI mode with OpenCode as default provider
- **`inari pick`** — Fuzzy file picker (builtin or fzf)
- **`inari doctor`** — System check with nyan.nvim detection
- **Multi-provider** — OpenCode, Anthropic, OpenAI, Kimi, Ollama, Groq, Google Gemini
- **Neovim/nyan.nvim aware** — Detects running environment and plugin presence
- **Rust engine** — Sandboxed filesystem operations

## Quick Start

```bash
git clone https://github.com/kyuna0312/inaricode.git
cd inaricode
yarn install
yarn build
```

## Commands

| Command | Description |
|---------|-------------|
| `inari chat` | Start REPL/TUI chat |
| `inari pick` | Fuzzy file picker |
| `inari doctor` | System check |
| `inari providers` | List providers |
| `inari init` | Create config |
| `inari logo` | Print logo |

## Configuration

```yaml
# inaricode.yaml
provider: opencode
opencode:
  enabled: true
  url: "http://localhost:4096"
  model: "claude-sonnet"
```

## Providers

- **opencode** — OpenCode serve endpoint (default)
- **anthropic** — Anthropic Claude
- **openai** — OpenAI ChatGPT
- **kimi** — Moonshot Kimi
- **ollama** — Ollama (local)
- **groq** — Groq
- **google** — Google Gemini
- **custom** — Custom OpenAI-compatible URL

## Requirements

| Component | Version |
|-----------|--------|
| Node.js | ≥20 |
| Yarn | Classic v1 |
| Rust | Stable |

## Development

```bash
yarn build        # Build engine + CLI
yarn lint       # ESLint
yarn test       # Run tests
```

## License

MIT — see `packages/cli/package.json`