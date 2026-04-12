# `packages/skills`

**Skill packs** = declarative bundles (system prompt + tool allowlist + optional slash hints) aligned with **[`docs/plan/inari-code-plan.md`](../docs/plan/inari-code-plan.md)** (Phase 6). **No arbitrary code** in v1 — YAML/JSON + Markdown only, validated at runtime with **Zod** (see **`packages/cli/src/skills/`**).

## Schema

- **`skill.manifest.schema.json`** — JSON Schema (draft 2020-12) for **`skill.yaml`** / **`skill.json`** manifests. Validate locally, e.g. `npx ajv-cli validate -s skill.manifest.schema.json -d examples/minimal-review/skill.yaml` (may require YAML→JSON conversion).

## Layout

| Path | Purpose |
|------|---------|
| **`examples/`** | Reference packs showing the intended on-disk shape. |

The CLI loads packs listed under **`skills.packs`** in **`inaricode.yaml`** / **`inaricode.config.cjs`** (paths relative to the config file). See **[`docs/skills.md`](../docs/skills.md)** and **`inari skills list`** / **`inari doctor`**.

## Conventions

- **One skill per folder** (recommended): `examples/my-skill/skill.yaml` + `prompt.md`.
- **IDs:** `kebab-case`, stable across versions.
- **Tools:** allowlist names that match Inari tool ids (`read_file`, `grep`, …).

## See also

- Plan section **Extensibility roadmap (skills · plugins · themes)**.
- **[`docs/plan/TASKS.md`](../docs/plan/TASKS.md)** — skills/plugin backlog items.
