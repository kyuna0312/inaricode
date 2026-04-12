import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { createLlmProvider } from "../llm/create-provider.js";
import { chatToolDefinitions } from "../llm/inari-tools.js";
import type { AgentHistoryItem } from "../llm/types.js";
import { createChatSystemPrompt, runAgentTurn } from "../agent/loop.js";
import type { ConfirmFn } from "../tools/engine-run.js";
import { loadSessionFile, saveSessionFile } from "../session/file-session.js";
import { inariLogoBannerCompact } from "./logo.js";
import { cliPackageVersion } from "../pkg-meta.js";
import { tr } from "../i18n/strings.js";
import type { Locale } from "../i18n/locale.js";
import { isAffirmativeInput, isExitCommand } from "../i18n/prompts.js";

function createConfirm(rl: readline.Interface, locale: Locale): ConfirmFn {
  return async ({ title, body }) => {
    output.write(tr(locale, "confirmBlock", { title, body }) + tr(locale, "confirmPrompt"));
    const ans = await rl.question("");
    return isAffirmativeInput(ans, locale);
  };
}

export async function runChatRepl(options: {
  cwd: string;
  workspaceRoot: string;
  skipConfirm: boolean;
  sessionFile?: string;
  noStream: boolean;
  readOnlyCli: boolean;
  signal?: AbortSignal;
}): Promise<void> {
  const cfg = await loadConfig(options.cwd);
  const provider = createLlmProvider(cfg);
  const system = createChatSystemPrompt(options.workspaceRoot);
  const readOnly = cfg.readOnly || options.readOnlyCli;
  const useStream = cfg.streaming && !options.noStream;
  const sidecarArgv = cfg.sidecar.argv;
  const tools = chatToolDefinitions(
    readOnly,
    sidecarArgv !== null,
    cfg.embeddings.client !== null,
  );

  let history: AgentHistoryItem[] = options.sessionFile
    ? await loadSessionFile(resolve(options.cwd, options.sessionFile))
    : [];

  const rl = readline.createInterface({ input, output, terminal: true });
  const loc = cfg.locale;
  const confirm = createConfirm(rl, loc);

  const sessionPath = options.sessionFile ? resolve(options.cwd, options.sessionFile) : null;

  output.write(inariLogoBannerCompact(cliPackageVersion(), loc));
  let status =
    tr(loc, "chatTitle", { provider: cfg.provider, model: cfg.model }) +
    (readOnly ? tr(loc, "chatReadOnly") : "") +
    (useStream ? tr(loc, "chatStreaming") : tr(loc, "chatNoStream"));
  if (sessionPath) status += `\n${tr(loc, "chatSession", { path: sessionPath })}`;
  status += `\n${tr(loc, "chatRoot", { path: options.workspaceRoot })}\n${tr(loc, "chatHint")}\n`;
  output.write(status);

  const persist = async () => {
    if (sessionPath) await saveSessionFile(sessionPath, history);
  };

  try {
    while (true) {
      const line = await rl.question("\n> ");
      const trimmed = line.trim();
      if (isExitCommand(trimmed, loc)) break;
      if (!trimmed) continue;

      const { assistantText, history: next } = await runAgentTurn({
        workspaceRoot: options.workspaceRoot,
        provider,
        tools,
        systemPrompt: system,
        userText: trimmed,
        history,
        maxSteps: cfg.maxAgentSteps,
        maxHistoryItems: cfg.maxHistoryItems,
        confirm,
        skipConfirm: options.skipConfirm,
        readOnly,
        shellPolicy: cfg.shellPolicy,
        sidecarArgv,
        embeddingClient: cfg.embeddings.client,
        streaming: useStream,
        onTextDelta: useStream ? (chunk: string) => output.write(chunk) : undefined,
        signal: options.signal,
      });
      history = next;
      if (useStream) {
        output.write("\n");
      } else {
        output.write(`\n${assistantText}\n`);
      }
      await persist();
    }
  } finally {
    await persist();
    rl.close();
  }
}

export function resolveWorkspaceRoot(flag: string | undefined, cwd: string): string {
  return resolve(cwd, flag ?? ".");
}
