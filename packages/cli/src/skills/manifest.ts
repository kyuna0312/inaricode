import { z } from "zod";

/** Matches `packages/skills/skill.manifest.schema.json` (v0 + optional slash_hints). */
export const SkillManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be kebab-case"),
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  system_prompt_file: z.string().min(1),
  tools_allow: z.array(z.string().min(1)).min(1),
  slash_hints: z.array(z.string().min(1)).optional(),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;
