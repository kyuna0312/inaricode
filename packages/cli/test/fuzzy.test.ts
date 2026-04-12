import { describe, expect, it } from "vitest";
import { filterFuzzySorted, fuzzyScore } from "../src/fuzzy/match.js";

describe("fuzzyScore", () => {
  it("matches ordered subsequence", () => {
    expect(fuzzyScore("abc", "a/b/c")).toBeGreaterThan(0);
    expect(fuzzyScore("xyz", "abc")).toBe(-1);
  });

  it("empty pattern matches", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
  });
});

describe("filterFuzzySorted", () => {
  it("sorts by score", () => {
    const items = ["zebra.tsx", "packages/cli/src/app.tsx", "app.tsx"];
    const out = filterFuzzySorted("apptx", items);
    expect(out[0]).toBe("app.tsx");
  });
});
