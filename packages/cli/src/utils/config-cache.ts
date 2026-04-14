/** Config cache layer: memoizes validated config with file-mtime invalidation. */

import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { InariConfig, RawInariConfig } from "../config.js";
import { loadRawInariConfig, resolveConfigFromRaw, applyInariEnvOverrides } from "../config.js";
import { inaricodeConfigSearchPlaces } from "../config-paths.js";

type CacheEntry = {
  config: InariConfig;
  raw: RawInariConfig;
  /** Epoch ms of the newest config file stat */
  mtimeMs: number;
  /** Config file path that was cached */
  configPath: string | null;
};

let cache: CacheEntry | null = null;

async function getNewestConfigFileMtime(searchFrom: string): Promise<{ mtimeMs: number; path: string | null }> {
  const places = inaricodeConfigSearchPlaces();
  let newest = 0;
  let foundPath: string | null = null;
  for (const place of places) {
    try {
      const fullPath = resolve(searchFrom, place);
      const s = await stat(fullPath);
      if (s.mtimeMs > newest) {
        newest = s.mtimeMs;
        foundPath = fullPath;
      }
    } catch {
      // File doesn't exist, skip
    }
  }
  return { mtimeMs: newest, path: foundPath };
}

/**
 * Load config with disk-cache invalidation. Re-parses only when a config file changes.
 * Env overrides (INARI_PROVIDER, etc.) are still applied on every call.
 */
export async function loadCachedConfig(searchFrom: string): Promise<InariConfig> {
  const { mtimeMs, path } = await getNewestConfigFileMtime(searchFrom);

  // Cache hit: return if files haven't changed
  if (cache && cache.configPath === path && cache.mtimeMs === mtimeMs) {
    // Env overrides still apply (user might have changed env between calls)
    const rawWithEnv = applyInariEnvOverrides(cache.raw);
    return resolveConfigFromRaw(rawWithEnv);
  }

  // Cache miss or stale: reload from disk
  const raw = await loadRawInariConfig(searchFrom);
  const config = resolveConfigFromRaw(applyInariEnvOverrides(raw));

  cache = { config, raw, mtimeMs, configPath: path };
  return config;
}

/** Force cache invalidation (e.g., after `inari init` writes new config). */
export function invalidateConfigCache(): void {
  cache = null;
}
