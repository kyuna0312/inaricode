import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";
import { resolveShellPolicy, type ResolvedShellPolicy } from "./policy/shell.js";
import { resolveSidecarArgv } from "./sidecar/resolve.js";
import type { EmbeddingClient } from "./tools/embeddings-api.js";
import { INARICODE_CONFIG_SEARCH_PLACES } from "./config-paths.js";
import { localeFromEnv, type Locale } from "./i18n/locale.js";

export { INARICODE_CONFIG_SEARCH_PLACES };

export const ProviderIdSchema = z.enum([
  "anthropic",
  "openai",
  /** Moonshot / Kimi — OpenAI-compatible */
  "kimi",
  /** Alibaba DashScope compatible mode */
  "qwen",
  /** Local Ollama — OpenAI-compatible */
  "ollama",
  "groq",
  "together",
  /** Egune (Mongolia) — OpenAI-compatible; platform.egune.com */
  "egune",
  /** Same API as egune (common misspelling of “Egune”) */
  "eguna",
  /** Mongol AI — OpenAI-compatible; verify baseURL in vendor docs, override if needed */
  "mongol_ai",
  /** Hugging Face Inference Providers — OpenAI-compatible chat (router) */
  "huggingface",
  /** Google Gemini — OpenAI-compatible endpoint (Generative Language API) */
  "google",
  /** Any OpenAI-compatible HTTPS API — set baseURL */
  "custom",
]);

export type ProviderId = z.infer<typeof ProviderIdSchema>;

type OpenAiPreset = {
  baseURL: string;
  defaultModel: string;
  /** Env vars tried in order */
  envKeys: string[];
  /** If true, use placeholder key when none found (Ollama) */
  apiKeyOptional?: boolean;
};

/** Egune LLM API (also exposed as provider id `eguna`). */
const EGUNE_OPENAI_PRESET: OpenAiPreset = {
  baseURL: "https://platform.egune.com/v1",
  defaultModel: "egune-chat",
  envKeys: ["EGUNE_API_KEY", "EGUNA_API_KEY"],
};

const OPENAI_PRESETS: Record<Exclude<ProviderId, "anthropic">, OpenAiPreset> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    envKeys: ["OPENAI_API_KEY"],
  },
  kimi: {
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    envKeys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
  },
  qwen: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-turbo",
    envKeys: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
  },
  ollama: {
    baseURL: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2",
    envKeys: ["OLLAMA_API_KEY"],
    apiKeyOptional: true,
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    envKeys: ["GROQ_API_KEY"],
  },
  together: {
    baseURL: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    envKeys: ["TOGETHER_API_KEY"],
  },
  egune: EGUNE_OPENAI_PRESET,
  eguna: EGUNE_OPENAI_PRESET,
  mongol_ai: {
    baseURL: "https://api.mongol-ai.com/v1",
    defaultModel: "mongol-ai",
    envKeys: ["MONGOL_AI_API_KEY", "MONGOL_API_KEY"],
  },
  huggingface: {
    baseURL: "https://router.huggingface.co/v1",
    defaultModel: "meta-llama/Llama-3.2-3B-Instruct",
    envKeys: ["HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"],
  },
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    envKeys: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  },
  custom: {
    baseURL: "",
    defaultModel: "gpt-4o-mini",
    envKeys: ["OPENAI_API_KEY", "INARI_API_KEY", "AI_API_KEY"],
  },
};

const RawConfigSchema = z
  .object({
    provider: ProviderIdSchema.default("anthropic"),
    model: z.string().min(1).optional(),
    apiKey: z.string().optional(),
    /** Overrides preset base URL (required when provider is `custom`) */
    baseURL: z.string().url().optional(),
    maxAgentSteps: z.number().int().positive().max(200).optional().default(25),
    /** Stream assistant tokens to the terminal when supported */
    streaming: z.boolean().optional().default(true),
    /** Only read_file / list_dir / grep tools */
    readOnly: z.boolean().optional().default(false),
    /** Trim persisted / in-memory history to at most this many items */
    maxHistoryItems: z.number().int().positive().max(500).optional().default(100),
    shell: z
      .object({
        denySubstrings: z.array(z.string()).optional(),
        allowCommandPrefixes: z.array(z.string()).optional(),
      })
      .optional(),
    /** Optional Python sidecar for codebase_search (BM25). */
    sidecar: z
      .object({
        enabled: z.boolean().optional().default(false),
        /** argv string, e.g. `python3 /path/to/inari_sidecar.py` */
        command: z.string().optional(),
      })
      .optional(),
    /** OpenAI-compatible /embeddings for semantic_codebase_search (Phase 3+). */
    embeddings: z
      .object({
        enabled: z.boolean().optional().default(false),
        model: z.string().min(1).optional(),
        baseURL: z.string().url().optional(),
        apiKey: z.string().optional(),
      })
      .optional(),
    /** UI language: English or Mongolian (Cyrillic). Override with INARI_LANG. */
    locale: z.enum(["en", "mn"]).optional().default("en"),
    /** Fuzzy picker: built-in Ink UI or external fzf (fish/zsh-style). */
    picker: z
      .object({
        mode: z.enum(["builtin", "fzf"]).optional().default("builtin"),
        fzfPath: z.string().min(1).optional().default("fzf"),
        defaultFileGlob: z.string().min(1).optional().default("**/*"),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.provider === "custom" && !val.baseURL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'provider "custom" requires baseURL in config',
        path: ["baseURL"],
      });
    }
  });

