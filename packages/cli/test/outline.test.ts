import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../src/tools/embeddings-api.js";
import { extractSymbolOutline } from "../src/tools/symbol-outline.js";

describe("extractSymbolOutline", () => {
  it("finds TS exports", () => {
    const src = `export function foo() {}
export const bar = 1
class Local {}
`;
    const { symbols } = extractSymbolOutline("x.ts", src);
    const names = symbols.map((s) => s.name);
    expect(names).toContain("foo");
    expect(names).toContain("bar");
  });

  it("finds Python defs", () => {
    const src = "async def handle():\n  pass\nclass Box:\n  pass\n";
    const { symbols } = extractSymbolOutline("m.py", src);
    expect(symbols.some((s) => s.name === "handle")).toBe(true);
    expect(symbols.some((s) => s.name === "Box")).toBe(true);
  });
});

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
});
