import { z } from "zod";

export const ProviderIdSchema = z.enum([
  "opencode",
  "anthropic", 
  "openai",
  "kimi",
  "ollama",
  "groq",
  "google",
  "custom",
]);

export type ProviderId = z.infer<typeof ProviderIdSchema>;

export type OpenAiPreset = {
  baseURL: string;
  defaultModel: string;
  envKeys: string[];
  apiKeyOptional?: boolean;
};

export const OPENAI_PRESETS: Record<Exclude<ProviderId, "opencode" | "anthropic">, OpenAiPreset> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    envKeys: ["OPENAI_API_KEY"],
  },
  kimi: {
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    envKeys: ["MOONSHOT_API_KEY"],
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
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    envKeys: ["GOOGLE_API_KEY"],
  },
  custom: {
    baseURL: "",
    defaultModel: "gpt-4o-mini",
    envKeys: ["OPENAI_API_KEY"],
  },
};

export function getProviderPreset(id: string): OpenAiPreset | undefined {
  return OPENAI_PRESETS[id as keyof typeof OPENAI_PRESETS];
}