#!/usr/bin/env bash
# Inari Code - Dev Workspace Session
# Starts a development tmux session with nvim, opencode, dev server, and tests

SESSION="inari-dev"
LAYOUT="${LAYOUT:-even-horizontal}"

start_session() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        echo "Session $SESSION already exists. Attaching..."
        tmux attach-session -t "$SESSION"
        return
    fi

    tmux new-session -d -s "$SESSION" -n "nvim"
    
    # Pane 1: nvim (LazyVim)
    tmux send-keys -t "$SESSION:0" "cd $(pwd)" C-m
    tmux send-keys -t "$SESSION:0" "nvim" C-m
    
    # Pane 2: OpenCode AI
    tmux split-window -h -t "$SESSION"
    tmux send-keys -t "$SESSION:0.1" "opencode" C-m
    
    # Pane 3: Dev server
    tmux split-window -v -t "$SESSION:0.1"
    tmux send-keys -t "$SESSION:0.2" "npm run dev" C-m
    
    # Pane 4: Test runner
    tmux select-pane -t "$SESSION:0.0"
    tmux split-window -v -t "$SESSION:0.0"
    tmux send-keys -t "$SESSION:0.3" "npm test --watch" C-m
    
    # Select layout
    tmux select-layout -t "$SESSION" "$LAYOUT"
    
    echo "Session $SESSION started. Use 'tmux attach -t $SESSION' to attach."
    tmux attach-session -t "$SESSION"
}

stop_session() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        tmux kill-session -t "$SESSION"
        echo "Session $SESSION terminated."
    else
        echo "Session $SESSION does not exist."
    fi
}

case "${1:-start}" in
    start) start_session ;;
    stop) stop_session ;;
    *) echo "Usage: $0 {start|stop}" ;;
esac