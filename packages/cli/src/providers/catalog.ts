import type { ProviderId } from "../config.js";
import { ANTHROPIC_DEFAULT_MODEL, OPENAI_PRESETS } from "../config.js";

export type ProviderCatalogEntry = {
  id: string;
  /** anthropic | openai_compat | cursor_cloud */
  backend: "anthropic" | "openai_compat" | "cursor_cloud";
  label: string;
  defaultModel: string;
  envKeys: string[];
  baseURL: string;
  /** How to use from this CLI */
  usage: "inaricode.yaml / inaricode.config.cjs provider + model, or INARI_PROVIDER / INARI_MODEL, or inari chat --provider …" | "inari cursor … (CURSOR_API_KEY); not a REPL chat backend";
};

const ANTHROPIC_ROW: ProviderCatalogEntry = {
  id: "anthropic",
  backend: "anthropic",
  label: "Anthropic Claude",
  defaultModel: ANTHROPIC_DEFAULT_MODEL,
  envKeys: ["ANTHROPIC_API_KEY"],
  baseURL: "(native Messages API)",
  usage: "inaricode.yaml / inaricode.config.cjs provider + model, or INARI_PROVIDER / INARI_MODEL, or inari chat --provider …",
};

const CURSOR_ROW: ProviderCatalogEntry = {
  id: "cursor",
  backend: "cursor_cloud",
  label: "Cursor Cloud Agents",
  defaultModel: "(per launch; see inari cursor models)",
  envKeys: ["CURSOR_API_KEY"],
  baseURL: "https://api.cursor.com",
  usage: "inari cursor … (CURSOR_API_KEY); not a REPL chat backend",
};

function openAiRows(): ProviderCatalogEntry[] {
  const out: ProviderCatalogEntry[] = [];
  for (const id of Object.keys(OPENAI_PRESETS) as Exclude<ProviderId, "anthropic">[]) {
    const p = OPENAI_PRESETS[id];
    out.push({
      id,
      backend: "openai_compat",
      label: labelForOpenAiPreset(id),
      defaultModel: p.defaultModel,
      envKeys: [...p.envKeys],
      baseURL: p.baseURL || "(set baseURL when provider is custom)",
      usage: "inaricode.yaml / inaricode.config.cjs provider + model, or INARI_PROVIDER / INARI_MODEL, or inari chat --provider …",
    });
  }
  return out;
}

const OPENAI_LABELS: Record<Exclude<ProviderId, "anthropic">, string> = {
  openai: "OpenAI (ChatGPT API)",
  kimi: "Moonshot / Kimi",
  qwen: "Alibaba Qwen (DashScope compatible)",
  ollama: "Ollama (local Llama, Mistral, …)",
  groq: "Groq (Llama, etc.)",
  together: "Together AI",
  egune: "Egune (MN)",
  eguna: "Egune (alias eguna)",
  mongol_ai: "Mongol AI",
  huggingface: "Hugging Face router (OpenAI-compatible)",
  google: "Google Gemini (OpenAI-compatible)",
  custom: "Custom OpenAI-compatible URL",
};

function labelForOpenAiPreset(id: Exclude<ProviderId, "anthropic">): string {
  return OPENAI_LABELS[id];
}

/** All rows for `inari providers list` (chat backends + Cursor cloud). */
export function getProviderCatalog(): ProviderCatalogEntry[] {
  return [ANTHROPIC_ROW, ...openAiRows().sort((a, b) => a.id.localeCompare(b.id)), CURSOR_ROW];
}

export function getProviderCatalogEntry(id: string): ProviderCatalogEntry | undefined {
  return getProviderCatalog().find((e) => e.id === id);
}
