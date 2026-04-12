# Model Context Protocol (stdio)

`inari mcp` runs a **stdio** [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes read-only workspace tools backed by the InariCode Rust engine:

- `read_file`
- `list_dir`
- `grep`

## Usage

```bash
inari mcp
inari mcp --root /path/to/repo
```

Configure your MCP client to launch this command. Use `--root` so tool paths resolve against the correct workspace (default: current working directory).

## Logging

The agent chat loop can emit JSON lines to **stderr** when `INARI_LOG=json` is set (see Phase 7 observability). The MCP server itself uses stdout for the MCP protocol; keep client wiring so stderr is separate from the JSON-RPC stream.
