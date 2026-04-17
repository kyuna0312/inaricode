import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { createLlmProvider } from "../llm/create-provider.js";
import { applySkillToolAllowlist, chatToolDefinitions, knownChatToolNames } from "../llm/inari-tools.js";
import { resolveSkillsContext } from "../skills/resolve-context.js";
import type { AgentHistoryItem } from "../llm/types.js";
import { createChatSystemPrompt, runAgentTurn } from "../agent/loop.js";
import type { ConfirmFn } from "../tools/engine-run.js";
import { loadSessionFile, saveSessionFile } from "../session/file-session.js";
import { cliVersionLine } from "../pkg-meta.js";
import { tr } from "../i18n/strings.js";
import type { Locale } from "../i18n/locale.js";
import { isAffirmativeInput, isExitCommand } from "../i18n/prompts.js";
import {
  formatReplSessionWelcome,
  replAssistantLead,
  replPrompt,
  replTurnSeparator,
  replUserBlock,
  useChatAnsi,
} from "./chat-chrome.js";
import { handleChatSlashInput } from "./chat-slash.js";
import { getWorkspaceGitBranch } from "./git-branch.js";
import { resolveWorkspaceRoot } from "../workspace-root.js";

export { resolveWorkspaceRoot };

function createConfirm(rl: readline.Interface, locale: Locale, plain: boolean): ConfirmFn {
  const ansi = useChatAnsi(plain);
  const dim = ansi ? "\x1b[2m" : "";
  const y = ansi ? "\x1b[33m" : "";
  const reset = ansi ? "\x1b[0m" : "";
  return async ({ title, body }) => {
    output.write(
      `\n${y}?${reset} ${dim}${title}${reset}\n${dim}${body.split("\n").join("\n")}${reset}\n${tr(locale, "confirmPrompt")}`,
    );
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
  plainCli: boolean;
  signal?: AbortSignal;
  /** Override config / env for this session (same as `inari chat --provider` / `--model`). */
  providerCli?: string;
  modelCli?: string;
}): Promise<void> {
  const plain = options.plainCli || process.env.INARI_PLAIN === "1";
  const cfg = await loadConfig(options.cwd, {
    provider: options.providerCli,
    model: options.modelCli,
  });
  const provider = createLlmProvider(cfg);
  const readOnly = cfg.readOnly || options.readOnlyCli;
  const useStream = cfg.streaming && !options.noStream;
  const sidecarArgv = cfg.sidecar.argv;
  const includeCodebaseSearch = sidecarArgv !== null;
  const includeSemanticSearch = cfg.embeddings.client !== null;
  const known = knownChatToolNames({
    readOnly,
    includeCodebaseSearch,
    includeSemanticSearch,
  });
  const skillsCtx = await resolveSkillsContext(options.cwd, cfg.skillPackPaths, known);
  let tools = chatToolDefinitions(readOnly, includeCodebaseSearch, includeSemanticSearch);
  tools = applySkillToolAllowlist(tools, skillsCtx.toolAllowlist);
  const system = createChatSystemPrompt(options.workspaceRoot, skillsCtx.systemPromptAppendix);
  const slashHelpExtra =
    skillsCtx.slashHints.length > 0
      ? `\nSkill hints:\n${skillsCtx.slashHints.map((l) => `  · ${l}`).join("\n")}\n`
      : undefined;

  let history: AgentHistoryItem[] = options.sessionFile
    ? await loadSessionFile(resolve(options.cwd, options.sessionFile))
    : [];

  const rl = readline.createInterface({ input, output, terminal: true });
  const loc = cfg.locale;
  const confirm = createConfirm(rl, loc, plain);

  const sessionPath = options.sessionFile ? resolve(options.cwd, options.sessionFile) : null;
  const gitBranch = await getWorkspaceGitBranch(options.workspaceRoot);

  output.write(
    formatReplSessionWelcome({
      locale: loc,
      version: cliVersionLine(),
      provider: cfg.provider,
      model: cfg.model,
      workspaceRoot: options.workspaceRoot,
      sessionPath,
      readOnly,
      streaming: useStream,
      plain,
      gitBranch,
      chatTheme: cfg.chatTheme,
    }),
  );

  const persist = async () => {
    if (sessionPath) await saveSessionFile(sessionPath, history);
  };

  const persistEmpty = async () => {
    if (sessionPath) await saveSessionFile(sessionPath, []);
  };

  try {
    while (true) {
      const line = await rl.question(replPrompt(plain, cfg.chatTheme));
      const trimmed = line.trim();
      if (isExitCommand(trimmed, loc)) break;
      if (!trimmed) continue;

      const slash = await handleChatSlashInput({
        locale: loc,
        cwd: options.cwd,
        workspaceRoot: options.workspaceRoot,
        trimmed,
        getHistory: () => history,
        setHistory: (h) => {
          history = h;
        },
        persistHistory: async (h) => {
          if (sessionPath) await saveSessionFile(sessionPath, h);
        },
        write: (s) => {
          output.write(s);
        },
        persistEmpty,
        slashHelpExtra,
      });
      if (slash.kind === "exit") break;
      if (slash.kind === "again") continue;

      const userText = slash.kind === "send" ? slash.text : trimmed;

      output.write(replUserBlock(loc, userText, plain, cfg.chatTheme));

      if (useStream) {
        output.write(replAssistantLead(plain, cfg.chatTheme));
      }

      const { assistantText, history: next } = await runAgentTurn({
        workspaceRoot: options.workspaceRoot,
        provider,
        tools,
        systemPrompt: system,
        userText,
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
        onTextDelta: useStream
          ? (chunk: string) => {
              output.write(chunk);
            }
          : undefined,
        signal: options.signal,
        summarization: cfg.summarization,
      });
      history = next;
      if (useStream) {
        output.write("\n");
      } else {
        output.write(`${replAssistantLead(plain, cfg.chatTheme)}${assistantText}\n`);
      }
      output.write(replTurnSeparator(plain, cfg.chatTheme));
      await persist();
    }
  } finally {
    await persist();
    rl.close();
  }
}
