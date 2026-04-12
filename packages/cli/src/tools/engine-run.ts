import { z } from "zod";
import { engineRequest, type EngineEnvelope } from "../engine/client.js";
import { assertShellAllowed, type ResolvedShellPolicy } from "../policy/shell.js";
import { MUTATING_TOOL_NAMES } from "../llm/inari-tools.js";
import { sidecarRpc } from "../sidecar/client.js";
import type { EmbeddingClient } from "./embeddings-api.js";
import { redactToolOutput } from "./redact.js";
import { runSemanticCodebaseSearch } from "./semantic-search.js";
import { extractSymbolOutline } from "./symbol-outline.js";

const readFileSchema = z.object({
  path: z.string().min(1),
  start_line: z.number().int().positive().optional(),
  end_line: z.number().int().positive().optional(),
});

const writeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const listDirSchema = z.object({
  path: z.string().optional(),
  max_entries: z.number().int().positive().optional(),
});

const grepSchema = z.object({
  pattern: z.string().min(1),
  max_matches: z.number().int().positive().optional(),
  path_prefix: z.string().optional(),
});

const searchReplaceSchema = z.object({
  path: z.string().min(1),
  old_string: z.string(),
  new_string: z.string(),
  replace_all: z.boolean().optional(),
});

const runCmdSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  timeout_ms: z.number().int().positive().optional(),
});

const applyPatchSchema = z.object({
  path: z.string().min(1),
  unified_diff: z.string().min(1).max(512 * 1024),
});

const codebaseSearchSchema = z.object({
  query: z.string().min(1),
  max_results: z.number().int().positive().max(50).optional(),
  max_files: z.number().int().positive().max(10_000).optional(),
});

const semanticCodebaseSearchSchema = z.object({
  query: z.string().min(1),
  max_results: z.number().int().positive().max(50).optional(),
  max_files: z.number().int().positive().max(5000).optional(),
  refresh_index: z.boolean().optional(),
});

const symbolOutlineSchema = z.object({
  path: z.string().min(1),
});

export type ConfirmFn = (detail: { title: string; body: string }) => Promise<boolean>;

let requestSeq = 0;
function nextId(): string {
  requestSeq += 1;
  return `t-${Date.now()}-${requestSeq}`;
}

export async function runEngineTool(params: {
  workspaceRoot: string;
  name: string;
  input: unknown;
  confirm: ConfirmFn;
  skipConfirm: boolean;
  readOnly: boolean;
  shellPolicy: ResolvedShellPolicy;
  sidecarArgv: string[] | null;
  embeddingClient: EmbeddingClient | null;
  signal?: AbortSignal;
}): Promise<string> {
  return redactToolOutput(await runEngineToolInner(params));
}

