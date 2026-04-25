#!/usr/bin/env bash
# Inari Code Bootstrap Installer v1.1.0
# Installs/checks dependencies, clones project, sets up tmux + LazyVim config,
# generates CLI + workflows, makes everything runnable

set -e

INARI_VERSION="1.1.0"
INSTALL_DIR="${HOME}/.inari-code"
CONFIG_FILE="${INSTALL_DIR}/config.sh"

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
blue='\033[0;34m'
nc='\033[0m'

log_info()  { echo -e "${blue}[INFO]${nc} $1"; }
log_ok()   { echo -e "${green}[OK]${nc}   $1"; }
log_err()  { echo -e "${red}[ERR]${nc}  $1"; }

print_banner() {
    echo "========================================"
    echo "  Inari Code Installer v${INARI_VERSION}"
    echo "========================================"
}

load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
    fi
    PROJECT_DIR="${PROJECT_DIR:-$HOME/projects}"
    export PROJECT_DIR
}

save_config() {
    cat > "$CONFIG_FILE" <<CONFIG
# Inari Code Configuration
PROJECT_DIR="${PROJECT_DIR:}"
CONFIG
}

check_dependencies() {
    log_info "Checking dependencies..."
    local missing=()
    for dep in tmux nvim opencode; do
        if ! command -v "$dep" &>/dev/null; then missing+=("$dep"); fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        log_err "Missing: ${missing[*]}"
        exit 1
    fi
    log_ok "All dependencies OK"
}

install() {
    print_banner
    check_dependencies
    
    log_info "Installing to ${INSTALL_DIR}..."
    rm -rf "${INSTALL_DIR}"
    mkdir -p "${INSTALL_DIR}"/{cli,core/{tmux,nvim/lua/plugins,ai/prompts},workflows,.memory/{bugs,refactors,sessions},docs}
    
    # Create tmux scripts
    cat > "${INSTALL_DIR}/core/tmux/dev.sh" <<'DEV'
#!/usr/bin/env bash
SESSION="inari-dev"
PDIR="${PROJECT_DIR:-$HOME/projects}"
start_session() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then tmux attach -t "$SESSION"; return; fi
    tmux new-session -d -s "$SESSION" -n "nvim" -c "$PDIR"
    tmux send-keys -t "$SESSION:0" "nvim" C-m
    tmux split-window -h -t "$SESSION"
    tmux send-keys -t "$SESSION:0.1" "opencode" C-m
    tmux split-window -v -t "$SESSION:0.1"
    tmux send-keys -t "$SESSION:0.2" "cd $PDIR && npm run dev" C-m
    tmux select-pane -t "$SESSION:0.0"
    tmux split-window -v -t "$SESSION:0.0"
    tmux send-keys -t "$SESSION:0.3" "cd $PDIR && npm test --watch" C-m
    tmux select-layout -t "$SESSION" even-horizontal
    tmux attach -t "$SESSION"
}
case "${1:-start}" in start) start_session ;; stop) tmux kill-session -t "$SESSION" 2>/dev/null || true ;; esac
DEV

    cat > "${INSTALL_DIR}/core/tmux/debug.sh" <<'DEBUG'
#!/usr/bin/env bash
SESSION="inari-debug"
PDIR="${PROJECT_DIR:-$HOME/projects}"
start_session() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then tmux attach -t "$SESSION"; return; fi
    tmux new-session -d -s "$SESSION" -n "logs" -c "$PDIR"
    tmux send-keys -t "$SESSION:0" "tail -f logs/*.log 2>/dev/null || echo No logs" C-m
    tmux split-window -h -t "$SESSION"
    tmux send-keys -t "$SESSION:0.1" "cd $PDIR" C-m
    tmux split-window -v -t "$SESSION:0.1"
    tmux send-keys -t "$SESSION:0.2" "cd $PDIR && nvim" C-m
    tmux select-layout -t "$SESSION" even-horizontal
    tmux attach -t "$SESSION"
}
case "${1:-start}" in start) start_session ;; stop) tmux kill-session -t "$SESSION" 2>/dev/null || true ;; esac
DEBUG

    # Create review tmux script
    cat > "${INSTALL_DIR}/core/tmux/review.sh" <<'REVIEW'
