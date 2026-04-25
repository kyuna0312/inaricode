#!/usr/bin/env bash
# Inari Code - Workflow Executor
# Executes parsed workflow steps

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="${SCRIPT_DIR}/parse.sh"

DRY_RUN=false
VERBOSE=false
STEP_DELAY=0

log_info()  { echo "[INFO] $1"; }
log_ok()    { echo "[OK]   $1"; }
log_err()   { echo "[ERR]  $1" >&2; }
log_step()  { echo "[STEP] $1"; }
log_debug() { [[ "$VERBOSE" == "true" ]] && echo "[DEBUG] $1" || true; }

execute_step() {
    local step_name="$1"
    local step_command="$2"
    local step_desc="$3"
    
    log_step "Executing: $step_name"
    [[ -n "$step_desc" ]] && echo "         $step_desc"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "         Would run: $step_command"
        return 0
    fi
    
    if [[ -n "$step_delay" && "$step_delay" -gt 0 ]]; then
        sleep "$step_delay"
    fi
    
    if eval "$step_command" 2>/dev/null; then
        log_ok "Step completed: $step_name"
        return 0
    else
        log_err "Step failed: $step_name"
        return 1
    fi
}

execute_workflow() {
    local workflow="$1"
    local workflow_file
    
    workflow_file=$("$PARSER" find "$workflow")
    
    if [[ -z "$workflow_file" ]]; then
        log_err "Workflow not found: $workflow"
        return 1
    fi
    
    log_info "Loading workflow: $workflow"
    log_info "File: $workflow_file"
    
    local name description
    name=$("$PARSER" parse "$workflow" 2>/dev/null | grep "^NAME|" | cut -d'|' -f2)
    description=$("$PARSER" parse "$workflow" 2>/dev/null | grep "^DESC|" | cut -d'|' -f2)
    
    if [[ -z "$name" ]]; then
        name="$workflow"
        description="Workflow"
    fi
    
    echo ""
    echo "========================================"
    echo "  Running: $name"
    echo "  $description"
    echo "========================================"
    echo ""
    
    local steps
    steps=$(grep -E '^  - name:' "$workflow_file" | sed 's/.*name: //')
    local cmds
    cmds=$(grep -E '^    command:' "$workflow_file" | sed 's/.*command: //')
    
    local s_arr=()
    while IFS= read -r l; do
        [[ -n "$l" ]] && s_arr+=("$l")
    done <<< "$steps"
    
    local c_arr=()
    while IFS= read -r l; do
        [[ -n "$l" ]] && c_arr+=("$l")
    done <<< "$cmds"
    
    if [[ ${#s_arr[@]} -eq 0 ]]; then
        log_err "No steps found in workflow: $workflow"
        return 1
    fi
    
    local i=0
    local failed=0
    for step in "${s_arr[@]}"; do
        if [[ -n "${c_arr[$i]}" ]]; then
            if ! execute_step "$step" "${c_arr[$i]}" ""; then
                failed=1
                break
            fi
        fi
        ((i++))
    done
    
    if [[ $failed -eq 0 ]]; then
        echo ""
        log_ok "Workflow completed successfully!"
        return 0
    else
        echo ""
        log_err "Workflow failed"
        return 1
    fi
}

show_ai_points() {
    local workflow="$1"
    local ai_points
    
    ai_points=$("$PARSER" parse "$workflow" | grep "^AI|")
    
    if [[ -z "$ai_points" ]]; then
        echo "No AI usage points defined."
        return
    fi
    
    echo "AI Usage Points:"
    while IFS='|' read -r _ trigger tool; do
        echo "  - $trigger: $tool"
    done <<< "$ai_points"
}

case "${1:-}" in
    run)
        shift
        workflow_name=""
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --dry-run)
                    DRY_RUN=true
                    ;;
                --verbose|-v)
                    VERBOSE=true
                    ;;
                --delay)
                    STEP_DELAY="$2"
                    shift
                    ;;
                -*)
                    echo "Unknown option: $1"
                    exit 1
                    ;;
                *)
                    workflow_name="$1"
                    ;;
            esac
            shift
        done
        if [[ -n "$workflow_name" ]]; then
            execute_workflow "$workflow_name"
        else
            echo "Usage: $0 run <workflow> [--dry-run] [--verbose] [--delay seconds]"
            exit 1
        fi
        ;;
    ai-points)
        shift
        [[ -z "$1" ]] && echo "Usage: $0 ai-points <workflow>" && exit 1
        show_ai_points "$1"
        ;;
    list)
        "$PARSER" list
        ;;
    show)
        shift
        [[ -z "$1" ]] && echo "Usage: $0 show <workflow>" && exit 1
        "$PARSER" show "$1"
        ;;
    validate)
        shift
        [[ -z "$1" ]] && echo "Usage: $0 validate <workflow>" && exit 1
        "$PARSER" validate "$1"
        ;;
    *)
        echo "Inari Workflow Executor"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  run <workflow>    Execute a workflow"
        echo "  list              List available workflows"
        echo "  show <workflow>   Show workflow details"
        echo "  validate          Validate a workflow"
        echo "  ai-points         Show AI usage points"
        echo ""
        echo "Options:"
        echo "  --dry-run         Preview steps without executing"
        echo "  --verbose, -v     Enable verbose output"
        echo "  --delay <sec>     Delay between steps"
        exit 1
        ;;
esac