import { loadSkillPack, type LoadedSkillPack } from "./load-pack.js";

export type SkillLoadIssue = { path: string; message: string };

export type ResolvedSkillsContext = {
  packs: LoadedSkillPack[];
  issues: SkillLoadIssue[];
  /** Union of valid `tools_allow` entries; `null` = do not filter */
  toolAllowlist: Set<string> | null;
  systemPromptAppendix: string;
  slashHints: string[];
};

/**
 * Load all configured packs, merge prompts and slash hints, and build a tool allowlist
 * (union of each pack's `tools_allow`, intersected with `knownToolNames`).
 */
export async function resolveSkillsContext(
  cwd: string,
  packPaths: string[],
  knownToolNames: Set<string>,
): Promise<ResolvedSkillsContext> {
  if (packPaths.length === 0) {
    return { packs: [], issues: [], toolAllowlist: null, systemPromptAppendix: "", slashHints: [] };
  }

  const packs: LoadedSkillPack[] = [];
  const issues: SkillLoadIssue[] = [];

  for (const p of packPaths) {
    try {
      packs.push(await loadSkillPack(cwd, p));
    } catch (e) {
      issues.push({ path: p, message: String(e) });
    }
  }

  const mergedAllow = new Set<string>();
  const slashHints: string[] = [];
  const blocks: string[] = [];

  for (const pack of packs) {
    let unknown = 0;
    for (const t of pack.manifest.tools_allow) {
      if (knownToolNames.has(t)) mergedAllow.add(t);
      else unknown += 1;
    }
    if (unknown > 0) {
      issues.push({
        path: pack.manifest.id,
        message: `${unknown} tool name(s) in tools_allow are not available in this session (read-only / sidecar / embeddings) — ignored`,
      });
    }
    if (pack.manifest.slash_hints) {
      slashHints.push(...pack.manifest.slash_hints);
    }
    blocks.push(
      `### Skill pack: ${pack.manifest.name} (\`${pack.manifest.id}\` @ ${pack.manifest.version})\n\n${pack.systemPrompt}`,
    );
  }

  let toolAllowlist: Set<string> | null = null;
  if (packs.length > 0) {
    if (mergedAllow.size === 0) {
      issues.push({
        path: "(skills)",
        message: "no usable tools in tools_allow for this session — keeping full tool set",
      });
    } else {
      toolAllowlist = mergedAllow;
    }
  }

  const systemPromptAppendix =
    blocks.length > 0
      ? `\n\n## Declarative skill packs (YAML/Markdown only; no code execution)\n\n${blocks.join("\n\n---\n\n")}`
      : "";

  return { packs, issues, toolAllowlist, systemPromptAppendix, slashHints };
}