#!/usr/bin/env bash
SESSION="inari-review"
load_config
start_session() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then tmux attach -t "$SESSION"; return; fi
    tmux new-session -d -s "$SESSION" -n "nvim" -c "$PROJECT_DIR"
    tmux send-keys -t "$SESSION:0" "nvim" C-m
    tmux split-window -h -t "$SESSION"
    tmux send-keys -t "$SESSION:0.1" "git log --oneline -20" C-m
    tmux split-window -v -t "$SESSION:0.1"
    tmux send-keys -t "$SESSION:0.2" "opencode" C-m
    tmux select-layout -t "$SESSION" even-horizontal
    tmux attach -t "$SESSION"
}
case "${1:-start}" in start) start_session ;; stop) tmux kill-session -t "$SESSION" 2>/dev/null || true ;; esac
REVIEW

    # Create test tmux script
    cat > "${INSTALL_DIR}/core/tmux/test.sh" <<'TEST'
#!/usr/bin/env bash
SESSION="inari-test"
load_config
start_session() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then tmux attach -t "$SESSION"; return; fi
    tmux new-session -d -s "$SESSION" -n "tests" -c "$PROJECT_DIR"
    tmux send-keys -t "$SESSION:0" "npm test --watch" C-m
    tmux split-window -h -t "$SESSION"
    tmux send-keys -t "$SESSION:0.1" "cd $PROJECT_DIR && nvim" C-m
    tmux select-layout -t "$SESSION" even-horizontal
    tmux attach -t "$SESSION"
}
case "${1:-start}" in start) start_session ;; stop) tmux kill-session -t "$SESSION" 2>/dev/null || true ;; esac
TEST

    chmod +x "${INSTALL_DIR}/core/tmux/"*.sh
    
    # Create nvim keymaps
    mkdir -p "${HOME}/.config/nvim/lua/plugins"
    cat > "${HOME}/.config/nvim/lua/plugins/ai-keymaps.lua" <<'KEYMAPS'
local keymap = vim.keymap.set
keymap("n", "<leader>ai", function()
    local buf = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_name(buf, "OpenCode")
    vim.api.nvim_open_win(buf, true, {
        relative = "editor",
        width = math.floor(vim.o.columns * 0.5),
        height = math.floor(vim.o.lines * 0.4),
        row = vim.o.lines - math.floor(vim.o.lines * 0.4) - 2,
        col = vim.o.columns - math.floor(vim.o.columns * 0.5),
        border = "rounded",
        title = " OpenCode AI ",
        title_pos = "center",
    })
    vim.fn.termopen("opencode", { on_exit = function() vim.api.nvim_buf_delete(buf, { force = true }) end })
end, { noremap = true, silent = true, desc = "Open AI terminal" })
keymap("v", "<leader>ar", function()
    local lines = vim.fn.getline("'<", "'>")
    local selection = table.concat(lines, "\n")
    vim.fn.system(string.format("echo '%s' | opencode refactor", vim.fn.shellescape(selection)))
end, { noremap = true, silent = true, desc = "Refactor with AI" })
keymap("n", "<leader>af", function()
    local error_msg = vim.fn.getline(".")
    vim.fn.system(string.format("echo '%s' | opencode fix", vim.fn.shellescape(error_msg)))
end, { noremap = true, silent = true, desc = "Fix error with AI" })
KEYMAPS

    # Create CLI
    cat > "${INSTALL_DIR}/cli/inari" <<'CLI'
#!/usr/bin/env bash
# Inari Code CLI v1.1.0

CONFIG_FILE="${HOME}/.inari-code/config.sh"
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then source "$CONFIG_FILE"; fi
    PROJECT_DIR="${PROJECT_DIR:-$HOME/projects}"
}

SDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TDIR="$SDIR/core/tmux"
WDIR="$SDIR/workflows"

show_help() {
    cat <<EOF
Inari Code - Terminal AI Development System

Usage: inari <command>

Commands:
    dev         Start development workspace
    debug       Start debug workspace  
    review      Start code review workspace
    test        Start test workspace
    status      Show active sessions
    config      Show/set configuration
    list        List available workflows
    help        Show this help

Examples:
    inari dev
    inari status
    inari config project /path/to/project
EOF
}

show_status() {
    echo "Active sessions:"
    tmux list-sessions 2>/dev/null | grep "^inari-" || echo "  No active sessions"
    echo ""
    echo "Project: ${PROJECT_DIR}"
}

