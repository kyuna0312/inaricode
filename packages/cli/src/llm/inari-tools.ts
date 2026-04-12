import type { InariToolDefinition } from "./types.js";

/** Tools that mutate disk or run shell — omitted in read-only mode. */
export const MUTATING_TOOL_NAMES = new Set([
  "write_file",
  "search_replace",
  "apply_patch",
  "run_terminal_cmd",
]);

export function selectToolsForMode(defs: InariToolDefinition[], readOnly: boolean): InariToolDefinition[] {
  if (!readOnly) return defs;
  return defs.filter((d) => !MUTATING_TOOL_NAMES.has(d.name));
}

/** BM25 keyword search via optional Python sidecar (Phase 3). */
export const CODEBASE_SEARCH_TOOL: InariToolDefinition = {
  name: "codebase_search",
  description:
    "Search the workspace for natural-language or keyword queries using BM25 ranking (Python sidecar). " +
    "Respects .inariignore when pathspec is installed. Use for broad ‘where is X?’ questions before narrow grep.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query (keywords or short phrase)" },
      max_results: { type: "integer", description: "Max snippets to return (default 12)" },
      max_files: { type: "integer", description: "Max files to index cap (default 1500)" },
    },
    required: ["query"],
  },
};

/** Vector / embedding search via OpenAI-compatible `/embeddings` (Phase 3+). */
export const SEMANTIC_CODEBASE_SEARCH_TOOL: InariToolDefinition = {
  name: "semantic_codebase_search",
  description:
    "Semantic search over the workspace using embedding cosine similarity (OpenAI-compatible /embeddings API). " +
    "Builds/updates a cache under .inaricode/semantic-cache-v1.json. Prefer for paraphrase / concept queries vs keyword BM25.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural-language query" },
      max_results: { type: "integer", description: "Max hits (default 15)" },
      max_files: { type: "integer", description: "Max source files to scan (default 500)" },
      refresh_index: {
        type: "boolean",
        description: "If true, drop cache and re-embed all scanned files (slow)",
      },
    },
    required: ["query"],
  },
};

export function chatToolDefinitions(
  readOnly: boolean,
  includeCodebaseSearch: boolean,
  includeSemanticSearch: boolean,
): InariToolDefinition[] {
  let defs: InariToolDefinition[] = [...INARI_TOOL_DEFINITIONS];
  if (includeCodebaseSearch) defs = [...defs, CODEBASE_SEARCH_TOOL];
  if (includeSemanticSearch) defs = [...defs, SEMANTIC_CODEBASE_SEARCH_TOOL];
  return selectToolsForMode(defs, readOnly);
}

/** Tool names the driver may expose after read-only / sidecar / embeddings toggles. */
export function knownChatToolNames(opts: {
  readOnly: boolean;
  includeCodebaseSearch: boolean;
  includeSemanticSearch: boolean;
}): Set<string> {
  return new Set(
    chatToolDefinitions(opts.readOnly, opts.includeCodebaseSearch, opts.includeSemanticSearch).map((d) => d.name),
  );
}

/** When skill packs are active, keep only tools listed in the merged allowlist. */
export function applySkillToolAllowlist(
  defs: InariToolDefinition[],
  allow: Set<string> | null,
): InariToolDefinition[] {
  if (!allow || allow.size === 0) return defs;
  return defs.filter((d) => allow.has(d.name));
}

/** Engine-backed tools (same JSON schema for Anthropic and OpenAI-compatible APIs). */
export const INARI_TOOL_DEFINITIONS: InariToolDefinition[] = [
  {
    name: "read_file",
    description:
      "Read a UTF-8 text file under the workspace. Optional 1-based line range via start_line / end_line.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace root" },
        start_line: { type: "integer", description: "First line (1-based), optional" },
        end_line: { type: "integer", description: "Last line inclusive (1-based), optional" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file under the workspace with the given UTF-8 content.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_dir",
    description: "List entries in a directory under the workspace (non-recursive).",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative directory path; default '.'" },
        max_entries: { type: "integer", description: "Max entries (default 500)" },
      },
    },
  },
  {
    name: "grep",
    description:
      "Search files under the workspace with a Rust regex pattern. Respects .gitignore via the engine.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Rust regex" },
        max_matches: { type: "integer" },
        path_prefix: { type: "string", description: "Only paths starting with this relative prefix" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "symbol_outline",
    description:
      "List symbols in a source file. TypeScript/JavaScript/TSX/JSX use tree-sitter when available (classes, functions, interfaces, methods, consts); Python, Rust, Go use line regex heuristics; TS/JS falls back to regex if parsing fails.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace root" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_replace",
    description:
      "Replace old_string with new_string in a file. Unless replace_all is true, old_string must match exactly once.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "apply_patch",
    description:
      "Apply a unified diff to an existing file under the workspace (single-file patch). File must exist; hunks must match current content.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file to patch" },
        unified_diff: { type: "string", description: "Unified diff (e.g. ---/+++ style) applying to that file" },
      },
      required: ["path", "unified_diff"],
    },
  },
  {
    name: "run_terminal_cmd",
    description:
      "Run a shell command with optional cwd relative to workspace. Subject to user approval in safe mode.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string", description: "Working directory relative to workspace; default '.'" },
        timeout_ms: { type: "integer" },
      },
      required: ["command"],
    },
  },
];
