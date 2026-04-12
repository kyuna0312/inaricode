# Cursor IDE + InariCode

Use **Cursor** to edit and navigate this repo, and **InariCode** (`inari`) in the terminal for a **sandboxed Rust engine**, **session files**, and **provider-agnostic** chat with repo tools.

## Open this repository

1. **File → Open Folder** and choose the `inaricode` clone.
2. Cursor loads **project rules** from **`.cursor/rules/`** (tracked in git) and **`AGENTS.md`** at the repo root.

## Agent rules shipped with the repo

| Source | Role |
|--------|------|
| **[`AGENTS.md`](../../AGENTS.md)** | Human + AI contributor expectations (TS strictness, lint, version line). |
| **[`.cursor/rules/inaricode-typescript.mdc`](../../.cursor/rules/inaricode-typescript.mdc)** | TypeScript / ESM / async conventions for `packages/cli`. |
| **[`.cursor/rules/cursor-and-inari.mdc`](../../.cursor/rules/cursor-and-inari.mdc)** | How Cursor and InariCode fit together (this integration). |

Enable **Rules** / **Project rules** in Cursor settings if they are not applied automatically.

## Terminal inside Cursor

- **Integrated terminal**: `` Ctrl+` `` (or **View → Terminal**).
- From the **repo root**, after `yarn install` and `yarn build`:

  ```bash
  export INARI_ENGINE_IPC=subprocess   # optional; avoids napi build in dev
  yarn cli doctor
  yarn cli chat --root .
  ```

- Use **`yarn cli …`** so you do not need `inari` on global `PATH` (see root **README**).

## Suggested workflow

1. **Cursor** — multi-file edits, refactors, search, inline AI on selections.
2. **`inari chat` / `--tui`** — agent loop with **confirmed** writes, **grep**, **patch**, **shell policy**, and **session** JSON when you want the engine-backed tool loop on the same tree.

They complement each other: Cursor does not replace InariCode’s engine IPC or session format, and InariCode does not replace Cursor’s editor UX.

## Config and secrets

- Per-project **`inaricode.config.cjs`** (from **`yarn cli init`**) and **environment variables** for API keys — same as outside Cursor.
- Do **not** commit real keys. Use **`.env`** locally (gitignored) or your shell profile; Cursor inherits the integrated terminal’s environment.

## MCP (Model Context Protocol)

Exposing InariCode tools to Cursor via **MCP** is on the **[product plan](../plan/inari-code-plan.md)** (integrations phase). When an **`inari mcp`** or similar server exists, you will add it under **Cursor Settings → MCP** or project MCP config as documented in Cursor’s own docs.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| `inari: command not found` | From repo root use **`yarn cli …`** or **`./node_modules/.bin/inari`**. |
| Engine errors in **`doctor`** | `yarn build`, set **`INARI_ENGINE_IPC=subprocess`**, or set **`INARI_ENGINE_PATH`** to your `inaricode-engine` binary. |
| Rules not visible | Ensure **`.cursor/rules/*.mdc`** is present (clone latest); check Cursor **Rules** settings. |
