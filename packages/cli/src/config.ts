import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";
import { ProviderIdSchema, getProviderPreset } from "./providers.js";

export const INARI_CONFIG_SEARCH = [
  "inaricode.yaml",
  "inaricode.yml", 
  "inaricode.json",
  "inaricode.config.cjs",
];

const OpenCodeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  url: z.string().default("http://localhost:4096"),
  token: z.string().default(""),
  model: z.string().default("claude-sonnet"),
  timeout: z.number().default(30000),
  fallback: z.boolean().default(false),
});

const PickerConfigSchema = z.object({
  mode: z.enum(["builtin", "fzf"]).default("builtin"),
  fzfPath: z.string().default("fzf"),
  glob: z.string().default("**/*"),
});

export const RawConfigSchema = z.object({
  provider: ProviderIdSchema.default("opencode"),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  maxAgentSteps: z.number().default(25),
  streaming: z.boolean().default(true),
  readOnly: z.boolean().default(false),
  maxHistoryItems: z.number().default(100),
  opencode: OpenCodeConfigSchema.optional(),
  picker: PickerConfigSchema.optional(),
  locale: z.enum(["en", "mn"]).default("en"),
  chatTheme: z.enum(["default", "soft", "high_contrast"]).default("default"),
});

export type RawConfig = z.infer<typeof RawConfigSchema>;

export type InariConfig = {
  provider: string;
  model: string;
  apiKey: string;
  baseURL: string;
  maxAgentSteps: number;
  streaming: boolean;
  readOnly: boolean;
  maxHistoryItems: number;
  opencode: {
    enabled: boolean;
    url: string;
    token: string;
    model: string;
    timeout: number;
    fallback: boolean;
  };
  picker: {
    mode: "builtin" | "fzf";
    fzfPath: string;
    glob: string;
  };
  locale: "en" | "mn";
  chatTheme: "default" | "soft" | "high_contrast";
};

export async function loadConfig(searchFrom: string): Promise<InariConfig> {
  const loader = cosmiconfig("inaricode", {
    searchPlaces: INARI_CONFIG_SEARCH,
  });
  
  const result = await loader.search(searchFrom);
  const raw = result?.config ?? {};
  
  const validated = RawConfigSchema.parse(raw);
  
  const preset = getProviderPreset(validated.provider);
  const baseURL = validated.baseURL ?? preset?.baseURL ?? "";
  const model = validated.model ?? preset?.defaultModel ?? "claude-sonnet";
  const apiKey = validated.apiKey ?? process.env[preset?.envKeys[0] ?? "OPENAI_API_KEY"] ?? "";
  
  return {
    provider: validated.provider,
    model,
    apiKey,
    baseURL,
    maxAgentSteps: validated.maxAgentSteps,
    streaming: validated.streaming,
    readOnly: validated.readOnly,
    maxHistoryItems: validated.maxHistoryItems,
    opencode: validated.opencode ?? {
      enabled: true,
      url: "http://localhost:4096",
      token: "",
      model: "claude-sonnet", 
      timeout: 30000,
      fallback: false,
    },
    picker: validated.picker ?? {
      mode: "builtin",
      fzfPath: "fzf",
      glob: "**/*",
    },
    locale: validated.locale,
    chatTheme: validated.chatTheme,
  };
}