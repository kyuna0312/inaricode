import React, { useCallback, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { resolve } from "node:path";
import type { InariConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { createLlmProvider } from "../llm/create-provider.js";
import { chatToolDefinitions } from "../llm/inari-tools.js";
import type { AgentHistoryItem, InariToolDefinition, LLMProvider } from "../llm/types.js";
import { createChatSystemPrompt, runAgentTurn } from "../agent/loop.js";
import type { ConfirmFn } from "../tools/engine-run.js";
import type { EmbeddingClient } from "../tools/embeddings-api.js";
import { loadSessionFile, saveSessionFile } from "../session/file-session.js";
import { cliPackageVersion } from "../pkg-meta.js";
import { inariLogoBannerCompact } from "./logo.js";
import { tr } from "../i18n/strings.js";
import { isExitCommand, isAffirmativeKey, isNegativeKey } from "../i18n/prompts.js";

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
  signal?: AbortSignal;
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
};

function ChatTuiInner(
  props: RunChatTuiOptions & Bootstrapped & { initialHistory: AgentHistoryItem[] },
) {
  const { exit } = useApp();
  const loc = props.cfg.locale;
  let header =
    inariLogoBannerCompact(cliPackageVersion(), loc) +
    tr(loc, "chatTuiTitle", { provider: props.cfg.provider, model: props.cfg.model }) +
    (props.readOnly ? tr(loc, "chatReadOnly") : "") +
    (props.useStream ? tr(loc, "chatStreaming") : tr(loc, "chatNoStream"));
  if (props.sessionPath) header += `\n${tr(loc, "chatSession", { path: props.sessionPath })}`;
  header += `\n${tr(loc, "chatRoot", { path: props.workspaceRoot })}\n${tr(loc, "chatHint")}\n`;

  const [transcript, setTranscript] = useState(header);
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

      setInput("");
      setBusy(true);
      setStreaming("");
      setTranscript((t) => `${t}\n> ${trimmed}\n`);

      const confirmFn = props.skipConfirm ? async () => true : makeConfirm();

      try {
        const { assistantText, history: next } = await runAgentTurn({
          workspaceRoot: props.workspaceRoot,
          provider: props.provider,
          tools: props.tools,
          systemPrompt: props.system,
          userText: trimmed,
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
        });
        setHistory(next);
        await persist(next);
        if (props.useStream) {
          setTranscript((t) => `${t}${assistantText}\n`);
          setStreaming("");
        } else {
          setTranscript((t) => `${t}${assistantText}\n`);
        }
      } catch (e) {
        setTranscript((t) => `${t}[error] ${String(e)}\n`);
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
    ],
  );

  if (confirmState) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text dimColor>
            {transcript}
            {streaming}
          </Text>
        </Box>
        <Text bold color="yellow">
          {tr(loc, "confirmTitle")} {confirmState.title}
        </Text>
        <Text>{confirmState.body}</Text>
        <Text dimColor>{tr(loc, "tuiConfirmYes")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>
          {transcript}
          {streaming}
        </Text>
      </Box>
      {busy ? (
        <Text color="cyan">{tr(loc, "tuiBusy")}</Text>
      ) : (
        <Box>
          <Text color="green">{"> "}</Text>
          <TextInput value={input} onChange={setInput} onSubmit={onSubmit} />
        </Box>
      )}
    </Box>
  );
}

export async function runChatTui(options: RunChatTuiOptions): Promise<void> {
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
  const sessionPath = options.sessionFile ? resolve(options.cwd, options.sessionFile) : null;
  const initialHistory: AgentHistoryItem[] = sessionPath
    ? await loadSessionFile(sessionPath)
    : [];

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
    />,
  );
  await waitUntilExit();
}
