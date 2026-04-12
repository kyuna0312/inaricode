import { extractSymbolOutlineAst } from "./symbol-outline-ast.js";

export type OutlineSymbol = {
  line: number;
  kind: string;
  name: string;
};

/**
 * File outline for `symbol_outline`: **tree-sitter** for TypeScript / JavaScript (classes,
 * functions, interfaces, methods, …) when native grammars load; **regex** fallback for the
 * same extensions on failure and for **Python / Rust / Go** (and heuristic TS/JS lines).
 */
export function extractSymbolOutline(filePath: string, content: string): { symbols: OutlineSymbol[] } {
  const ast = extractSymbolOutlineAst(filePath, content);
  if (ast !== null && ast.length > 0) {
    return { symbols: ast };
  }
  return extractSymbolOutlineRegex(filePath, content);
}

function extractSymbolOutlineRegex(filePath: string, content: string): { symbols: OutlineSymbol[] } {
  const lines = content.split("\n");
  const ext = filePath.includes(".") ? (filePath.split(".").pop() ?? "").toLowerCase() : "";
  const symbols: OutlineSymbol[] = [];

  const push = (line: number, kind: string, name: string) => {
    if (name && !symbols.some((s) => s.line === line && s.name === name)) {
      symbols.push({ line, kind, name });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const n = i + 1;

    if (["ts", "tsx", "mts", "cts", "js", "cjs", "mjs", "jsx"].includes(ext)) {
      let m = line.match(/^\s*export\s+default\s+function\s+([A-Za-z0-9_$]+)/);
      if (m) {
        push(n, "function", m[1]);
        continue;
      }
      m = line.match(/^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
      if (m) {
        push(n, "function", m[1]);
        continue;
      }
      m = line.match(/^\s*export\s+(?:async\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/);
      if (m) {
        push(n, "variable", m[1]);
        continue;
      }
      m = line.match(/^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
      if (m) {
        push(n, "class", m[1]);
        continue;
      }
      m = line.match(/^\s*export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/);
      if (m) {
        push(n, "type", m[1]);
        continue;
      }
      m = line.match(/^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
      if (m) {
        push(n, "function", m[1]);
        continue;
      }
      m = line.match(/^\s*class\s+([A-Za-z0-9_$]+)/);
      if (m) {
        push(n, "class", m[1]);
        continue;
      }
    }

    if (ext === "py") {
      let m = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
      if (m) {
        push(n, "function", m[1]);
        continue;
      }
      m = line.match(/^\s*class\s+([A-Za-z0-9_]+)\s*(?:\(|:)/);
      if (m) {
        push(n, "class", m[1]);
        continue;
      }
    }

    if (ext === "rs") {
      let m = line.match(/^\s*pub\s+(?:async\s+)?fn\s+([A-Za-z0-9_]+)/);
      if (m) {
        push(n, "function", m[1]);
        continue;
      }
      m = line.match(/^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z0-9_]+)/);
      if (m) {
        push(n, "item", m[1]);
        continue;
      }
      m = line.match(/^\s*fn\s+([A-Za-z0-9_]+)\s*\(/);
      if (m) {
        push(n, "function", m[1]);
        continue;
      }
    }

    if (ext === "go") {
      const m = line.match(/^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (m) {
        push(n, "function", m[1]);
      }
    }
  }

  symbols.sort((a, b) => a.line - b.line);
  return { symbols };
}
