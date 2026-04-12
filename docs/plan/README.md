# InariCode planning docs

Canonical roadmap and architecture:

- **[`inari-code-plan.md`](./inari-code-plan.md)** — capabilities; **phases 4–8**; **P0–P3 backlog**; extensibility; ideas; non-goals; **Research-informed sequencing** (phase order vs [`../research/`](../research/README.md)).
- **[`TASKS.md`](./TASKS.md)** — short **checklist** (now / next / later) + repo maintenance; sync with the plan when you ship.
- **[`../packages/README.md`](../packages/README.md)** — index of **`packages/*`** (CLI, engine, **tasks**, **skills**, sidecar).
- **[`../v1-launch-and-social.md`](../v1-launch-and-social.md)** — v1 **release** and **social / community** notes (when you open-source).
- **[`../integrations/cursor.md`](../integrations/cursor.md)** — **Cursor** (local `.cursor/`, **`inari cursor`** API, MCP roadmap).
- **[`../research/README.md`](../research/README.md)** — agent-CLI **architecture notes**, **supply-chain** (maps, publish tarball), link to external educational archive for context only.
- **[`../engine-platform.md`](../engine-platform.md)** — engine **IPC**, **napi** targets, env vars.
- **[`../engine-profiling.md`](../engine-profiling.md)** — **when / how** to profile the Rust engine (P3 mmap gate).
- **[`../skills.md`](../skills.md)** — declarative **`skills.packs`**, **`inari skills list`**, **`chatTheme`**, beginner **init**.
- **[`../publishing.md`](../publishing.md)** — **npm publish** notes for maintainers.

The plan is a **decision log**: measurable “done” criteria, dependency order, and explicit non-goals. When you ship a feature, update the **At a glance** table, **Prioritized backlog**, and root **README** in one pass.
