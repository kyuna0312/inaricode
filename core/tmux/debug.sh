#!/usr/bin/env bash
# Inari Code - Debug Workspace Session
# Starts a debugging tmux session with logs, terminal, and nvim

SESSION="inari-debug"
LAYOUT="${LAYOUT:-even-horizontal}"

start_session() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        echo "Session $SESSION already exists. Attaching..."
        tmux attach-session -t "$SESSION"
        return
    fi

    tmux new-session -d -s "$SESSION" -n "logs"
    
    # Pane 1: Logs
    tmux send-keys -t "$SESSION:0" "tail -f logs/*.log 2>/dev/null || echo 'No logs found'" C-m
    
    # Pane 2: Terminal
    tmux split-window -h -t "$SESSION"
    tmux send-keys -t "$SESSION:0.1" "cd $(pwd)" C-m
    
    # Pane 3: nvim
    tmux split-window -v -t "$SESSION:0.1"
    tmux send-keys -t "$SESSION:0.2" "nvim" C-m
    
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