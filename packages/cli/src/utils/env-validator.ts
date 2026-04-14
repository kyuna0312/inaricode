/** Production environment validation: ensures required tools and env vars are available. */

import { existsSync } from "node:fs";
import { cpus } from "node:os";

export type EnvValidationResult = {
  ok: boolean;
  warnings: string[];
  errors: string[];
  /** Environment summary for telemetry */
  summary: Record<string, string | number | boolean>;
};

/**
 * Validate production environment.
 * Returns warnings (non-blocking) and errors (blocking).
 */
export function validateProductionEnv(): EnvValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const summary: Record<string, string | number | boolean> = {};

  // Node.js version check
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  summary.nodeVersion = nodeVersion;
  if (nodeMajor < 20) {
    errors.push(`Node.js >= 20 required (found ${nodeVersion})`);
  }

  // System info
  summary.cpus = cpus().length;
  summary.platform = process.platform;
  summary.arch = process.arch;

  // Check for API keys (warn if missing, not error — user might configure later)
  const apiKeys = [
    { name: "ANTHROPIC_API_KEY", provider: "Anthropic" },
    { name: "OPENAI_API_KEY", provider: "OpenAI" },
    { name: "HF_TOKEN", provider: "Hugging Face" },
    { name: "GOOGLE_API_KEY", provider: "Google Gemini" },
  ];

  const availableKeys = apiKeys.filter((k) => process.env[k.name]);
  summary.apiKeysConfigured = availableKeys.length;
  if (availableKeys.length === 0) {
    warnings.push(
      "No API keys configured in environment. Users must set at least one provider key.",
    );
  }

  // Engine binary check (for subprocess IPC mode)
  const enginePath = process.env.INARI_ENGINE_PATH;
  if (enginePath) {
    summary.enginePath = enginePath;
    if (!existsSync(enginePath)) {
      errors.push(`INARI_ENGINE_PATH points to non-existent file: ${enginePath}`);
    } else {
      summary.engineExists = true;
    }
  }

  // IPC mode validation
  const ipcMode = process.env.INARI_ENGINE_IPC?.trim().toLowerCase();
  summary.ipcMode = ipcMode || "auto";
  if (ipcMode === "native") {
    try {
      require.resolve("@inaricode/engine-native");
      summary.nativeAddonLoaded = true;
    } catch {
      errors.push("INARI_ENGINE_IPC=native but @inaricode/engine-native not found");
    }
  }

  // Production logging validation
  const logLevel = process.env.INARI_LOG;
  if (logLevel && !["json", "debug", "info", "error"].includes(logLevel)) {
    warnings.push(`Unknown INARI_LOG value: ${logLevel} (expected: json, debug, info, error)`);
  }

  // Language validation
  const lang = process.env.INARI_LANG;
  if (lang && !["en", "mn"].includes(lang)) {
    warnings.push(`Unknown INARI_LANG value: ${lang} (expected: en, mn)`);
  }

  // Memory check
  const heapLimit = process.env.NODE_OPTIONS?.includes("--max-old-space-size");
  if (heapLimit) {
    summary.maxOldSpaceSizeSet = true;
  }

  // Sidecar check
  const sidecarEnabled = process.env.INARI_SIDECAR_ENABLED === "true";
  if (sidecarEnabled) {
    summary.sidecarEnabled = true;
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    summary,
  };
}

/** Print validation results to console (used by `inari doctor` and startup). */
export function printValidationResult(result: EnvValidationResult): void {
  if (result.errors.length > 0) {
    console.error("\n❌ Environment validation failed:");
    for (const err of result.errors) {
      console.error(`  • ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  Warnings:");
    for (const warn of result.warnings) {
      console.warn(`  • ${warn}`);
    }
  }

  if (result.ok && result.warnings.length === 0) {
    console.log("\n✅ Environment validation passed");
  }

  console.log("\nSummary:");
  console.log(`  Node.js: ${result.summary.nodeVersion}`);
  console.log(`  Platform: ${result.summary.platform} (${result.summary.arch})`);
  console.log(`  CPUs: ${result.summary.cpus}`);
  console.log(`  API keys configured: ${result.summary.apiKeysConfigured}`);
  if (result.summary.enginePath) {
    console.log(`  Engine path: ${result.summary.enginePath}`);
  }
  console.log(`  IPC mode: ${result.summary.ipcMode}`);
}
