/** zsh: eval "$(inari completion zsh)" — depth aligned with fish completions. */
export function renderZshCompletion(): string {
  return `_inari() {
  case \${CURRENT} in
    2)
      local -a cmds
      cmds=(
        'chat:REPL agent chat'
        'cursor:Cursor Cloud API'
        'doctor:Check engine and sidecar'
        'init:Write example config'
        'logo:ASCII banner'
        'mcp:Stdio MCP (read tools)'
        'media:Image and video helpers'
        'pick:Fuzzy file picker'
        'providers:LLM provider catalog'
        'skills:Declarative skill packs'
        'completion:Print shell completions'
      )
      _describe -t commands 'inari command' cmds
      ;;
    *)
      case \${words[2]} in
        chat)
          compset -n 2
          _arguments \\
            '--provider[Override provider id]' \\
            '--model[Override model id]' \\
            '(-r --root)'{-r,--root}'[Workspace root]:directory:_directories' \\
            '(-y --yes)'{-y,--yes}'[Skip confirms]' \\
            '--session[Session file]:files:_files' \\
            '--no-stream[Disable streaming]' \\
            '--read-only[Read-only tools]' \\
            '--tui[Ink TUI]' \\
            '--plain[Plain output]'
          ;;
        pick)
          compset -n 2
          _arguments \\
            '(-r --root)'{-r,--root}'[Workspace root]:directory:_directories' \\
            '--glob[Glob pattern]' \\
            '--picker[Picker implementation]: :(builtin fzf)'
          ;;
        mcp)
          compset -n 2
          _arguments '(-r --root)'{-r,--root}'[Workspace root]:directory:_directories'
          ;;
        providers)
          if (( CURRENT == 3 )); then
            _values 'providers subcommand' list show
          elif [[ \${words[3]} == list ]]; then
            compset -n 3
            _arguments '--plain[Tab-separated table instead of JSON]'
          elif [[ \${words[3]} == show ]] && (( CURRENT == 4 )); then
            _values 'provider id' anthropic openai ollama kimi qwen groq together huggingface google egune mongol_ai cursor custom
          fi
          ;;
        media)
          if (( CURRENT == 3 )); then
            _values 'media subcommand' image video
          elif [[ \${words[3]} == image ]]; then
            compset -n 3
            _arguments \\
              '(-p --prompt)'{-p,--prompt}'[Image prompt]' \\
              '(-o --output)'{-o,--output}'[Output file]:files:_files' \\
              '(-m --model)'{-m,--model}'[HF model id]' \\
              '--provider[Image backend]: :(huggingface google)' \\
              '--token[Override HF token]'
          fi
          ;;
        cursor)
          if (( CURRENT == 3 )); then
            _values 'cursor subcommand' me agents models repos launch status conversation followup stop delete
          else
            compset -n 3
            case \${words[3]} in
              agents)
                _arguments '--limit[Max results]' '--cursor[Pagination cursor]' '--pr-url[Filter by PR URL]'
                ;;
              launch)
                _arguments \\
                  '--repository[GitHub repo URL]' \\
                  '--prompt[Task instructions]' \\
                  '--ref[Branch tag or commit]' \\
                  '--model[Model id or default]' \\
                  '--auto-pr[Create PR when finished]' \\
                  '--branch-name[Custom branch name]'
                ;;
              followup)
                _arguments '--prompt[Follow-up instruction]'
                ;;
              status|conversation|stop|delete)
                _message 'agent id argument'
                ;;
            esac
          fi
          ;;
        completion)
          if (( CURRENT == 3 )); then
            _values 'shell' zsh fish bash
          fi
          ;;
        skills)
          if (( CURRENT == 3 )); then
            _values 'skills subcommand' list
          fi
          ;;
        init)
          compset -n 2
          _arguments \\
            '--format[Config format]: :(yaml cjs)' \\
            '--template[Config preset]: :(default beginner)'
          ;;
      esac
      ;;
  esac
}
compdef _inari inari
`;
}

