import { useCallback, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { resolve } from "node:path";
import type { InariConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { createLlmProvider } from "../llm/create-provider.js";
import { applySkillToolAllowlist, chatToolDefinitions, knownChatToolNames } from "../llm/inari-tools.js";
import { resolveSkillsContext } from "../skills/resolve-context.js";
import type { AgentHistoryItem, InariToolDefinition, LLMProvider } from "../llm/types.js";
import { createChatSystemPrompt, runAgentTurn } from "../agent/loop.js";
import type { ConfirmFn } from "../tools/engine-run.js";
import type { EmbeddingClient } from "../tools/embeddings-api.js";
import { loadSessionFile, saveSessionFile } from "../session/file-session.js";
import { cliVersionLine } from "../pkg-meta.js";
import { tr } from "../i18n/strings.js";
import { isExitCommand, isAffirmativeKey, isNegativeKey } from "../i18n/prompts.js";
import { buildTuiChromeLines, tuiAccentColor } from "./chat-chrome.js";
import { handleChatSlashInput } from "./chat-slash.js";
import { getWorkspaceGitBranch } from "./git-branch.js";

type ConfirmState = {
  title: string;
  body: string;
  resolve: (ok: boolean) => void;
};

export type RunChatTuiOptions = {
  cwd: string;
  workspaceRoot: string;
  skipConfirm: boolean;
  sessionFile?: string;
  noStream: boolean;
  readOnlyCli: boolean;
  plainCli: boolean;
  signal?: AbortSignal;
  providerCli?: string;
  modelCli?: string;
};

type Bootstrapped = {
  cfg: InariConfig;
  provider: LLMProvider;
  system: string;
  readOnly: boolean;
  useStream: boolean;
  tools: InariToolDefinition[];
  sidecarArgv: string[] | null;
  embeddingClient: EmbeddingClient | null;
  sessionPath: string | null;
  gitBranch: string | null;
  plain: boolean;
  slashHelpExtra: string | undefined;
};

function ChatTuiInner(
  props: RunChatTuiOptions & Bootstrapped & { initialHistory: AgentHistoryItem[] },
) {
  const { exit } = useApp();
  const loc = props.cfg.locale;
  const plain = props.plain;
  const accent = tuiAccentColor(props.cfg.chatTheme, plain);

  const chrome = useMemo(
    () =>
      buildTuiChromeLines({
        locale: loc,
        version: cliVersionLine(),
        provider: props.cfg.provider,
        model: props.cfg.model,
        workspaceRoot: props.workspaceRoot,
        sessionPath: props.sessionPath,
        readOnly: props.readOnly,
        streaming: props.useStream,
        plain,
        gitBranch: props.gitBranch,
        chatTheme: props.cfg.chatTheme,
      }),
    [
      loc,
      props.cfg.provider,
      props.cfg.model,
      props.workspaceRoot,
      props.sessionPath,
      props.readOnly,
      props.useStream,
      plain,
      props.gitBranch,
      props.cfg.chatTheme,
    ],
  );

  const [transcript, setTranscript] = useState("");
  const [streaming, setStreaming] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [history, setHistory] = useState<AgentHistoryItem[]>(props.initialHistory);

  const persist = useCallback(
    async (next: AgentHistoryItem[]) => {
      if (props.sessionPath) await saveSessionFile(props.sessionPath, next);
    },
    [props.sessionPath],
  );

  const persistEmpty = useCallback(async () => {
    if (props.sessionPath) await saveSessionFile(props.sessionPath, []);
  }, [props.sessionPath]);

  const makeConfirm = useCallback((): ConfirmFn => {
    return ({ title, body }) =>
      new Promise((resolve) => {
        setConfirmState({ title, body, resolve });
      });
  }, []);

  useInput(
    (ch, key) => {
      if (!confirmState) return;
      if (isAffirmativeKey(ch, loc)) {
        confirmState.resolve(true);
        setConfirmState(null);
      } else if (isNegativeKey(ch, loc) || key.escape) {
        confirmState.resolve(false);
        setConfirmState(null);
      }
    },
    { isActive: Boolean(confirmState) },
  );

  const onSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || busy || confirmState) return;

      if (isExitCommand(trimmed, loc)) {
        await persist(history);
        exit();
        return;
      }

      const slash = await handleChatSlashInput({
        locale: loc,
        cwd: props.cwd,
        workspaceRoot: props.workspaceRoot,
        trimmed,
        getHistory: () => history,
        setHistory,
        persistHistory: persist,
        write: (s) => setTranscript((t) => t + s),
        persistEmpty,
        slashHelpExtra: props.slashHelpExtra,
      });
      if (slash.kind === "exit") {
        await persist(history);
        exit();
        return;
      }
      if (slash.kind === "again") {
        return;
      }

      const userText = slash.kind === "send" ? slash.text : trimmed;

      setInput("");
      setBusy(true);
      setStreaming("");
      const you = tr(loc, "chatReplYou");
      setTranscript((t) => `${t}\n${you} › ${userText}\n`);

      const confirmFn = props.skipConfirm ? async () => true : makeConfirm();

      try {
        const { assistantText, history: next } = await runAgentTurn({
          workspaceRoot: props.workspaceRoot,
          provider: props.provider,
          tools: props.tools,
          systemPrompt: props.system,
          userText,
          history,
          maxSteps: props.cfg.maxAgentSteps,
          maxHistoryItems: props.cfg.maxHistoryItems,
          confirm: confirmFn,
          skipConfirm: props.skipConfirm,
          readOnly: props.readOnly,
          shellPolicy: props.cfg.shellPolicy,
          sidecarArgv: props.sidecarArgv,
          embeddingClient: props.embeddingClient,
          streaming: props.useStream,
          onTextDelta: props.useStream ? (chunk: string) => setStreaming((s) => s + chunk) : undefined,
          signal: props.signal,
          summarization: props.cfg.summarization,
        });
        setHistory(next);
        await persist(next);
        setTranscript((t) => `${t}assistant\n${assistantText}\n`);
        setStreaming("");
      } catch (e) {
        setTranscript((t) => `${t}\n[error] ${String(e)}\n`);
        setStreaming("");
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      confirmState,
      exit,
      history,
      makeConfirm,
      persist,
      persistEmpty,
      loc,
      props.cfg.maxAgentSteps,
      props.cfg.maxHistoryItems,
      props.cfg.shellPolicy,
      props.sidecarArgv,
      props.embeddingClient,
      props.provider,
      props.readOnly,
      props.signal,
      props.skipConfirm,
      props.system,
      props.tools,
      props.useStream,
      props.workspaceRoot,
      props.cwd,
      props.slashHelpExtra,
    ],
  );

  const chromePanel = plain ? (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        {chrome.title} — {chrome.subtitle}
      </Text>
      <Text dimColor>{chrome.modelLine}</Text>
      <Text dimColor>{chrome.workspaceLine}</Text>
      {chrome.branchLine ? <Text dimColor>{chrome.branchLine}</Text> : null}
      {chrome.sessionLine ? <Text dimColor>{chrome.sessionLine}</Text> : null}
      <Text dimColor>{chrome.badges}</Text>
      <Text dimColor>{chrome.hint}</Text>
    </Box>
  ) : (
    <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Box>
        <Text bold color="white">
          {chrome.title}
        </Text>
        <Text dimColor> — </Text>
        <Text dimColor italic>
          {chrome.subtitle}
        </Text>
      </Box>
      <Text dimColor>{chrome.modelLine}</Text>
      <Text dimColor>{chrome.workspaceLine}</Text>
      {chrome.branchLine ? <Text dimColor>{chrome.branchLine}</Text> : null}
      {chrome.sessionLine ? <Text dimColor>{chrome.sessionLine}</Text> : null}
      <Text color={accent}>{chrome.badges}</Text>
      <Text dimColor>{chrome.hint}</Text>
    </Box>
  );

  if (confirmState) {
    const c = confirmState;
    const confirmBox = plain ? (
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
        <Text bold>
          {tr(loc, "confirmTitle")} {c.title}
        </Text>
        <Text>{c.body}</Text>
      </Box>
    ) : (
      <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={1} marginBottom={1}>
        <Text bold color="yellow">
          {tr(loc, "confirmTitle")} {c.title}
        </Text>
        <Text>{c.body}</Text>
      </Box>
    );
    return (
      <Box flexDirection="column">
        {chromePanel}
        <Box marginBottom={1}>
          <Text dimColor>
            {transcript}
            {streaming}
          </Text>
        </Box>
        {confirmBox}
        <Text dimColor>{tr(loc, "tuiConfirmYes")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {chromePanel}
      <Box marginBottom={1} flexDirection="column">
        <Text dimColor>{transcript}</Text>
        {streaming ? (
          <Box flexDirection="column">
            <Text dimColor>assistant</Text>
            <Text>{streaming}</Text>
          </Box>
        ) : null}
      </Box>
      {busy ? (
        plain ? (
          <Text dimColor>{tr(loc, "tuiBusy")}</Text>
        ) : (
          <Text color={accent}>{tr(loc, "tuiBusy")}</Text>
        )
      ) : (
        <Box>
          <Text color={plain ? undefined : "gray"}>{plain ? "> " : "› "}</Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={(value) => {
              void onSubmit(value);
            }}
          />
        </Box>
      )}
    </Box>
  );
}

export async function runChatTui(options: RunChatTuiOptions): Promise<void> {
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
  const sessionPath = options.sessionFile ? resolve(options.cwd, options.sessionFile) : null;
  const initialHistory: AgentHistoryItem[] = sessionPath
    ? await loadSessionFile(sessionPath)
    : [];
  const gitBranch = await getWorkspaceGitBranch(options.workspaceRoot);

  const { render } = await import("ink");
  const { waitUntilExit } = render(
    <ChatTuiInner
      {...options}
      cfg={cfg}
      provider={provider}
      system={system}
      readOnly={readOnly}
      useStream={useStream}
      tools={tools}
      sidecarArgv={sidecarArgv}
      embeddingClient={cfg.embeddings.client}
      sessionPath={sessionPath}
      initialHistory={initialHistory}
      gitBranch={gitBranch}
      plain={plain}
      slashHelpExtra={slashHelpExtra}
    />,
  );
  await waitUntilExit();
}
