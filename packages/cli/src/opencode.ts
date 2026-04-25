import type { ChatCompletionMessageParam } from "openai/resources.mjs";

export interface OpenCodeOptions {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  model?: string;
}

export interface ChatOptions {
  messages: ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_URL = "http://localhost:4096";
const DEFAULT_TIMEOUT = 30000;

export class OpenCodeClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private model: string;

  constructor(opts: OpenCodeOptions = {}) {
    this.baseUrl = opts.baseUrl ?? process.env.OPENCODE_URL ?? DEFAULT_URL;
    this.apiKey = opts.apiKey ?? process.env.OPENCODE_TOKEN ?? "";
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.model = opts.model ?? "claude-sonnet";
  }

  private getUrl(path: string): string {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
    return `${base}${path}`;
  }

  async chat(opts: ChatOptions): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.getUrl("/v1/chat/completions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: opts.model ?? this.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenCode API error: ${response.status}`);
      }

      const json = await response.json();
      return {
        content: json.choices?.[0]?.message?.content ?? "",
        usage: json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw e;
    }
  }

  async chatStream(
    opts: ChatOptions,
    onChunk: (chunk: string) => void | Promise<void>,
  ): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.getUrl("/v1/chat/completions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: opts.model ?? this.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error(`OpenCode API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return { content, usage };
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
              await onChunk(delta);
            }
          } catch {
            continue;
          }
        }
      }

      return { content, usage };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(this.getUrl("/health"), {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

let globalClient: OpenCodeClient | undefined;

export function createClient(opts?: OpenCodeOptions): OpenCodeClient {
  globalClient = new OpenCodeClient(opts);
  return globalClient;
}

export function getClient(): OpenCodeClient | undefined {
  return globalClient;
}