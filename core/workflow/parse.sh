#!/usr/bin/env bash
# Inari Code - YAML Workflow Parser
# Parses workflow YAML files and outputs JSON for execution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW_DIR="${SCRIPT_DIR}/../../workflows"
USER_WORKFLOW_DIR="${HOME}/.inari-code/workflows"

parse_yaml_value() {
    local file="$1"
    local key="$2"
    
    grep "^${key}:" "$file" | head -1 | sed 's/^[^:]*: *//' | sed 's/^"//' | sed 's/"$//' | sed "s/^'//" | sed "s/'$//"
}

parse_steps() {
    local file="$1"
    local in_steps=false
    local step_name=""
    local step_command=""
    local step_desc=""
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        local trimmed
        trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')
        
        if [[ "$trimmed" == "steps:" ]]; then
            in_steps=true
            continue
        fi
        
        if [[ "$in_steps" == true ]]; then
            if [[ "$trimmed" == "- name: "* ]]; then
                if [[ -n "$step_name" ]]; then
                    echo "STEP|$step_name|$step_command|$step_desc"
                fi
                step_name="${trimmed#"- name: "}"
                step_command=""
                step_desc=""
            elif [[ "$trimmed" == command:* ]]; then
                step_command="${trimmed#command: }"
            elif [[ "$trimmed" == description:* ]]; then
                step_desc="${trimmed#description: }"
            elif [[ -z "$trimmed" ]]; then
                continue
            elif [[ "$trimmed" == ai_usage_points:* ]]; then
                in_steps=false
                if [[ -n "$step_name" ]]; then
                    echo "STEP|$step_name|$step_command|$step_desc"
                fi
            elif [[ ! "$trimmed" == -* ]]; then
                in_steps=false
                if [[ -n "$step_name" ]]; then
                    echo "STEP|$step_name|$step_command|$step_desc"
                fi
            fi
        fi
    done < "$file"
    
    if [[ -n "$step_name" ]]; then
        echo "STEP|$step_name|$step_command|$step_desc"
    fi
}

parse_ai_usage_points() {
    local file="$1"
    local in_ai=false
    local trigger=""
    local tool=""
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        local trimmed
        trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')
        
        if [[ "$trimmed" == "ai_usage_points:" ]]; then
            in_ai=true
            continue
        fi
        
        if [[ "$in_ai" == true ]]; then
            if [[ "$trimmed" == "- trigger: "* ]]; then
                trigger="${trimmed#"- trigger: "}"
            elif [[ "$trimmed" == "tool: "* ]]; then
                tool="${trimmed#"tool: "}"
                if [[ -n "$trigger" && -n "$tool" ]]; then
                    echo "AI|$trigger|$tool"
                fi
            elif [[ -z "$trimmed" ]]; then
                continue
            elif [[ ! "$trimmed" == -* ]]; then
                in_ai=false
            fi
        fi
    done < "$file"
}

find_workflow_file() {
    local workflow="$1"
    local wf=""
    
    if [[ -f "${USER_WORKFLOW_DIR}/${workflow}.yaml" ]]; then
        wf="${USER_WORKFLOW_DIR}/${workflow}.yaml"
    elif [[ -f "${WORKFLOW_DIR}/${workflow}.yaml" ]]; then
        wf="${WORKFLOW_DIR}/${workflow}.yaml"
    fi
    
    echo "$wf"
}

list_workflows() {
    local found=false
    
    for wf in "${USER_WORKFLOW_DIR}"/*.yaml; do
        if [[ -f "$wf" ]]; then
            basename "$wf" .yaml
            found=true
        fi
    done
    
    for wf in "${WORKFLOW_DIR}"/*.yaml; do
        if [[ -f "$wf" ]]; then
            name=$(basename "$wf" .yaml)
            if [[ ! -f "${USER_WORKFLOW_DIR}/${name}.yaml" ]]; then
                echo "$name"
            fi
            found=true
        fi
    done
    
    [[ "$found" == "false" ]] && return 1
}

validate_workflow() {
    local file="$1"
    local errors=0
    
    if [[ ! -f "$file" ]]; then
        echo "[ERR] Workflow file not found: $file"
        return 1
    fi
    
    local name
    name=$(parse_yaml_value "$file" "name")
    if [[ -z "$name" ]]; then
        echo "[ERR] Missing required field: name"
        errors=$((errors + 1))
    fi
    
    local description
    description=$(parse_yaml_value "$file" "description")
    if [[ -z "$description" ]]; then
        echo "[WARN] Missing recommended field: description"
    fi
    
    local steps
    steps=$(parse_steps "$file")
    if [[ -z "$steps" ]]; then
        echo "[WARN] No steps defined in workflow"
    fi
    
    if [[ $errors -gt 0 ]]; then
        return 1
    fi
    
    return 0
}

show_workflow() {
    local workflow="$1"
    local file
    file=$(find_workflow_file "$workflow")
    
    if [[ -z "$file" ]]; then
        echo "Workflow not found: $workflow"
        return 1
    fi
    
    echo "=== Workflow: $workflow ==="
    echo ""
    
    local name description
    name=$(parse_yaml_value "$file" "name")
    description=$(parse_yaml_value "$file" "description")
    
    echo "Name: $name"
    echo "Description: $description"
    echo ""
    echo "Steps:"
    
    local steps
    steps=$(parse_steps "$file")
    while IFS='|' read -r _ step_name step_command step_desc; do
        echo "  - $step_name"
        echo "    Command: $step_command"
        [[ -n "$step_desc" ]] && echo "    Description: $step_desc"
    done <<< "$steps"
    
    local ai_points
    ai_points=$(parse_ai_usage_points "$file")
    if [[ -n "$ai_points" ]]; then
        echo ""
        echo "AI Usage Points:"
        while IFS='|' read -r trigger tool; do
            echo "  - Trigger: $trigger -> Tool: $tool"
        done <<< "$ai_points"
    fi
}

case "${1:-}" in
    list)
        list_workflows
        ;;
    show)
        [[ -z "$2" ]] && echo "Usage: $0 show <workflow>" && exit 1
        show_workflow "$2"
        ;;
    validate)
        [[ -z "$2" ]] && echo "Usage: $0 validate <workflow>" && exit 1
        file=$(find_workflow_file "$2")
        validate_workflow "$file"
        ;;
    parse)
        [[ -z "$2" ]] && echo "Usage: $0 parse <workflow>" && exit 1
        file=$(find_workflow_file "$2")
        if [[ -z "$file" ]]; then
            echo "Workflow not found: $2"
            exit 1
        fi
        echo "NAME|$(parse_yaml_value "$file" "name")"
        echo "DESC|$(parse_yaml_value "$file" "description")"
        parse_steps "$file"
        parse_ai_usage_points "$file"
        ;;
    find)
        [[ -z "$2" ]] && echo "Usage: $0 find <workflow>" && exit 1
        find_workflow_file "$2"
        ;;
    *)
        echo "Usage: $0 {list|show|validate|parse|find} <workflow>"
        exit 1
        ;;
esac