async function runEngineToolInner(params: {
  workspaceRoot: string;
  name: string;
  input: unknown;
  confirm: ConfirmFn;
  skipConfirm: boolean;
  readOnly: boolean;
  shellPolicy: ResolvedShellPolicy;
  sidecarArgv: string[] | null;
  embeddingClient: EmbeddingClient | null;
  signal?: AbortSignal;
}): Promise<string> {
  const {
    workspaceRoot,
    name,
    input,
    confirm,
    skipConfirm,
    readOnly,
    shellPolicy,
    sidecarArgv,
    embeddingClient,
    signal,
  } = params;

  if (readOnly && MUTATING_TOOL_NAMES.has(name)) {
    return `Error: tool "${name}" is disabled in read-only mode.`;
  }

  const exec = async (cmd: string, payload: Record<string, unknown>) => {
    const env: EngineEnvelope = {
      id: nextId(),
      cmd,
      workspace: workspaceRoot,
      payload,
    };
    const reply = await engineRequest(env);
    if (reply.ok) {
      return JSON.stringify(reply.result, null, 2);
    }
    return `Error: ${reply.error}`;
  };

  if (name === "read_file") {
    const p = readFileSchema.parse(input);
    const payload: Record<string, unknown> = { path: p.path };
    if (p.start_line !== undefined) payload.start_line = p.start_line;
    if (p.end_line !== undefined) payload.end_line = p.end_line;
    return exec("read_file", payload);
  }
  if (name === "list_dir") {
    const p = listDirSchema.parse(input);
    const payload: Record<string, unknown> = { path: p.path ?? "." };
    if (p.max_entries !== undefined) payload.max_entries = p.max_entries;
    return exec("list_dir", payload);
  }
  if (name === "grep") {
    const p = grepSchema.parse(input);
    const payload: Record<string, unknown> = { pattern: p.pattern };
    if (p.max_matches !== undefined) payload.max_matches = p.max_matches;
    if (p.path_prefix !== undefined) payload.path_prefix = p.path_prefix;
    return exec("grep", payload);
  }
  if (name === "symbol_outline") {
    const p = symbolOutlineSchema.parse(input);
    const raw = await exec("read_file", { path: p.path });
    try {
      const data = JSON.parse(raw) as { content?: string };
      if (typeof data.content !== "string") {
        return "Error: symbol_outline: missing file content (file missing or too large?).";
      }
      const out = extractSymbolOutline(p.path, data.content);
      return JSON.stringify(out, null, 2);
    } catch (e) {
      return `Error: symbol_outline: ${String(e)}`;
    }
  }
  if (name === "write_file") {
    const p = writeFileSchema.parse(input);
    if (
      !skipConfirm &&
      !(await confirm({
        title: "write_file",
        body: `${p.path}\n---\n${truncate(p.content, 4000)}`,
      }))
    ) {
      return "User declined write_file.";
    }
    return exec("write_file", { path: p.path, content: p.content });
  }
  if (name === "search_replace") {
    const p = searchReplaceSchema.parse(input);
    if (
      !skipConfirm &&
      !(await confirm({
        title: "search_replace",
        body: `${p.path}\nold:\n${truncate(p.old_string, 2000)}\nnew:\n${truncate(p.new_string, 2000)}`,
      }))
    ) {
      return "User declined search_replace.";
    }
    const payload: Record<string, unknown> = {
      path: p.path,
      old_string: p.old_string,
      new_string: p.new_string,
    };
    if (p.replace_all !== undefined) payload.replace_all = p.replace_all;
    return exec("search_replace", payload);
  }
  if (name === "apply_patch") {
    const p = applyPatchSchema.parse(input);
    if (
      !skipConfirm &&
      !(await confirm({
        title: "apply_patch",
        body: `${p.path}\n---\n(unified diff preview)\n${truncate(p.unified_diff, 4000)}`,
      }))
    ) {
      return "User declined apply_patch.";
    }
    return exec("apply_patch", { path: p.path, unified_diff: p.unified_diff });
  }
  if (name === "run_terminal_cmd") {
    const p = runCmdSchema.parse(input);
    assertShellAllowed(p.command, shellPolicy);
    if (
      !skipConfirm &&
      !(await confirm({
        title: "run_terminal_cmd",
        body: `cwd: ${p.cwd ?? "."}\n${p.command}`,
      }))
    ) {
      return "User declined run_terminal_cmd.";
    }
    return exec("run_cmd", {
      command: p.command,
      cwd: p.cwd ?? ".",
      timeout_ms: p.timeout_ms,
    });
  }
  if (name === "codebase_search") {
    const p = codebaseSearchSchema.parse(input);
    if (!sidecarArgv) {
      return (
        "Error: codebase_search needs the Python sidecar. Set sidecar: { enabled: true } in inaricode config, " +
        "install pathspec (`pip install -r packages/sidecar/requirements.txt`), and ensure `python3` can run " +
        "packages/sidecar/inari_sidecar.py (or set sidecar.command / INARI_SIDECAR_CMD)."
      );
    }
    try {
      const result = await sidecarRpc(sidecarArgv, {
        id: nextId(),
        method: "codebase_search",
        params: {
          workspace: workspaceRoot,
          query: p.query,
          max_results: p.max_results,
          max_files: p.max_files,
        },
      });
      return JSON.stringify(result, null, 2);
    } catch (e) {
      return `Error: codebase_search sidecar failed: ${String(e)}`;
    }
  }
  if (name === "semantic_codebase_search") {
    const p = semanticCodebaseSearchSchema.parse(input);
    if (!embeddingClient) {
      return (
        "Error: semantic_codebase_search needs embeddings: { enabled: true } in config. " +
        "For provider anthropic, set OPENAI_API_KEY (or embeddings.apiKey) — default baseURL is https://api.openai.com/v1. " +
        "For OpenAI-compatible chat providers, embeddings reuse chat baseURL/apiKey unless overridden."
      );
    }
    try {
      const result = await runSemanticCodebaseSearch({
        workspaceRoot,
        client: embeddingClient,
        query: p.query,
        maxResults: p.max_results ?? 15,
        maxFiles: p.max_files ?? 500,
        refreshIndex: p.refresh_index ?? false,
        signal,
      });
      return JSON.stringify(result, null, 2);
    } catch (e) {
      return `Error: semantic_codebase_search failed: ${String(e)}`;
    }
  }

  return `Unknown tool: ${name}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated ${s.length - max} chars]`;
}
