# INARI CODE 🦊

> A modular, terminal-based AI development system integrating tmux, LazyVim, and OpenCode.

## Concept

INARI CODE provides a clean developer workflow with:
- **Tmux workspaces** - Pre-configured tmux sessions for development, debugging, code review
- **LazyVim integration** - AI-powered keymaps for code refactoring and fixes
- **OpenCode AI** - Prompt-based code generation, refactoring, and bug fixes

## Architecture

```
inari-code/
├── cli/inari                      # CLI tool
├── core/
│   ├── tmux/                      # Workspace scripts
│   │   ├── dev.sh                 # Development session
│   │   ├── debug.sh               # Debug session
│   │   ├── review.sh             # Code review session
│   │   └── test.sh               # Test session
│   ├── nvim/lua/plugins/         # LazyVim plugins
│   │   └── ai-keymaps.lua        # AI keymaps
│   └── ai/
│       ├── ai.sh                  # AI wrapper
│       └── prompts/               # Prompt templates
├── workflows/                      # YAML workflows
└── docs/
    └── DEVELOPMENT.md             # 6-month plan
```

## Installation

```bash
git clone https://github.com/yourrepo/inari-code.git
cd inari-code
chmod +x install.sh
./install.sh
```

Add to PATH:
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## Quick Start

```bash
inari dev          # Start development workspace
inari status      # Show active sessions
inari help        # Show help
```

## Commands

| Command | Description |
|--------|-------------|
| `inari dev` | Start dev workspace (nvim + opencode + npm run dev + test) |
| `inari debug` | Start debug workspace (logs + terminal + nvim) |
| `inari review` | Start code review (nvim + git log + opencode) |
| `inari test` | Start test workspace (npm test + nvim) |
| `inari status` | Show active sessions |
| `inari config` | Show/set configuration |
| `inari list` | List available workflows |

### Configuration

```bash
# Set project directory
inari config project /path/to/project

# Show current config
inari config
```

## Tmux Layouts

### Dev Session
```
┌─────────────┬─────────────┐
│    nvim     │  opencode   │
├─────────────┼─────────────┤
│npm run dev │npm test w/ │
└─────────────┴─────────────┘
```

### Debug Session
```
┌─────────────┬─────────────┐
│    logs    │  terminal  │
├─────────────┴─────────────┤
│          nvim           │
└────────────────────────┘
```

### Review Session
```
┌─────────────┬─────────────┐
│    nvim     │  git log    │
├─────────────┴─────────────┤
│        opencode         │
└────────────────────────┘
```

## Neovim Keymaps

| Keymap | Action |
|-------|--------|
| `<leader>ai` | Open OpenCode terminal split |
| `<leader>ar` | Refactor selected code with AI |
| `<leader>af` | Fix current line error with AI |

### Usage

1. Select code in visual mode
2. Press `<leader>ar` to refactor
3. Or put cursor on error line and press `<leader>af`

## AI Workflows

### Refactor
```bash
echo "optimize this function" | inari refactor
```

### Fix
```bash
echo "TypeError: undefined" | inari fix
```

### Generate
```bash
echo "create a react hook" | inari generate
```

## YAML Workflows

Located in `~/.inari-code/workflows/`:

```yaml
name: dev
description: Development workflow

steps:
  - name: start_tmux
    command: tmux new-session -d -s inari-dev
  
  - name: open_nvim
    command: tmux send-keys -t inari-dev "nvim" C-m

ai_usage_points:
  - tool: opencode refactor
  - tool: opencode generate
```

## Requirements

- tmux ≥ 2.9
- Neovim ≥ 0.9
- opencode CLI

Install on macOS:
```bash
brew install tmux
brew install nvim
curl -sSfL https://get.opencode.ai | sh
```

Install on Linux:
```bash
sudo apt install tmux neovim
curl -sSfL https://get.opencode.ai | sh
```

## Development Plan

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for the 6-month roadmap.

## Version History

| Version | Date | Changes |
|---------|-----|--------|
| 1.0.0 | 2025-04 | Initial release |
| 1.1.0 | 2025-04 | Enhanced CLI, review/test workspaces |

## License

MIT

---

Built with 🦊 for terminal-based AI development