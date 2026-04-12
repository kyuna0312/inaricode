# Example Cursor project rules (local copy)

**Do not commit** `.cursor/rules/` in this repository. Copy the sections below into your own **`.cursor/rules/*.mdc`** files if you want the same guidance locally.

---

## File: `cursor-and-inari.mdc` (optional `alwaysApply: true`)

```markdown
---
description: Cursor IDE + InariCode CLI — how they work together in this repo
alwaysApply: true
---

# Cursor + InariCode (this repository)

- **Cursor** — editor, Composer, inline AI, multi-file refactors.
- **InariCode** — terminal CLI (`yarn cli` from repo root): Rust-sandboxed **engine**, **sessions**, **chat** with tools (`grep`, `apply_patch`, etc.).

## Quick pointers

1. Read **`docs/integrations/cursor.md`** for setup (terminal, API env vars, troubleshooting).
2. Follow **`AGENTS.md`** for TypeScript, **`yarn lint`**, and **`yarn verify`** before finishing a change.
3. For CLI work, use **`yarn cli doctor`**, **`yarn cli chat`**, not a global **`inari`** unless you **`yarn link`** in `packages/cli`.

## Cursor API from CLI

With **`CURSOR_API_KEY`**, use **`yarn cli cursor me`**, **`agents`**, **`launch`**, etc. (see **`docs/integrations/cursor.md`**).
```

---

## File: `inaricode-typescript.mdc` (optional `globs` for TS only)

```markdown
---
description: Strict TypeScript and Linux-style OSS conventions for InariCode CLI
globs: packages/cli/**/*.ts,packages/cli/**/*.tsx
alwaysApply: false
---

# InariCode — TypeScript & project rules

Follow **`AGENTS.md`** at repo root. For **Cursor + this repo**, see **`docs/integrations/cursor.md`**. Summary for this codebase:

## Types

- Honor **`packages/cli/tsconfig.json`**: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- Unused parameters: prefix with **`_`** (e.g. `_opts`).
- Prefer **`const`**; use **`?.` / `??`** over **`!`** when possible.

## Modules & style

- ESM only; import paths end with **`.js`** (NodeNext).
- No default **`React`** import for JSX-only files; use named imports from **`react`**.

## Async & errors

- No **floating promises**; **`await`** only promises; for Ink/React handlers that expect void, use **`void promiseFn()`**.
- On rethrow from **`catch`**, attach **`cause`** if the caught value is an **`Error`**.

## Changes

- Match existing formatting (2 spaces, no drive-by reformat of unrelated files).
- After edits: **`yarn lint`** and **`yarn workspace @inaricode/cli exec tsc --noEmit`** (or **`yarn verify`**).
```
