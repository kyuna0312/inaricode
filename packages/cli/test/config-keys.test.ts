import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";

describe("config keys (inaricode.yaml)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses keys[provider] when apiKey is unset and env is empty", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-keys-"));
    try {
      vi.stubEnv("OPENAI_API_KEY", "");
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      writeFileSync(
        join(dir, "inaricode.yaml"),
        `provider: openai
model: gpt-4o-mini
keys:
  openai: sk-yaml-only
`,
        "utf8",
      );
      const cfg = await loadConfig(dir);
      expect(cfg.provider).toBe("openai");
      expect(cfg.apiKey).toBe("sk-yaml-only");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers top-level apiKey over keys map", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-keys-"));
    try {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      writeFileSync(
        join(dir, "inaricode.yaml"),
        `provider: anthropic
apiKey: sk-top
keys:
  anthropic: sk-from-keys
`,
        "utf8",
      );
      const cfg = await loadConfig(dir);
      expect(cfg.apiKey).toBe("sk-top");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves egune key when provider is eguna", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-keys-"));
    try {
      vi.stubEnv("EGUNE_API_KEY", "");
      vi.stubEnv("EGUNA_API_KEY", "");
      writeFileSync(
        join(dir, "inaricode.yaml"),
        `provider: eguna
keys:
  egune: sk-egune-alias
`,
        "utf8",
      );
      const cfg = await loadConfig(dir);
      expect(cfg.apiKey).toBe("sk-egune-alias");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