export type InariConfig = {
  provider: ProviderId;
  model: string;
  apiKey: string;
  /** Set for OpenAI-compatible providers */
  baseURL: string;
  maxAgentSteps: number;
  streaming: boolean;
  readOnly: boolean;
  maxHistoryItems: number;
  shellPolicy: ResolvedShellPolicy;
  /** Python sidecar argv when enabled and resolved; null disables codebase_search tool */
  sidecar: { argv: string[] | null; enabledInConfig: boolean };
  /** Remote embeddings client; null disables semantic_codebase_search */
  embeddings: { client: EmbeddingClient | null };
  /** Effective UI locale (INARI_LANG overrides config file). */
  locale: Locale;
  /** Fuzzy file picker (`inari pick`). */
  picker: {
    mode: "builtin" | "fzf";
    fzfPath: string;
    defaultFileGlob: string;
  };
};

export async function writeExampleConfig(cwd: string, locale: Locale = "en"): Promise<string> {
  const path = join(cwd, "inaricode.config.cjs");
  const langLine =
    locale === "mn"
      ? `// Хэл: locale: 'mn' (Монгол) эсвэл INARI_LANG=mn — CLI, doctor, chat интерфэйс.\n`
      : `// Language: locale: 'mn' or INARI_LANG=mn for Mongolian UI (CLI, doctor, chat).\n`;
  const body = `// InariCode — API keys via env or apiKey below
// Release tag: packages/cli/package.json → version (semver), patch is the third number,
//   flower name: optional inaricode.codename, else derived from version (see src/release-flowers.ts).
${langLine}// Providers:
//   anthropic     → ANTHROPIC_API_KEY
//   openai        → OPENAI_API_KEY (ChatGPT)
//   kimi          → MOONSHOT_API_KEY or KIMI_API_KEY
//   qwen          → DASHSCOPE_API_KEY or QWEN_API_KEY (compatible mode)
//   ollama        → local Llama etc. (optional OLLAMA_API_KEY)
//   groq          → GROQ_API_KEY
//   together      → TOGETHER_API_KEY
//   egune / eguna → EGUNE_API_KEY or EGUNA_API_KEY (Egune platform, OpenAI-compatible)
//   mongol_ai     → MONGOL_AI_API_KEY (override baseURL if your dashboard shows a different URL)
//   huggingface   → HF_TOKEN or HUGGING_FACE_HUB_TOKEN (router OpenAI-compatible chat)
//   google        → GOOGLE_API_KEY or GEMINI_API_KEY (Gemini via OpenAI-compatible API)
//   custom        → baseURL + OPENAI_API_KEY / INARI_API_KEY / AI_API_KEY
//
// Multimodal: inari media image (Hugging Face text-to-image; HF_TOKEN). Text-to-video is not bundled yet.
//
// Optional: streaming (default true), readOnly, maxHistoryItems,
// shell: { denySubstrings: [], allowCommandPrefixes: ['git ','yarn '] }
// Optional Phase 3 sidecar: pip install -r packages/sidecar/requirements.txt then
//   sidecar: { enabled: true }  // or command: 'python3 /abs/path/inari_sidecar.py'
// Optional Phase 3+ semantic search: OpenAI-compatible /embeddings (uses OPENAI_API_KEY for Anthropic users by default)
//   embeddings: { enabled: true, model: 'text-embedding-3-small' }
// UI: locale 'en' | 'mn' (overridden by INARI_LANG)
// Picker (inari pick): picker: { mode: 'builtin' | 'fzf', fzfPath: 'fzf', defaultFileGlob: '**/*.{ts,tsx,js}' }
module.exports = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  locale: '${locale}',
  maxAgentSteps: 25,
  streaming: true,
  readOnly: false,
  maxHistoryItems: 100,
  // baseURL: 'https://example.com/v1',
  // apiKey: process.env.ANTHROPIC_API_KEY,
  // sidecar: { enabled: true },
  // embeddings: { enabled: true },
};
`;
  await writeFile(path, body, "utf8");
  return path;
}

function resolvedLocale(c: z.infer<typeof RawConfigSchema>): Locale {
  return localeFromEnv() ?? (c.locale === "mn" ? "mn" : "en");
}

function firstEnv(keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.length > 0) return v;
  }
  return undefined;
}

function pickerFromParsed(c: z.infer<typeof RawConfigSchema>): InariConfig["picker"] {
  const p = c.picker;
  return {
    mode: p?.mode === "fzf" ? "fzf" : "builtin",
    fzfPath: p?.fzfPath ?? "fzf",
    defaultFileGlob: p?.defaultFileGlob ?? "**/*",
  };
}

