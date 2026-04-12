import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Split a command string into argv (no shell); paths with spaces should use `sidecar.command` carefully. */
export function parseSidecarCommand(cmd: string): string[] {
  return cmd
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function defaultSidecarScriptPath(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "..", "..", "sidecar", "inari_sidecar.py"),
    join(here, "..", "..", "..", "..", "packages", "sidecar", "inari_sidecar.py"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export function resolveSidecarArgv(options: { enabled: boolean; command?: string }): string[] | null {
  if (!options.enabled) return null;
  if (options.command) return parseSidecarCommand(options.command);
  const env = process.env.INARI_SIDECAR_CMD?.trim();
  if (env) return parseSidecarCommand(env);
  const py = process.env.INARI_PYTHON?.trim() || "python3";
  const script = defaultSidecarScriptPath();
  if (!script) return null;
  return [py, script];
}
