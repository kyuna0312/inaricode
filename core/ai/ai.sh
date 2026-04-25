#!/usr/bin/env bash
# AI Wrapper Script for Inari Code

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_DIR="$SCRIPT_DIR/prompts"

run_ai() {
    local prompt_type="$1"
    local prompt_file="$PROMPT_DIR/${prompt_type}.prompt"
    local input="$2"
    
    if [[ ! -f "$prompt_file" ]]; then
        echo "Error: Prompt template '$prompt_type' not found" >&2
        exit 1
    fi
    
    if command -v opencode &>/dev/null; then
        echo "$input" | opencode --prompt "@$prompt_file"
    else
        echo "Error: opencode not installed" >&2
        exit 1
    fi
}

case "${1:-}" in
    refactor)
        run_ai refactor "$2"
        ;;
    fix)
        run_ai fix "$2"
        ;;
    generate)
        run_ai generate "$2"
        ;;
    *)
        echo "Usage: $0 {refactor|fix|generate} <input>"
        exit 1
        ;;
esac