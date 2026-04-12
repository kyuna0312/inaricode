/** Shared cosmiconfig search list for `inaricode` (config + locale discovery). */
export const INARICODE_CONFIG_SEARCH_PLACES = [
  "inaricode.yaml",
  "inaricode.yml",
  "inaricode.config.cjs",
  "inaricode.config.mjs",
  "inaricode.config.js",
  ".inaricoderc.json",
  ".inaricoderc.yaml",
  ".inaricoderc.yml",
] as const;

/** Optional workspace profile: `INARI_PROFILE` or `INARICODE_PROFILE` (alphanumeric + `_-` only). */
export function inariProfileFromEnv(): string | undefined {
  const raw = process.env.INARI_PROFILE?.trim() || process.env.INARICODE_PROFILE?.trim();
  if (!raw) return undefined;
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  return safe.length > 0 ? safe : undefined;
}

/**
 * Config file search order. With profile `work`, tries `inaricode.work.yaml` / `.yml` first
 * (Phase 7 — workspace profiles).
 */
export function inaricodeConfigSearchPlaces(): string[] {
  const p = inariProfileFromEnv();
  if (!p) return [...INARICODE_CONFIG_SEARCH_PLACES];
  return [`inaricode.${p}.yaml`, `inaricode.${p}.yml`, ...INARICODE_CONFIG_SEARCH_PLACES];
}