/** Picker only — no API keys required (for `inari pick`). */
export async function loadPickerSettings(searchFrom: string): Promise<InariConfig["picker"]> {
  const explorer = cosmiconfig("inaricode", {
    searchPlaces: [...INARICODE_CONFIG_SEARCH_PLACES],
  });
  const found = await explorer.search(searchFrom);
  const raw = (found?.config ?? {}) as Record<string, unknown>;
  const parsed = RawConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { mode: "builtin", fzfPath: "fzf", defaultFileGlob: "**/*" };
  }
  return pickerFromParsed(parsed.data);
}

function sidecarFromParsed(c: z.infer<typeof RawConfigSchema>): InariConfig["sidecar"] {
  const enabledInConfig = c.sidecar?.enabled ?? false;
  const argv = resolveSidecarArgv({
    enabled: enabledInConfig,
    command: c.sidecar?.command,
  });
  return { argv, enabledInConfig };
}

function defaultEmbeddingModel(provider: ProviderId): string {
  if (provider === "ollama") return "nomic-embed-text";
  return "text-embedding-3-small";
}

function embeddingsFromParsed(
  c: z.infer<typeof RawConfigSchema>,
  chat: { provider: ProviderId; baseURL: string; apiKey: string },
): InariConfig["embeddings"] {
  const emb = c.embeddings;
  if (!emb?.enabled) return { client: null };
  const model = emb.model ?? defaultEmbeddingModel(chat.provider);

  if (chat.provider === "anthropic") {
    const baseURL = (emb.baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const apiKey = emb.apiKey ?? firstEnv(["OPENAI_API_KEY", "INARI_EMBEDDING_API_KEY"]);
    if (!apiKey) return { client: null };
    return { client: { baseURL, apiKey, model } };
  }

  const baseURL = (emb.baseURL ?? chat.baseURL).replace(/\/$/, "");
  const apiKey = emb.apiKey ?? chat.apiKey;
  return { client: { baseURL, apiKey, model } };
}

/** For `inari doctor` without loading API keys — reads only `sidecar` from config. */
export async function loadSidecarDoctorInfo(searchFrom: string): Promise<InariConfig["sidecar"]> {
  const explorer = cosmiconfig("inaricode", {
    searchPlaces: [...INARICODE_CONFIG_SEARCH_PLACES],
  });
  const found = await explorer.search(searchFrom);
  const raw = (found?.config ?? {}) as Record<string, unknown>;
  const parsed = RawConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { argv: null, enabledInConfig: false };
  }
  return sidecarFromParsed(parsed.data);
}

export async function loadConfig(searchFrom: string): Promise<InariConfig> {
  const explorer = cosmiconfig("inaricode", {
    searchPlaces: [...INARICODE_CONFIG_SEARCH_PLACES],
  });
  const found = await explorer.search(searchFrom);
  const raw = (found?.config ?? {}) as Record<string, unknown>;
  const parsed = RawConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid inaricode config: ${msg}`);
  }
  const c = parsed.data;
  const shellPolicy = resolveShellPolicy(c.shell);
  const sidecar = sidecarFromParsed(c);
  const picker = pickerFromParsed(c);

  if (c.provider === "anthropic") {
    const model = c.model ?? "claude-sonnet-4-20250514";
    const apiKey = c.apiKey ?? firstEnv(["ANTHROPIC_API_KEY"]);
    if (!apiKey) {
      throw new Error("Missing API key: set apiKey or ANTHROPIC_API_KEY for provider anthropic");
    }
    const embeddings = embeddingsFromParsed(c, { provider: "anthropic", baseURL: "", apiKey });
    return {
      provider: "anthropic",
      model,
      apiKey,
      baseURL: "",
      maxAgentSteps: c.maxAgentSteps,
      streaming: c.streaming,
      readOnly: c.readOnly,
      maxHistoryItems: c.maxHistoryItems,
      shellPolicy,
      sidecar,
      embeddings,
      locale: resolvedLocale(c),
      picker,
    };
  }

  const preset = OPENAI_PRESETS[c.provider];
  const baseURL = (c.baseURL ?? preset.baseURL).replace(/\/$/, "");
  if (!baseURL) {
    throw new Error(`Missing baseURL for provider ${c.provider}`);
  }
  const model = c.model ?? preset.defaultModel;
  let apiKey = c.apiKey ?? firstEnv(preset.envKeys);
  if (!apiKey && preset.apiKeyOptional) {
    apiKey = "ollama";
  }
  if (!apiKey) {
    const hint = preset.envKeys.join(", ");
    throw new Error(
      `Missing API key for provider "${c.provider}": set apiKey in config or one of: ${hint}`,
    );
  }

  const embeddings = embeddingsFromParsed(c, { provider: c.provider, baseURL, apiKey });

  return {
    provider: c.provider,
    model,
    apiKey,
    baseURL,
    maxAgentSteps: c.maxAgentSteps,
    streaming: c.streaming,
    readOnly: c.readOnly,
    maxHistoryItems: c.maxHistoryItems,
    shellPolicy,
    sidecar,
    embeddings,
    locale: resolvedLocale(c),
    picker,
  };
}
