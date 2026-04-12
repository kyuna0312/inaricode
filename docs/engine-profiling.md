# Engine profiling budget (Rust `inaricode-engine`)

This doc closes the **P1 “profiling budget”** gate from [`docs/plan/inari-code-plan.md`](plan/inari-code-plan.md): when it is worth measuring grep/IO hot paths, how to do it, and when **not** to open the optional C++ / mmap track (see the plan’s **P3 decision gate**).

## When to profile

- Grep or large **read_file** paths feel slow on a **real** repo (not micro-benchmark fantasy).
- You have a **reproducible** workspace size (file count, approximate total bytes) and a **fixed** query or tool pattern.

## What to measure

- **Wall time** end-to-end for the operation (CLI/driver + engine subprocess or native IPC).
- Optionally, **where** time goes in the engine: Linux **`perf record`**, **`cargo flamegraph`** (dev dependency), or **`tokio-console`** only if you add async instrumentation.

Keep notes: hardware, **release** vs debug build, **`INARI_ENGINE_IPC`**, and whether the **ignore** files (`.gitignore`, `.inariignore`) match production use.

## Minimal reproducible run

1. Build release engine: **`yarn build:engine`** (or `cargo build --release --manifest-path packages/engine/Cargo.toml`).
2. Point **`INARI_ENGINE_PATH`** at `packages/engine/target/release/inaricode-engine` if needed.
3. Run the same **engine JSON** command (or **`inari chat`** tool round) twice after page cache warm-up, or use a small shell loop calling the binary with a fixed payload.

Example (engine only, synthetic — adjust `workspace` and `pattern`):

```bash
ENGINE=packages/engine/target/release/inaricode-engine
ROOT=/path/to/repo
/usr/bin/time -f '%e sec' "$ENGINE" <<'EOF'
{"id":"1","cmd":"grep","workspace":"'"$ROOT"'","payload":{"pattern":"TODO","max_matches":200}}
EOF
```

## Rust-first optimizations (before any C++)

Prefer, in order:

1. **Algorithm / fewer passes** — avoid redundant scans; keep semantics aligned with **ignore** rules.
2. **Buffer sizes and allocations** — fewer copies into JSON responses; cap outputs already enforced in tools.
3. **Optional `memmap2`** for very large **single-file** reads — only if profiling shows read syscalls dominating; respect max-size limits.

## Default outcome

Document findings in a PR or issue: either **“Rust changes sufficient”** or **“evidence for mmap/FFI”** with numbers. The **P3 mmap/cxx** path stays **closed** until the plan’s gate checklist is satisfied.

## Related

- [`docs/engine-platform.md`](engine-platform.md) — IPC modes and binaries.
- [`docs/plan/inari-code-plan.md`](plan/inari-code-plan.md) — phased roadmap and **P3 gate**.
