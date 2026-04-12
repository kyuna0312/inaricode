# Extensions roadmap (Phase 8)

This document records **positioning** for extensibility features so expectations stay aligned with what the CLI actually ships.

| Topic | Status |
|--------|--------|
| **Declarative skills** | Shipped: `skills.packs` in config, YAML + Markdown packs. |
| **MCP** | Shipped: `inari mcp` stdio server for read-only engine tools. See [integrations/mcp.md](./integrations/mcp.md). |
| **Plugins (`plugins.enabled`)** | Schema placeholder only; `enabled: true` is rejected. See [plugins-threat-model.md](./plugins-threat-model.md). |
| **Plugin marketplace** | Not planned without a security and capability model. |
| **Background daemon** | Not part of the current CLI; sidecar remains optional for `codebase_search`. |
| **Built-in local embeddings service** | Optional OpenAI-compatible `embeddings` config; no separate bundled embedding daemon. |
| **Telemetry** | No usage telemetry from the CLI; `INARI_LOG=json` is opt-in debug logging to stderr. |
