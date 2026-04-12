import type { InariConfig } from "../config.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { LLMProvider } from "./types.js";

export function createLlmProvider(cfg: InariConfig): LLMProvider {
  if (cfg.provider === "anthropic") {
    return new AnthropicProvider(cfg.apiKey, cfg.model);
  }
  return new OpenAICompatibleProvider({
    apiKey: cfg.apiKey,
    model: cfg.model,
    baseURL: cfg.baseURL,
  });
}
