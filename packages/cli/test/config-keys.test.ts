import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig, loadRawInariConfig } from "../src/config.js";

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

  it("rejects plugins.enabled: true (Phase 8 placeholder)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-plugins-"));
    try {
      writeFileSync(
        join(dir, "inaricode.yaml"),
        `provider: anthropic
apiKey: sk-test
plugins:
  enabled: true
`,
        "utf8",
      );
      await expect(loadRawInariConfig(dir)).rejects.toThrow(/plugins\.enabled/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads summarization config with explicit values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-sum-"));
    try {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
      writeFileSync(
        join(dir, "inaricode.yaml"),
        `provider: anthropic
summarization:
  enabled: true
  threshold: 90000
  keepRecentTurns: 3
`,
        "utf8",
      );
      const cfg = await loadConfig(dir);
      expect(cfg.summarization).toEqual({
        enabled: true,
        threshold: 90000,
        keepRecentTurns: 3,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("summarization defaults to disabled when omitted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inari-sum2-"));
    try {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
      writeFileSync(join(dir, "inaricode.yaml"), `provider: anthropic\n`, "utf8");
      const cfg = await loadConfig(dir);
      expect(cfg.summarization.enabled).toBe(false);
      expect(cfg.summarization.threshold).toBe(120_000);
      expect(cfg.summarization.keepRecentTurns).toBe(4);
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
