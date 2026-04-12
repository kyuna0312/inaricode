import * as readline from "node:readline";
import { engineRequest, type EngineEnvelope } from "../engine/client.js";

const PROTOCOL_VERSION = "2024-11-05";

const READ_TOOLS = [
  {
    name: "read_file",
    description: "Read a UTF-8 file under the workspace (relative path).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        start_line: { type: "integer" },
        end_line: { type: "integer" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_dir",
    description: "List directory entries (non-recursive).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        max_entries: { type: "integer" },
      },
    },
  },
  {
    name: "grep",
    description: "Rust-regex search; respects .gitignore via engine.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        max_matches: { type: "integer" },
        path_prefix: { type: "string" },
      },
      required: ["pattern"],
    },
  },
];

function nextId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function textResult(s: string, isError = false): { content: { type: "text"; text: string }[]; isError: boolean } {
  return { content: [{ type: "text", text: s }], isError };
}

export type RunMcpStdioOptions = {
  workspaceRoot: string;
};

/**
 * Minimal MCP server over stdio (read-only engine tools). Phase 7 — Cursor / Claude Desktop experiments.
 */
export async function runMcpStdioServer(opts: RunMcpStdioOptions): Promise<void> {
  const workspace = opts.workspaceRoot;
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

  const exec = async (cmd: string, payload: Record<string, unknown>): Promise<string> => {
    const env: EngineEnvelope = {
      id: nextId(),
      cmd,
      workspace,
      payload,
    };
    const reply = await engineRequest(env);
    if (reply.ok) {
      return typeof reply.result === "string" ? reply.result : JSON.stringify(reply.result, null, 2);
    }
    return `Error: ${reply.error}`;
  };

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg: { jsonrpc?: string; id?: string | number; method?: string; params?: unknown };
    try {
      msg = JSON.parse(trimmed) as typeof msg;
    } catch {
      continue;
    }
    if (msg.jsonrpc !== "2.0") continue;

    const id = msg.id;
    const reply = (result: unknown) => {
      if (id === undefined) return;
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
    };
    const errReply = (code: number, message: string) => {
      if (id === undefined) return;
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code, message },
        })}\n`,
      );
    };

    try {
      switch (msg.method) {
        case "initialize":
          reply({
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "inaricode-mcp", version: "0.1.0" },
          });
          break;
        case "notifications/initialized":
          break;
        case "tools/list":
          reply({ tools: READ_TOOLS });
          break;
        case "tools/call": {
          const p = msg.params as { name?: string; arguments?: Record<string, unknown> };
          const name = p?.name;
          const args = p?.arguments ?? {};
          if (name === "read_file") {
            const path = args.path;
            if (typeof path !== "string") {
              errReply(-32602, "read_file requires path");
              break;
            }
            const payload: Record<string, unknown> = { path };
            if (typeof args.start_line === "number") payload.start_line = args.start_line;
            if (typeof args.end_line === "number") payload.end_line = args.end_line;
            const out = await exec("read_file", payload);
            reply(textResult(out, out.startsWith("Error:")));
          } else if (name === "list_dir") {
            const payload: Record<string, unknown> = {
              path: typeof args.path === "string" ? args.path : ".",
            };
            if (typeof args.max_entries === "number") payload.max_entries = args.max_entries;
            const out = await exec("list_dir", payload);
            reply(textResult(out, out.startsWith("Error:")));
          } else if (name === "grep") {
            const pattern = args.pattern;
            if (typeof pattern !== "string") {
              errReply(-32602, "grep requires pattern");
              break;
            }
            const payload: Record<string, unknown> = { pattern };
            if (typeof args.max_matches === "number") payload.max_matches = args.max_matches;
            if (typeof args.path_prefix === "string") payload.path_prefix = args.path_prefix;
            const out = await exec("grep", payload);
            reply(textResult(out, out.startsWith("Error:")));
          } else {
            errReply(-32601, `unknown tool: ${String(name)}`);
          }
          break;
        }
        case "ping":
          reply({});
          break;
        default:
          errReply(-32601, `method not found: ${String(msg.method)}`);
      }
    } catch (e) {
      errReply(-32603, String(e));
    }
  }
}
