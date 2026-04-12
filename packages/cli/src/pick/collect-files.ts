import { globby } from "globby";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Collect text-ish paths under workspace (gitignore-aware). */
export async function collectPickCandidates(workspaceRoot: string, globPattern: string): Promise<string[]> {
  const ignoreExtra = await loadInariIgnoreLines(workspaceRoot);
  const files = await globby(globPattern, {
    cwd: workspaceRoot,
    gitignore: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/target/**",
      "**/.inaricode/**",
      ...ignoreExtra,
    ],
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
  });
  const max = 25_000;
  files.sort((a, b) => a.localeCompare(b));
  return files.slice(0, max);
}

async function loadInariIgnoreLines(workspaceRoot: string): Promise<string[]> {
  try {
    const raw = await readFile(join(workspaceRoot, ".inariignore"), "utf8");
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}
