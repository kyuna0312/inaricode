# Plugins — threat model and status (Phase 8)

InariCode does **not** load or execute third-party plugins today. The `plugins` key may appear in `inaricode.yaml` for forward compatibility only; setting `plugins.enabled: true` is rejected by config validation until a designed execution model exists.

## Why plugins are high risk

- **Arbitrary code**: Typical “plugin” systems run user-supplied JavaScript, WASM, or subprocesses. That is equivalent to running untrusted code with the user’s privileges.
- **Secrets**: Plugins can read environment variables, config files, and API keys available to the CLI process.
- **Filesystem and network**: Plugins can exfiltrate repository contents, modify files outside the workspace if policy allows, or call the network.
- **Supply chain**: A “marketplace” amplifies risk: compromised or typosquatted packages look like normal dependencies.

## Direction (non-goals for now)

- No plugin marketplace, auto-install, or remote registry is planned until there is an explicit security design (sandboxing, signing, capability model, review process).
- A long-running **daemon** or **telemetry** channel for plugins is out of scope for the current CLI architecture.

If you need extensibility today, prefer **declarative skill packs** (`skills.packs` — Markdown + YAML manifests) and **MCP** (`inari mcp`) so tools stay in separate processes with clear boundaries.
