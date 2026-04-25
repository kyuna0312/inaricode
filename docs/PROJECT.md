# InariCode — Project Description

## Overview

**InariCode** is a lightweight CLI coding assistant built around OpenCode integration with Neovim/nyan.nvim awareness. It provides a simple, modular structure for AI-powered coding assistance.

## Mission

Create a minimal, focused CLI that leverages OpenCode as its primary AI backend while remaining aware of the user's development environment (particularly Neovim with nyan.nvim).

## Architecture

```
packages/cli/src/
├── cli.ts        # Commander-based CLI
├── config.ts     # Zod + cosmiconfig config
├── providers.ts # Provider presets
├── opencode.ts  # OpenCode SDK client
├── nyanvim.ts  # Neovim/nyan.nvim detection
└── version.ts  # Version management
```

## Key Features

### 1. OpenCode Integration
- Connect to OpenCode serve endpoint (`http://localhost:4096`)
- Streaming chat support
- Configurable timeout and model

### 2. Neovim/nyan.nvim Awareness
- Detect running inside Neovim
- Detect nyan.nvim plugin presence
- Terminal detection (iTerm, WezTerm, Kitty, Alacritty)
- Vim keybindings option

### 3. Provider Support
- OpenCode (default)
- Anthropic Claude
- OpenAI ChatGPT
- Moonshot Kimi
- Ollama (local)
- Groq
- Google Gemini
- Custom endpoints

### 4. Commands
- `inari chat` — Start AI chat
- `inari pick` — Fuzzy file picker
- `inari doctor` — System check
- `inari providers` — List providers
- `inari init` — Create config
- `inari logo` — Print logo

## Design Principles

1. **Minimal** — Small, focused codebase (~400 lines)
2. **Modular** — Clear separation of concerns
3. **OpenCode-first** — Primary integration point
4. **Environment aware** — Knows about Neovim/nyan.nvim

## Configuration

```yaml
# inaricode.yaml
provider: opencode
opencode:
  enabled: true
  url: "http://localhost:4096"
  token: "${OPENCODE_TOKEN}"
  model: "claude-sonnet"
  timeout: 30000
  fallback: false
picker:
  mode: builtin
  glob: "**/*"
locale: en
chatTheme: default
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCODE_URL` | OpenCode serve URL | `http://localhost:4096` |
| `OPENCODE_TOKEN` | OpenCode auth token | — |
| `INARI_VIM` | Force vim keybindings | auto-detect |

## Versioning

- Semantic versioning (semver)
- Codename from flower names (Sakura, Rose, Tulip, etc.)

## Dependencies

| Package | Purpose |
|---------|---------|
| commander | CLI framework |
| cosmiconfig | Config loading |
| zod | Schema validation |
| openai | OpenAI-compatible API types |

## Roadmap

- [x] Core CLI structure
- [x] OpenCode client
- [x] Provider presets
- [x] Neovim detection
- [ ] Chat implementation
- [ ] File picker integration
- [ ] TUI mode

## License

MIT

---

## Integration Details

### OpenCode Client

The `opencode.ts` module provides a thin wrapper around OpenCode's HTTP API:

```typescript
import { OpenCodeClient, createClient } from "./opencode.js";

const client = createClient({
  baseUrl: "http://localhost:4096",
  token: process.env.OPENCODE_TOKEN,
  timeout: 30000,
  model: "claude-sonnet",
});

const response = await client.chat({
  messages: [{ role: "user", content: "Hello" }],
});

console.log(response.content);
```

### Neovim Detection

The `nyanvim.ts` module detects the development environment:

```typescript
import { detectIde, isRunningInNeovim, detectNyanNvim } from "./nyanvim.js";

const ide = await detectIde();
// ide.isNeovim        — running inside Neovim
// ide.isNyanNvim     — nyan.nvim plugin detected
// ide.terminal        — terminal type (iterm, wezterm, kitty, etc.)
// ide.vimKeybindings — vim mode enabled
```

## Build & Test

```bash
# Build
yarn build

# Type check
cd packages/cli && npx tsc --noEmit

# Lint
yarn lint
```