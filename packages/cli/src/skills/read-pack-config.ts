import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";
import { inaricodeConfigSearchPlaces } from "../config-paths.js";

const PacksOnlySchema = z.object({
  skills: z.object({ packs: z.array(z.string()).optional() }).optional(),
});

/** Read `skills.packs` without validating full inaricode config (no API keys). */
export async function loadSkillPackPathsFromConfig(searchFrom: string): Promise<string[]> {
  const explorer = cosmiconfig("inaricode", {
    searchPlaces: inaricodeConfigSearchPlaces(),
  });
  const found = await explorer.search(searchFrom);
  const p = PacksOnlySchema.safeParse(found?.config ?? {});
  if (!p.success) return [];
  return p.data.skills?.packs ?? [];
}
