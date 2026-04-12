# Agent & contributor notes

Short rules aligned with common **Linux / OSS** CLI practice (predictable tooling, strict types, CI parity).

## Cursor IDE

- Integration guide: **`docs/integrations/cursor.md`**. Shared rules live in **`.cursor/rules/`** (versioned); use **`yarn cli`** in Cursor’s terminal from the repo root.

## Release version line

- **`packages/cli/package.json`**: `version` is **semver** (`major.minor.patch`). The **patch** is the third number and is shown in the CLI banner.
- **Flower codename**: optional top-level **`"inaricode": { "codename": "Sakura" }`**. If omitted, a flower is picked **deterministically** from `version` via `src/release-flowers.ts` (same semver → same flower).
- **`inari --version`** and chat headers use **`cliVersionLine()`**: `vX.Y.Z · patch N · FlowerName`.

## TypeScript (`packages/cli`)

- **`strict: true`** plus **`noImplicitReturns`**, **`noFallthroughCasesInSwitch`**, **`noUnusedLocals`**, **`noUnusedParameters`** — keep `tsc` clean; use a leading **`_`** on intentionally unused parameters.
- **ES modules** only (`"type": "module"`, **`.js` extensions** in imports for Node resolution).
- Prefer **`const`**; avoid **non-null assertions (`!`)** unless unavoidable; prefer **`?.` / `??`** and narrow types.
- When rethrowing after **`catch`**, set **`error.cause`** when the caught value is an **`Error`** (see `sidecar/client.ts`, `embeddings-api.ts`).
- **React 17+ JSX**: do not import default **`React`** only for JSX; import named hooks only.

## Lint & verify

- Run **`yarn lint`** before pushing; **`yarn verify`** = lint + build + Vitest (see root `package.json`).
- ESLint uses **`typescript-eslint`** with **`packages/cli/tsconfig.eslint.json`** (includes **`test/`** for typed rules without changing **`dist/`** layout).

## Repo hygiene

- **Unix line endings (LF)**; trim trailing whitespace; UTF-8.
- Do not commit **`tsc` output** under `packages/cli/test/` — emit stays in **`dist/`** (ignored patterns in root `.gitignore`).

## Rust engine

- Keep **`cargo fmt`** / **`cargo clippy`** in mind for `packages/engine` (optional CI job per plan).
