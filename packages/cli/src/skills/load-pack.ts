import { readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";
import { SkillManifestSchema, type SkillManifest } from "./manifest.js";

export type LoadedSkillPack = {
  manifest: SkillManifest;
  /** Absolute path to the directory containing skill.yaml / skill.json */
  rootDir: string;
  systemPrompt: string;
};

function resolvePackRoot(configPath: string): string {
  const ext = extname(configPath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml" || ext === ".json") {
    return dirname(configPath);
  }
  return configPath;
}

async function findManifestPath(resolvedPath: string): Promise<string | null> {
  let st;
  try {
    st = await stat(resolvedPath);
  } catch {
    return null;
  }
  if (st.isFile()) {
    const ext = extname(resolvedPath).toLowerCase();
    if ([".yaml", ".yml", ".json"].includes(ext)) return resolvedPath;
    return null;
  }
  if (st.isDirectory()) {
    for (const name of ["skill.yaml", "skill.yml", "skill.json"]) {
      const p = join(resolvedPath, name);
      try {
        const s = await stat(p);
        if (s.isFile()) return p;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

function parseManifest(raw: string, path: string): SkillManifest {
  const lower = path.toLowerCase();
  const data: unknown =
    lower.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw, { filename: path });
  return SkillManifestSchema.parse(data);
}

/**
 * Load one skill pack from a path (directory with skill.yaml, or path to manifest file).
 * `cwd` is used to resolve relative paths.
 */
export async function loadSkillPack(cwd: string, packPath: string): Promise<LoadedSkillPack> {
  const abs = isAbsolute(packPath) ? packPath : resolve(cwd, packPath);
  const manifestPath = await findManifestPath(abs);
  if (!manifestPath) {
    throw new Error(`no skill.yaml / skill.yml / skill.json under ${abs}`);
  }
  const raw = await readFile(manifestPath, "utf8");
  const manifest = parseManifest(raw, manifestPath);
  const rootDir = resolvePackRoot(manifestPath);
  const promptRel = manifest.system_prompt_file.replace(/^\.\//, "");
  const promptPath = join(rootDir, promptRel);
  let systemPrompt: string;
  try {
    systemPrompt = await readFile(promptPath, "utf8");
  } catch {
    throw new Error(`system_prompt_file not found: ${manifest.system_prompt_file} (resolved ${promptPath})`);
  }
  return { manifest, rootDir, systemPrompt: systemPrompt.trimEnd() };
}
