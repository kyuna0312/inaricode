/** Deterministic flower codenames for releases (no extra deps). Alphabetized for stable diffs. */
export const RELEASE_FLOWERS: readonly string[] = [
  "Acacia",
  "Allium",
  "Amaryllis",
  "Anemone",
  "Azalea",
  "Begonia",
  "Bellflower",
  "Bergamot",
  "Bluebell",
  "Buttercup",
  "Camellia",
  "Carnation",
  "Chrysanthemum",
  "Clematis",
  "Clover",
  "Columbine",
  "Cornflower",
  "Cosmos",
  "Dahlia",
  "Daisy",
  "Delphinium",
  "Edelweiss",
  "Freesia",
  "Gardenia",
  "Geranium",
  "Heather",
  "Hibiscus",
  "Honeysuckle",
  "Hyacinth",
  "Hydrangea",
  "Iris",
  "Jasmine",
  "Lavender",
  "Lilac",
  "Lotus",
  "Magnolia",
  "Marigold",
  "Orchid",
  "Peony",
  "Petunia",
  "Poppy",
  "Primrose",
  "Rhododendron",
  "Rose",
  "Sakura",
  "Snapdragon",
  "Sunflower",
  "Sweet pea",
  "Tulip",
  "Verbena",
  "Violet",
  "Wisteria",
  "Zinnia",
] as const;

export type SemverParts = { major: number; minor: number; patch: number };

/** Parse leading X.Y.Z from semver strings (ignores prerelease suffix). */
export function parseSemverParts(version: string): SemverParts | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Stable flower index from semver (same version → same flower). */
export function flowerForSemver(parts: SemverParts): string {
  const n = parts.major * 10_007 + parts.minor * 1_009 + parts.patch;
  const idx = n % RELEASE_FLOWERS.length;
  return RELEASE_FLOWERS[idx] ?? "Bloom";
}
