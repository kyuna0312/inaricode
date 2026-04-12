# Engine binary & IPC (platform matrix)

The CLI talks to **`inaricode-engine`** (Rust) for sandboxed filesystem, grep, patch, and subprocess work. Two transport modes exist; **native** is optional.

## IPC modes

| Mode | Set with | Behavior |
|------|----------|----------|
| **Auto** (default) | *(unset)* or any value other than `native` / `subprocess` | Prefer **`@inaricode/engine-native`** when the `.node` loads; otherwise spawn the **`inaricode-engine`** subprocess. |
| **Subprocess** | `INARI_ENGINE_IPC=subprocess` | Always spawn the **`inaricode-engine`** binary. Used in **CI** so contributors do not need **napi-rs** for every PR. |
| **Native** | `INARI_ENGINE_IPC=native` | Require the native addon; **fails** if **`yarn build:native`** was not run or the module does not load. |

## Build outputs

| Artifact | Command | Location (typical) |
|----------|---------|---------------------|
| **Engine binary** (debug) | `yarn build:engine:dev` or `cargo build --manifest-path packages/engine/Cargo.toml` | `packages/engine/target/debug/inaricode-engine` |
| **Engine binary** (release) | `yarn build:engine` | `packages/engine/target/release/inaricode-engine` |
| **Native addon** | `yarn build:native` | Built under **`packages/engine-native/`** (per **napi-rs** layout) |

## napi-rs prebuild targets

**`@inaricode/engine-native`** declares these **`napi.targets`** (from `packages/engine-native/package.json`):

- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `aarch64-apple-darwin`
- `x86_64-apple-darwin`
- `x86_64-pc-windows-msvc`

Other triples are **not** in the matrix today; use **`INARI_ENGINE_IPC=subprocess`** + a **manually built** engine binary, or extend the napi config when you add CI builds for more platforms.

## Environment variables

| Variable | Purpose |
|----------|---------|
| **`INARI_ENGINE_PATH`** | Absolute path to **`inaricode-engine`** when subprocess mode should not rely on **`PATH`**. |
| **`INARI_ENGINE_IPC`** | Omitted = **auto**; or **`subprocess`** \| **`native`** (see `packages/cli/src/engine/client.ts`). |

## Verify

After **`yarn build`** (engine dev + CLI):

```bash
yarn cli doctor
```

You should see **engine ipc: ok** and a line describing **engine transport** (native vs subprocess). If the native addon is missing, subprocess is normal once the **debug** binary exists.

See also: root **README** (engine section), **[`plan/inari-code-plan.md`](plan/inari-code-plan.md)** (Phase 4 / release). **CI** runs a **Linux** **`yarn workspace @inaricode/engine-native build`** smoke job; **macOS** / **Windows** prebuilds are not automated in-repo yet — extend the workflow matrix when you ship published native artifacts.
