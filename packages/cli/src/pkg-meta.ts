import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cached: string | null = null;

export function cliPackageVersion(): string {
  if (cached) return cached;
  const p = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  cached = (JSON.parse(readFileSync(p, "utf8")) as { version: string }).version;
  return cached;
}
