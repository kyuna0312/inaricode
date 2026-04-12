# Packages

| Directory | Kind | Notes |
|-----------|------|--------|
| **`cli/`** | Yarn workspace | TypeScript **`inari`** CLI → **`dist/`** after **`yarn build`**. |
| **`engine-native/`** | Yarn workspace | napi-rs native bindings (optional; CI often uses subprocess IPC). |
| **`engine/`** | Cargo crate | Rust **`inaricode-engine`** binary (not a Yarn workspace). |
| **`sidecar/`** | Python | Optional BM25 **`codebase_search`** helper. |
| **`tasks/`** | Content | Task templates and checklists for contributors / future automation — see **[`tasks/README.md`](./tasks/README.md)**. |
| **`skills/`** | Content | Declarative **skill pack** examples (prompt + tool hints) for future **`inari skills`** — see **[`skills/README.md`](./skills/README.md)**. |

Planning docs: **`docs/plan/`** (**[`TASKS.md`](../docs/plan/TASKS.md)**, **[`inari-code-plan.md`](../docs/plan/inari-code-plan.md)**). Research / architecture context: **`docs/research/`** (**[`README.md`](../docs/research/README.md)**).
