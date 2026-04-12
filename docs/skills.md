# Declarative skill packs (Phase 6)

**Skill packs** add **Markdown instructions** and a **tool allowlist** to `inari chat` without running arbitrary code. Layout and JSON Schema live under **[`packages/skills/`](../packages/skills/README.md)**.

## Enable in config

In **`inaricode.yaml`** (or **`inaricode.config.cjs`**):

```yaml
skills:
  packs:
    - ./packages/skills/examples/minimal-review
```

Paths are resolved relative to the directory that contains the config file (usually the project root). Each entry is either a folder containing **`skill.yaml`** (or **`skill.json`**) or a direct path to that manifest file.

## What changes in chat

- **System prompt** — Base InariCode instructions stay first; each pack appends its **`system_prompt_file`** body under a `## Declarative skill packs` section.
- **Tools** — The model only sees tools listed in the **union** of all packs’ **`tools_allow`** entries that are valid for the current session (e.g. `codebase_search` only if the sidecar is enabled). Unknown names are skipped with a note in **`inari doctor`**.
- **`/help`** — Optional **`slash_hints`** from manifests are printed after the built-in slash list.

## Commands

| Command | Purpose |
|---------|---------|
| **`inari skills list`** | Read **`skills.packs`** from config and validate each manifest (no API key required). |
| **`inari doctor`** | Shows active pack ids or load errors. |

## Beginner template

**`inari init --template beginner`** writes a **read-only** starter config with **`chatTheme: soft`** and shorter **`maxAgentSteps`**, plus comments pointing here and to **`packages/skills`**.

## Themes

**`chatTheme`** in config (REPL ANSI + TUI accents):

| Value | Effect |
|-------|--------|
| **`default`** | Existing palette. |
| **`soft`** | Muted 256-color REPL; Ink accents lean **blue**. |
| **`high_contrast`** | Brighter ANSI; Ink accents **magenta**. |

## See also

- **[`skill.manifest.schema.json`](../packages/skills/skill.manifest.schema.json)**
- Plan: **Phase 6** in **[`docs/plan/inari-code-plan.md`](plan/inari-code-plan.md)**