show_config() {
    load_config
    if [[ -n "$1" && "$1" == "project" && -n "$2" ]]; then
        PROJECT_DIR="$2"
        cat > "$CONFIG_FILE" <<CONFIG
PROJECT_DIR="$PROJECT_DIR"
CONFIG
        echo "Project set to: $PROJECT_DIR"
    else
        echo "Current config:"
        echo "  PROJECT_DIR=${PROJECT_DIR}"
    fi
}

list_workflows() {
    echo "Available workflows:"
    for f in "$WDIR"/*.yaml; do
        [[ -f "$f" ]] && echo "  $(basename "$f" .yaml)"
    done
}

case "${1:-help}" in
    dev)    "$TDIR/dev.sh" start ;;
    debug)  "$TDIR/debug.sh" start ;;
    review) "$TDIR/review.sh" start ;;
    test)   "$TDIR/test.sh" start ;;
    status) show_status ;;
    config) shift; show_config "$@" ;;
    list)   list_workflows ;;
    help|--help|-h) show_help ;;
    *) echo "Unknown: $1"; show_help; exit 1 ;;
esac
CLI

    # Create AI wrapper
    cat > "${INSTALL_DIR}/core/ai/ai.sh" <<'AI'
#!/usr/bin/env bash
PDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/prompts" && pwd)"
run_ai() {
    local pt="$1"; local pf="$PDIR/${pt}.prompt"; local input="$2"
    [[ ! -f "$pf" ]] && { echo "Prompt not found"; exit 1; }
    command -v opencode &>/dev/null || { echo "opencode not found"; exit 1; }
    echo "$input" | opencode --prompt "@$pf"
}
case "${1:-}" in refactor) shift; run_ai refactor "$@" ;; fix) shift; run_ai fix "$@" ;; generate) shift; run_ai generate "$@" ;; esac
AI

    # Create prompts
    echo -e "# Refactor\nImprove readability.\nKeep logic unchanged." > "${INSTALL_DIR}/core/ai/prompts/refactor.prompt"
    echo -e "# Fix\nDetect and fix bugs.\nExplain briefly." > "${INSTALL_DIR}/core/ai/prompts/fix.prompt"
    echo -e "# Generate\nGenerate code from description.\nUse safe patterns." > "${INSTALL_DIR}/core/ai/prompts/generate.prompt"

    # Create workflows
    cat > "${INSTALL_DIR}/workflows/dev.yaml" <<'WF1'
name: dev
description: Development workflow
steps:
  - name: start_tmux
    command: tmux new-session -d -s inari-dev
  - name: open_nvim
    command: tmux send-keys -t inari-dev "nvim" C-m
WF1

    cat > "${INSTALL_DIR}/workflows/refactor.yaml" <<'WF2'
name: refactor
description: AI refactoring workflow
ai_usage_points:
  - tool: opencode refactor
WF2

    cat > "${INSTALL_DIR}/workflows/debug.yaml" <<'WF3'
name: debug
description: Debug workflow
steps:
  - name: start_session
    command: tmux new-session -d -s inari-debug
WF3

    # Make executable
    chmod +x "${INSTALL_DIR}/cli/inari" "${INSTALL_DIR}/core/tmux/"*.sh "${INSTALL_DIR}/core/ai/ai.sh"

    # Create symlinks
    mkdir -p "${HOME}/bin"
    ln -sfT "${INSTALL_DIR}/cli/inari" "${HOME}/bin/inari"
    ln -sfT "${INSTALL_DIR}/core/tmux/dev.sh" "${HOME}/bin/inari-dev"
    ln -sfT "${INSTALL_DIR}/core/tmux/debug.sh" "${HOME}/bin/inari-debug"
    ln -sfT "${INSTALL_DIR}/core/tmux/review.sh" "${HOME}/bin/inari-review"
    ln -sfT "${INSTALL_DIR}/core/tmux/test.sh" "${HOME}/bin/inari-test"

    log_ok "Installation complete!"
    echo ""
    echo "Add to PATH: export PATH=\"\$HOME/bin:\$PATH\""
    echo "Usage: inari dev | inari debug"
}

uninstall() {
    rm -f "${HOME}/bin/inari" "${HOME}/bin/inari-dev" "${HOME}/bin/inari-debug"
    rm -rf "${INSTALL_DIR}"
    echo "Uninstalled"
}

case "${1:-install}" in
    install) install ;;
    uninstall) uninstall ;;
    *) echo "Usage: $0 {install|uninstall}" ;;
esac