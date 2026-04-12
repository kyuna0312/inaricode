import { createRequire } from "node:module";
import type { OutlineSymbol } from "./symbol-outline.js";

type SyntaxNode = {
  type: string;
  text: string;
  startPosition: { row: number };
  childForFieldName(name: string): SyntaxNode | null;
  descendantsOfType(types: string | string[]): SyntaxNode[];
};

/**
 * tree-sitter outline for TypeScript / JavaScript. Returns null if native addons
 * fail to load or the file is not a supported grammar.
 */
export function extractSymbolOutlineAst(filePath: string, content: string): OutlineSymbol[] | null {
  const ext = filePath.includes(".") ? (filePath.split(".").pop() ?? "").toLowerCase() : "";
  const useTsx = ext === "tsx" || ext === "jsx";
  const useTs = ext === "ts" || ext === "mts" || ext === "cts";
  const useJs = ext === "js" || ext === "mjs" || ext === "cjs";
  if (!useTsx && !useTs && !useJs) {
    return null;
  }

  try {
    const require = createRequire(import.meta.url);
    const Parser = require("tree-sitter") as new () => ParserInstance;
    const tsMod = require("tree-sitter-typescript") as { typescript: unknown; tsx: unknown };
    const jsLang = require("tree-sitter-javascript") as unknown;

    type ParserInstance = {
      setLanguage(lang: unknown): void;
      parse(input: string): { rootNode: SyntaxNode };
    };
    const parser = new Parser();
    if (useTsx) {
      parser.setLanguage(tsMod.tsx);
    } else if (useTs) {
      parser.setLanguage(tsMod.typescript);
    } else {
      parser.setLanguage(jsLang);
    }

    const tree = parser.parse(content);
    const root = tree.rootNode;
    const types = [
      "function_declaration",
      "generator_function_declaration",
      "class_declaration",
      "interface_declaration",
      "type_alias_declaration",
      "enum_declaration",
      "method_definition",
      "public_field_definition",
      "variable_declarator",
    ];
    const nodes = root.descendantsOfType(types);
    const symbols: OutlineSymbol[] = [];
    const seen = new Set<string>();

    const kindFor = (t: string): string => {
      if (t === "class_declaration") return "class";
      if (t === "interface_declaration") return "interface";
      if (t === "type_alias_declaration") return "type";
      if (t === "enum_declaration") return "enum";
      if (t === "method_definition" || t === "public_field_definition") return "member";
      if (t === "variable_declarator") return "variable";
      return "function";
    };

    for (const node of nodes) {
      const nameNode = node.childForFieldName("name");
      if (node.type === "variable_declarator" && nameNode && nameNode.type !== "identifier") {
        continue;
      }
      const name =
        nameNode &&
        (nameNode.type === "property_identifier" ||
          nameNode.type === "identifier" ||
          nameNode.type === "type_identifier")
          ? nameNode.text
          : null;
      if (!name) continue;
      const line = node.startPosition.row + 1;
      const key = `${line}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      symbols.push({ line, kind: kindFor(node.type), name });
    }

    symbols.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
    return symbols;
  } catch {
    return null;
  }
}