/** fish: inari completion fish | source */
export function renderFishCompletion(): string {
  return `complete -c inari -f
complete -c inari -n "__fish_use_subcommand" -a chat -d "REPL agent chat"
complete -c inari -n "__fish_use_subcommand" -a doctor -d "Check engine and sidecar"
complete -c inari -n "__fish_use_subcommand" -a init -d "Write example config"
complete -c inari -n "__fish_use_subcommand" -a logo -d "ASCII banner"
complete -c inari -n "__fish_use_subcommand" -a mcp -d "Stdio MCP (engine tools)"
complete -c inari -n "__fish_use_subcommand" -a media -d "Image / video helpers"
complete -c inari -n "__fish_use_subcommand" -a pick -d "Fuzzy file picker"
complete -c inari -n "__fish_use_subcommand" -a skills -d "Declarative skill packs"
complete -c inari -n "__fish_use_subcommand" -a completion -d "Print shell completions"
complete -c inari -n "__fish_use_subcommand" -a providers -d "LLM provider catalog + Cursor"
complete -c inari -n "__fish_seen_subcommand_from providers" -a list -d "JSON catalog"
complete -c inari -n "__fish_seen_subcommand_from providers" -a show -d "Show one id"

complete -c inari -n "__fish_seen_subcommand_from skills" -a list -d "List packs from config"

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

complete -c inari -n "__fish_seen_subcommand_from mcp" -s r -l root -d "Workspace root" -r

complete -c inari -n "__fish_seen_subcommand_from init" -l format -d "yaml or cjs" -xa "yaml cjs"
complete -c inari -n "__fish_seen_subcommand_from init" -l template -d "default or beginner" -xa "default beginner"
`;
}

/** bash: eval "$(inari completion bash)" */
export function renderBashCompletion(): string {
  return `_inari() {
  local cur=\${COMP_WORDS[COMP_CWORD]}
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "chat cursor doctor init logo mcp media pick providers skills completion" -- "$cur") )
    return
  fi
  local cmd=\${COMP_WORDS[1]}
  if [[ \${COMP_CWORD} -eq 2 ]]; then
    case $cmd in
      cursor)
        COMPREPLY=( $(compgen -W "me agents models repos launch status conversation followup stop delete" -- "$cur") )
        ;;
      providers)
        COMPREPLY=( $(compgen -W "list show" -- "$cur") )
        ;;
      media)
        COMPREPLY=( $(compgen -W "image video" -- "$cur") )
        ;;
      completion)
        COMPREPLY=( $(compgen -W "zsh fish bash" -- "$cur") )
        ;;
      skills)
        COMPREPLY=( $(compgen -W "list" -- "$cur") )
        ;;
      *)
        ;;
    esac
    return
  fi
  case $cmd in
    init)
      COMPREPLY=( $(compgen -W "--format --template" -- "$cur") )
      ;;
    chat)
      COMPREPLY=( $(compgen -W "--root --yes --session --no-stream --read-only --tui --plain --provider --model" -- "$cur") )
      ;;
    pick)
      COMPREPLY=( $(compgen -W "--root --glob --picker" -- "$cur") )
      ;;
    mcp)
      COMPREPLY=( $(compgen -W "--root" -- "$cur") )
      ;;
    providers)
      if [[ \${COMP_WORDS[2]} == list ]]; then
        COMPREPLY=( $(compgen -W "--plain" -- "$cur") )
      fi
      ;;
    media)
      if [[ \${COMP_WORDS[2]} == image ]]; then
        COMPREPLY=( $(compgen -W "-p --prompt -o --output -m --model --provider --token" -- "$cur") )
      fi
      ;;
    cursor)
      local sub=\${COMP_WORDS[2]}
      case $sub in
        agents)
          COMPREPLY=( $(compgen -W "--limit --cursor --pr-url" -- "$cur") )
          ;;
        launch)
          COMPREPLY=( $(compgen -W "--repository --prompt --ref --model --auto-pr --branch-name" -- "$cur") )
          ;;
        followup)
          COMPREPLY=( $(compgen -W "--prompt" -- "$cur") )
          ;;
      esac
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
