/** zsh: eval "$(inari completion zsh)" */
export function renderZshCompletion(): string {
  return `_inari_cmd() {
  local -a cmds
  cmds=(chat cursor doctor init logo media pick providers completion)
  _describe -t commands 'inari command' cmds
}
compdef _inari_cmd inari
`;
}

/** fish: inari completion fish | source */
export function renderFishCompletion(): string {
  return `complete -c inari -f
complete -c inari -n "__fish_use_subcommand" -a chat -d "REPL agent chat"
complete -c inari -n "__fish_use_subcommand" -a doctor -d "Check engine and sidecar"
complete -c inari -n "__fish_use_subcommand" -a init -d "Write example config"
complete -c inari -n "__fish_use_subcommand" -a logo -d "ASCII banner"
complete -c inari -n "__fish_use_subcommand" -a media -d "Image / video helpers"
complete -c inari -n "__fish_use_subcommand" -a pick -d "Fuzzy file picker"
complete -c inari -n "__fish_use_subcommand" -a completion -d "Print shell completions"
complete -c inari -n "__fish_use_subcommand" -a providers -d "LLM provider catalog + Cursor"
complete -c inari -n "__fish_seen_subcommand_from providers" -a list -d "JSON catalog"
complete -c inari -n "__fish_seen_subcommand_from providers" -a show -d "Show one id"

complete -c inari -n "__fish_use_subcommand" -a cursor -d "Cursor Cloud API (CURSOR_API_KEY)"

complete -c inari -n "__fish_seen_subcommand_from cursor" -a me -d "Verify API key"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a agents -d "List cloud agents"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a models -d "List model ids"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a repos -d "List GitHub repos (slow)"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a launch -d "Start cloud agent"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a status -d "Agent status"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a conversation -d "Agent messages"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a followup -d "Agent follow-up"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a stop -d "Stop agent"
complete -c inari -n "__fish_seen_subcommand_from cursor" -a delete -d "Delete agent"

complete -c inari -n "__fish_seen_subcommand_from chat" -l provider -d "Override provider id" -r
complete -c inari -n "__fish_seen_subcommand_from chat" -l model -d "Override model id" -r
complete -c inari -n "__fish_seen_subcommand_from chat" -s r -l root -d "Workspace root" -r
complete -c inari -n "__fish_seen_subcommand_from chat" -s y -l yes -d "Skip confirms"
complete -c inari -n "__fish_seen_subcommand_from chat" -l session -d "Session file" -r
complete -c inari -n "__fish_seen_subcommand_from chat" -l no-stream -d "No streaming"
complete -c inari -n "__fish_seen_subcommand_from chat" -l read-only -d "Read-only tools"
complete -c inari -n "__fish_seen_subcommand_from chat" -l tui -d "Ink TUI"
complete -c inari -n "__fish_seen_subcommand_from chat" -l plain -d "Plain output"

complete -c inari -n "__fish_seen_subcommand_from media" -a image -d "Text-to-image"
complete -c inari -n "__fish_seen_subcommand_from media" -a video -d "Video note"

complete -c inari -n "__fish_seen_subcommand_from pick" -s r -l root -d "Workspace root" -r
complete -c inari -n "__fish_seen_subcommand_from pick" -l glob -d "Glob pattern" -r
complete -c inari -n "__fish_seen_subcommand_from pick" -l picker -d "builtin or fzf" -xa "builtin fzf"
`;
}

/** bash: eval "$(inari completion bash)" */
export function renderBashCompletion(): string {
  return `_inari() {
  local cur=\${COMP_WORDS[COMP_CWORD]}
  if [[ COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "chat cursor doctor init logo media pick providers completion" -- "$cur") )
    return
  fi
  case \${COMP_WORDS[1]} in
    chat)
      COMPREPLY=( $(compgen -W "--root --yes --session --no-stream --read-only --tui --plain --provider --model" -- "$cur") )
      ;;
    pick)
      COMPREPLY=( $(compgen -W "--root --glob --picker" -- "$cur") )
      ;;
    completion)
      COMPREPLY=( $(compgen -W "zsh fish bash" -- "$cur") )
      ;;
  esac
}
complete -F _inari inari
`;
}

export function renderCompletion(shell: string): string | null {
  switch (shell.toLowerCase()) {
    case "zsh":
      return renderZshCompletion();
    case "fish":
      return renderFishCompletion();
    case "bash":
      return renderBashCompletion();
    default:
      return null;
  }
}
