import type { Command } from "commander";
import { cursorApiJson, cursorApiKey } from "./http.js";
import type { MessageKey } from "../i18n/strings.js";

type L = (key: MessageKey, vars?: Record<string, string>) => string;

function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

/** Register `inari cursor …` (Cursor Cloud Agents API). */
export function registerCursorCommand(program: Command, L: L): void {
  const cur = program.command("cursor").description(L("cmdCursor"));

  cur
    .command("me")
    .description("Verify API key (GET /v0/me)")
    .action(async () => {
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(await cursorApiJson("/v0/me"));
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });

  cur
    .command("agents")
    .description("List cloud agents (GET /v0/agents)")
    .option("-l, --limit <n>", "Max results (default 20, max 100)", "20")
    .option("-c, --cursor <token>", "Pagination cursor from previous response")
    .option("--pr-url <url>", "Filter by GitHub PR URL")
    .action(
      async (opts: { limit: string; cursor?: string; prUrl?: string }) => {
        if (!cursorApiKey()) {
          process.stderr.write(`${L("cursorKeyMissing")}\n`);
          process.exitCode = 1;
          return;
        }
        const q = new URLSearchParams();
        q.set("limit", opts.limit);
        if (opts.cursor) q.set("cursor", opts.cursor);
        if (opts.prUrl) q.set("prUrl", opts.prUrl);
        try {
          printJson(await cursorApiJson(`/v0/agents?${q.toString()}`));
        } catch (e) {
          process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
          process.exitCode = 1;
        }
      },
    );

  cur
    .command("status")
    .description("Agent status (GET /v0/agents/:id)")
    .argument("<id>", "Agent id, e.g. bc_abc123")
    .action(async (id: string) => {
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(await cursorApiJson(`/v0/agents/${encodeURIComponent(id)}`));
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });

  cur
    .command("conversation")
    .description("Agent conversation (GET /v0/agents/:id/conversation)")
    .argument("<id>", "Agent id")
    .action(async (id: string) => {
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(await cursorApiJson(`/v0/agents/${encodeURIComponent(id)}/conversation`));
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });

  cur
    .command("models")
    .description("List model ids for launch (GET /v0/models)")
    .action(async () => {
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(await cursorApiJson("/v0/models"));
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });

  cur
    .command("repos")
    .description("List GitHub repos visible to the key (GET /v0/repositories; heavily rate-limited)")
    .action(async () => {
      process.stderr.write(`${L("cursorReposWarn")}\n`);
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(await cursorApiJson("/v0/repositories"));
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });

  cur
    .command("launch")
    .description("Start a cloud agent (POST /v0/agents)")
    .requiredOption("--repository <url>", "GitHub repo URL, e.g. https://github.com/org/repo")
    .requiredOption("--prompt <text>", "Task instructions for the agent")
    .option("--ref <ref>", "Branch, tag, or commit (optional)")
    .option("--model <id>", 'Model id, or "default" (optional)')
    .option("--auto-pr", "Create PR when finished", false)
    .option("--branch-name <name>", "Custom branch name")
    .action(
      async (opts: {
        repository: string;
        prompt: string;
        ref?: string;
        model?: string;
        autoPr: boolean;
        branchName?: string;
      }) => {
        if (!cursorApiKey()) {
          process.stderr.write(`${L("cursorKeyMissing")}\n`);
          process.exitCode = 1;
          return;
        }
        const body: Record<string, unknown> = {
          prompt: { text: opts.prompt },
          source: { repository: opts.repository },
        };
        if (opts.ref) (body.source as Record<string, string>).ref = opts.ref;
        if (opts.model) body.model = opts.model;
        const target: Record<string, unknown> = {};
        if (opts.autoPr) target.autoCreatePr = true;
        if (opts.branchName) target.branchName = opts.branchName;
        if (Object.keys(target).length > 0) body.target = target;
        try {
          printJson(
            await cursorApiJson("/v0/agents", {
              method: "POST",
              body: JSON.stringify(body),
            }),
          );
        } catch (e) {
          process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
          process.exitCode = 1;
        }
      },
    );

  cur
    .command("followup")
    .description("Follow-up prompt on an agent (POST /v0/agents/:id/followup)")
    .argument("<id>", "Agent id")
    .requiredOption("--prompt <text>", "Follow-up instruction")
    .action(async (id: string, opts: { prompt: string }) => {
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(
          await cursorApiJson(`/v0/agents/${encodeURIComponent(id)}/followup`, {
            method: "POST",
            body: JSON.stringify({ prompt: { text: opts.prompt } }),
          }),
        );
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });

  cur
    .command("stop")
    .description("Stop a running agent (POST /v0/agents/:id/stop)")
    .argument("<id>", "Agent id")
    .action(async (id: string) => {
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(
          await cursorApiJson(`/v0/agents/${encodeURIComponent(id)}/stop`, {
            method: "POST",
          }),
        );
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });

  cur
    .command("delete")
    .description("Delete an agent permanently (DELETE /v0/agents/:id)")
    .argument("<id>", "Agent id")
    .action(async (id: string) => {
      if (!cursorApiKey()) {
        process.stderr.write(`${L("cursorKeyMissing")}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        printJson(
          await cursorApiJson(`/v0/agents/${encodeURIComponent(id)}`, {
            method: "DELETE",
          }),
        );
      } catch (e) {
        process.stderr.write(`${L("cursorApiFail", { detail: String(e) })}\n`);
        process.exitCode = 1;
      }
    });
}
