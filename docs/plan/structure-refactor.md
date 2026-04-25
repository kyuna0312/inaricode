---
name: InariCode Structure Refactor
overview: "Full refactor of inaricode package structure for better organization, maintainability, and onboarding clarity."
todos:
  - id: analyze-structure
    content: "Analyze current structure and create refactor plan"
    status: in_progress
  - id: split-config
    content: "Split config.ts into focused modules"
    status: pending
  - id: reorganize-dirs
    content: "Reorganize directories by domain"
    status: pending
  - id: add-index-files
    content: "Add barrel export files"
    status: pending
  - id: verify-build
    content: "Verify build and tests pass"
    status: pending
---

# InariCode Structure Refactor

## Current State

```
packages/cli/src/
├── cli.ts              (316 lines) - main CLI entry
├── config.ts          (778 lines) - ALL config (TOO BIG)
├── config-paths.ts    (29 lines)
├── opencode-client.ts (282 lines) - NEW
├── release-flowers.ts (72 lines)
├── workspace-root.ts (5 lines)
├── pkg-meta.ts       (80 lines)
├── agent/            - system-prompt, loop
├── completion/       - shell completions
├── cursor-api/       - Cursor integration
├── engine/          - IPC client
├── fuzzy/           - fuzzy matching
├── i18n/           - locale, strings, prompts
├── ide/             - neovim, tmux
├── llm/             - providers (anthropic, openai-compat)
├── mcp/             - MCP server (stdio)
├── media/           - hf-image, run-media
├── observability/   - json-log
├── pick/            - collect-files, fzf, run-pick
├── policy/          - shell policy
├── providers/       - catalog, run-providers-cli
├── session/         - file-session, compact-history, summarize
├── sidecar/         - resolve, client
├── skills/          - manifest, load-pack, resolve-context
├── tools/           - engine-run, redact, embeddings, semantic-search
└── ui/              - logo, chrome, repl, slash
```

## Problems Identified

1. **config.ts** - 778 lines, monolith handling:
   - Schema definitions
   - Config loading/resolution
   - Provider presets
   - Environment overrides
   - Type definitions

2. **llm/** vs **providers/** - overlapping concerns

3. **tools/** mixed with **engine/** - unclear boundaries

4. No barrel exports (index.ts)

5. Some folders have 1 file, some have 6

## Target Structure

```
packages/cli/src/
├── cli.ts                     # CLI entry (316 lines)
├── config/
│   ├── index.ts              # Barrel + main types
│   ├── schema.ts            # RawConfigSchema + ProviderIdSchema
│   ├── resolve.ts          # loadConfig + resolution logic
│   ├── presets.ts         # OPENAI_PRESETS
│   └── env.ts             # Environment overrides
├── config.ts                # Re-export for backward compat (alias)
├── config-paths.ts
├── opencode-client.ts
├── core/
│   ├── index.ts           # Re-exports
│   ├── types.ts          # InariConfig, LLMProvider, etc
│   └── constants.ts     # ANTHROPIC_DEFAULT_MODEL, etc
├── llm/
│   ├── index.ts           # Re-exports
│   ├── anthropic.ts
│   ├── openai-compatible.ts
│   ├── create-provider.ts
│   └── types.ts
├── runtime/
│   ├── index.ts
│   ├── engine-client.ts  # from engine/
│   ├── sidecar-client.ts # from sidecar/
│   └── embeddings.ts    # from tools/
├── agent/
│   ├── index.ts
│   ├── loop.ts         # from agent/loop
│   ���── system-prompt.ts
├── session/
│   ├── index.ts
│   ├── file-session.ts
│   ├── compact-history.ts
│   └── summarize.ts
├── ui/
│   ├── index.ts
│   ├── repl.ts
│   ├── tui.ts
│   └── components/ # logo, chrome, slash
├── pick/
│   ├── index.ts
│   ├── collect.ts
│   ├── fzf.ts
│   └── run.ts
├── skills/
├── i18n/
├── providers/   # Keep - catalog only
├── ide/       # Keep - neovim detection
├── mcp/      # Keep - MCP server impl
└── utils/
```

## Migration Strategy

1. **Backup first** - ensure no data loss
2. **Create new dirs** - before moving files
3. **Create barrel exports** - index.ts files
4. **Move files** - one logical group at a time
5. **Backward compat** - alias old paths
6. **Verify** - build + tests

## Files to Split (config.ts)

| Module | Content | New File |
|--------|---------|---------|
| ProviderIdSchema | Provider enum | config/schema.ts |
| OPENAI_PRESETS | Provider presets | config/presets.ts |
| RawConfigSchema | Full config schema | config/schema.ts |
| InariConfig | Resolved config type | core/types.ts |
| loadRawInariConfig | Config loading | config/resolve.ts |
| applyInariEnvOverrides | Env overrides | config/env.ts |
| ... | ... | ... |

## Backward Compatibility

Keep old paths as re-exports:
```ts
// config.ts (backward compat alias)
export * from "./config/index.js";
```

## Acceptance Criteria

- [ ] `yarn build` passes
- [ ] All existing imports still work (via aliases)
- [ ] No runtime behavior change
- [ ] Clearer directory structure
- [ ] Smaller focused files (max ~300 lines)