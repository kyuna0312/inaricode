import type { Command } from "commander";
import { runMcpStdioServer } from "./stdio-mcp.js";
import type { MessageKey } from "../i18n/strings.js";
import { resolveWorkspaceRoot } from "../workspace-root.js";

type TranslateFn = (key: MessageKey, vars?: Record<string, string>) => string;

/** Register `inari mcp` — stdio MCP with read-only engine tools (Phase 7). */
export function registerMcpCommand(program: Command, tr: TranslateFn): void {
  program
    .command("mcp")
    .description(tr("cmdMcp"))
    .option("-r, --root <path>", tr("optMcpRoot"), "")
    .action(async (opts: { root: string }) => {
      const cwd = process.cwd();
      const workspaceRoot = resolveWorkspaceRoot(opts.root || undefined, cwd);
      await runMcpStdioServer({ workspaceRoot });
    });
}
