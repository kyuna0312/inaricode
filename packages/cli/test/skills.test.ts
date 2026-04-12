import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadSkillPack } from "../src/skills/load-pack.js";
import { resolveSkillsContext } from "../src/skills/resolve-context.js";
import { knownChatToolNames, chatToolDefinitions, applySkillToolAllowlist } from "../src/llm/inari-tools.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const minimalReview = join(repoRoot, "packages/skills/examples/minimal-review");

describe("skills v1", () => {
  it("loads minimal-review example pack", async () => {
    const pack = await loadSkillPack(repoRoot, minimalReview);
    expect(pack.manifest.id).toBe("minimal-review");
    expect(pack.manifest.tools_allow).toContain("read_file");
    expect(pack.systemPrompt.length).toBeGreaterThan(0);
    expect(pack.manifest.slash_hints?.length).toBeGreaterThan(0);
  });

  it("merges allowlist and appendix", async () => {
    const known = knownChatToolNames({
      readOnly: false,
      includeCodebaseSearch: false,
      includeSemanticSearch: false,
    });
    const ctx = await resolveSkillsContext(repoRoot, [minimalReview], known);
    expect(ctx.packs).toHaveLength(1);
    expect(ctx.toolAllowlist?.has("read_file")).toBe(true);
    expect(ctx.toolAllowlist?.has("grep")).toBe(true);
    expect(ctx.systemPromptAppendix).toContain("minimal-review");
    const defs = chatToolDefinitions(false, false, false);
    const filtered = applySkillToolAllowlist(defs, ctx.toolAllowlist);
    expect(filtered.every((d) => ctx.toolAllowlist?.has(d.name))).toBe(true);
    expect(filtered.length).toBeLessThan(defs.length);
  });
});
