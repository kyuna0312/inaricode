# INARI CODE Development Plan

## Version 1.0 - Foundation (Month 1-2)

### Goals
- [x] Core installer with tmux, LazyVim, OpenCode integration
- [x] Basic workspaces: dev, debug, review, test
- [x] CLI with basic commands
- [x] AI keymaps for refactor/fix

### Timeline
| Week | Task | Status |
|------|------|--------|
| 1-2 | Bootstrap installer, tmux scripts | Done |
| 3-4 | LazyVim keymaps, CLI commands | Done |
| 5-6 | AI prompts, workflows | Done |
| 7-8 | Test, debug sessions | Done |

---

## Version 1.1 - Enhancement (Month 3-4)

### Goals
- [x] Enhanced CLI with status/config/list
- [x] Additional workspaces (review, test)
- [x] Configuration persistence

### New Features
```
inari status          # Show active sessions
inari config         # Show/set configuration
inari list          # List workflows
```

---

## Version 1.2 - Workflows (Month 5-6)

### Goals
- [ ] YAML workflow execution engine
- [x] Dev, refactor, debug workflows
- [ ] Custom workflow support

### Features
- Run workflows via `inari run <workflow>`
- Define custom workflows in `~/.inari-code/workflows/`
- AI usage points in workflows

### Timeline
| Week | Task |
|------|------|
| 9-10 | Workflow YAML parser |
| 11-12 | Custom workflow runner |
| 13-14 | Integration tests |
| 15-16 | Documentation |

---

## Version 2.0 - Features (Month 7-12)

### Planned Features

#### Month 7-8: AI Integration
- Multi-model support (Claude, GPT)
- Inline AI suggestions
- Code review automation

#### Month 9-10: Collaboration
- Session sharing
- Pair programming mode
- Shared memory

#### Month 11-12: Polish
- Plugin system
- Theme support
- Release v2.0

---

## Roadmap

```
v1.0 (Month 1-2)  ──►  v1.1 (Month 3-4)  ──►  v1.2 (Month 5-6)
     Foundation             Enhancement             Workflows
                              │
                              ▼
                      v2.0 (Month 7-12)
                           Features
```

---

## Contribution

1. Fork repository
2. Create feature branch
3. Submit PR

---

## Notes

- Keep minimal dependencies
- Focus on core functionality
- Maintain cross-platform compatibility
- Document breaking changes