# `packages/tasks`

**Contributor tasks** and **repeatable checklists** (release prep, CI hygiene, migrations). This folder holds **structured templates**; the living checklist for roadmap work stays in **[`docs/plan/TASKS.md`](../docs/plan/TASKS.md)**.

## Layout

| Path | Purpose |
|------|---------|
| **`templates/`** | YAML (or Markdown) task definitions you can copy when onboarding or cutting a release. |

The CLI does **not** load these files yet. When **`inari tasks`** (or similar) exists, it should resolve packs from here, user config, or `$INARI_TASKS_PATH`.

## Conventions

- **File names:** `kebab-case.yaml` or `.md`.
- **Stable IDs:** use a short `id` field in YAML so scripts can reference tasks without renaming files.

## See also

- **[`docs/plan/TASKS.md`](../docs/plan/TASKS.md)** — day-to-day board.
- **[`docs/plan/inari-code-plan.md`](../docs/plan/inari-code-plan.md)** — phases and backlog.
