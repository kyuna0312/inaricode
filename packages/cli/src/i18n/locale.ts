import { cosmiconfig } from "cosmiconfig";
import { inaricodeConfigSearchPlaces } from "../config-paths.js";

export type Locale = "en" | "mn";

/** INARI_LANG=en|mn, or one-shot override. */
export function parseLocaleOverride(v: string | undefined): Locale | null {
  const x = v?.trim().toLowerCase();
  if (x === "mn" || x === "mon" || x === "mongolian" || x === "монгол") return "mn";
  if (x === "en" || x === "eng" || x === "english") return "en";
  return null;
}

export function localeFromEnv(): Locale | null {
  return parseLocaleOverride(process.env.INARI_LANG);
}

/**
 * Priority: INARI_LANG → config `locale` → LANG (mn*) → en.
 * Used before Commander runs (`--help`, subcommand descriptions).
 */
export async function loadLocalePreference(searchFrom: string): Promise<Locale> {
  const env = localeFromEnv();
  if (env) return env;
  try {
    const explorer = cosmiconfig("inaricode", {
      searchPlaces: inaricodeConfigSearchPlaces(),
    });
    const found = await explorer.search(searchFrom);
    const raw = found?.config as { locale?: string } | undefined;
    const c = parseLocaleOverride(raw?.locale);
    if (c) return c;
    if (raw?.locale === "mn" || raw?.locale === "en") return raw.locale;
  } catch {
    /* ignore */
  }
  const lang = (process.env.LANG ?? "").toLowerCase();
  if (lang.startsWith("mn")) return "mn";
  return "en";
}
