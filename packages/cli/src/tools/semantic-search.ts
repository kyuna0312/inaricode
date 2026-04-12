import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { globby } from "globby";
import { engineRequest } from "../engine/client.js";
import { cosineSimilarity, fetchEmbeddings, type EmbeddingClient } from "./embeddings-api.js";

const GLOB_PATTERNS = [
  "**/*.{ts,tsx,mts,cts,js,cjs,mjs,jsx,py,rs,go,java,kt,cs,php,rb,md,json,yml,yaml,toml,c,h,cpp,hpp}",
];
const EXTRA_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/target/**",
  "**/.yarn/**",
  "**/__pycache__/**",
  "**/.next/**",
  "**/build/**",
];

const CHUNK_CHARS = 3200;
const CHUNK_OVERLAP = 400;

type CacheChunk = { start: number; text: string; embedding: number[] };
type CacheEntry = { mtimeMs: number; size: number; chunks: CacheChunk[] };
type CacheFile = {
  v: 1;
  model: string;
  baseURL: string;
  entries: Record<string, CacheEntry>;
};

async function readInariIgnoreLines(root: string): Promise<string[]> {
  try {
    const raw = await readFile(join(root, ".inariignore"), "utf8");
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
  } catch {
    return [];
  }
}

function chunkText(text: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  if (text.length <= CHUNK_CHARS) {
    return [{ start: 0, text }];
  }
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_CHARS, text.length);
    out.push({ start, text: text.slice(start, end) });
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
  }
  return out;
}

async function engineReadFile(workspaceRoot: string, relPath: string): Promise<string | null> {
  const reply = await engineRequest({
    id: `semantic-read-${relPath}`,
    cmd: "read_file",
    workspace: workspaceRoot,
    payload: { path: relPath },
  });
  if (!reply.ok) return null;
  const r = reply.result as { content?: string };
  return typeof r.content === "string" ? r.content : null;
}

function cachePath(workspaceRoot: string): string {
  return join(workspaceRoot, ".inaricode", "semantic-cache-v1.json");
}

async function loadCache(p: string, client: EmbeddingClient): Promise<CacheFile> {
  try {
    const raw = await readFile(p, "utf8");
    const j = JSON.parse(raw) as CacheFile;
    if (
      j.v === 1 &&
      j.model === client.model &&
      j.baseURL === client.baseURL &&
      j.entries &&
      typeof j.entries === "object"
    ) {
      return j;
    }
  } catch {
    /* fresh */
  }
  return { v: 1, model: client.model, baseURL: client.baseURL, entries: {} };
}

async function saveCache(p: string, c: CacheFile): Promise<void> {
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(c), "utf8");
}

async function discoverFiles(workspaceRoot: string, maxFiles: number): Promise<string[]> {
  const ign = await readInariIgnoreLines(workspaceRoot);
  const files = await globby(GLOB_PATTERNS, {
    cwd: workspaceRoot,
    gitignore: true,
    ignore: [...EXTRA_IGNORE, ...ign],
    onlyFiles: true,
    unique: true,
    dot: false,
  });
  return files.slice(0, maxFiles);
}

async function embedInBatches(
  client: EmbeddingClient,
  texts: string[],
  signal: AbortSignal | undefined,
  batchSize: number,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const part = await fetchEmbeddings(client, batch, signal);
    out.push(...part);
  }
  return out;
}

export async function runSemanticCodebaseSearch(params: {
  workspaceRoot: string;
  client: EmbeddingClient;
  query: string;
  maxResults: number;
  maxFiles: number;
  refreshIndex: boolean;
  signal?: AbortSignal;
}): Promise<Record<string, unknown>> {
  const { workspaceRoot, client, query, maxResults, maxFiles, refreshIndex, signal } = params;
  const cp = cachePath(workspaceRoot);
  const cache = refreshIndex
    ? { v: 1 as const, model: client.model, baseURL: client.baseURL, entries: {} }
    : await loadCache(cp, client);

  const files = await discoverFiles(workspaceRoot, maxFiles);
  const toEmbed: { path: string; chunks: { start: number; text: string }[] }[] = [];

  for (const rel of files) {
    let st;
    try {
      st = await stat(join(workspaceRoot, rel));
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const prev = cache.entries[rel];
    if (!refreshIndex && prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size && prev.chunks.length > 0) {
      continue;
    }
    const content = await engineReadFile(workspaceRoot, rel);
    if (content === null) continue;
    const parts = chunkText(content);
    toEmbed.push({ path: rel, chunks: parts });
  }

  if (toEmbed.length > 0) {
    const flatTexts: string[] = [];
    const meta: { path: string; start: number }[] = [];
    for (const item of toEmbed) {
      for (const c of item.chunks) {
        meta.push({ path: item.path, start: c.start });
        flatTexts.push(c.text);
      }
    }
    const vectors = await embedInBatches(client, flatTexts, signal, 24);
    const byPath = new Map<string, CacheChunk[]>();
    for (let i = 0; i < meta.length; i++) {
      const m = meta[i];
      const emb = vectors[i];
      if (!emb || emb.length === 0) continue;
      const arr = byPath.get(m.path) ?? [];
      arr.push({ start: m.start, text: flatTexts[i] ?? "", embedding: emb });
      byPath.set(m.path, arr);
    }
    for (const item of toEmbed) {
      let st;
      try {
        st = await stat(join(workspaceRoot, item.path));
      } catch {
        continue;
      }
      const chunks = byPath.get(item.path) ?? [];
      cache.entries[item.path] = { mtimeMs: st.mtimeMs, size: st.size, chunks };
    }
  }

  const present = new Set(files);
  for (const k of Object.keys(cache.entries)) {
    if (!present.has(k)) delete cache.entries[k];
  }

  await saveCache(cp, cache);

  const [qVec] = await fetchEmbeddings(client, [query], signal);
  if (!qVec || qVec.length === 0) {
    return { error: "empty query embedding", query, files_indexed: files.length };
  }

  type Hit = { path: string; score: number; start: number; snippet: string };
  const hits: Hit[] = [];
  for (const [path, ent] of Object.entries(cache.entries)) {
    for (const ch of ent.chunks) {
      const score = cosineSimilarity(qVec, ch.embedding);
      const sn = ch.text.replace(/\s+/g, " ").trim().slice(0, 280);
      hits.push({ path, score, start: ch.start, snippet: sn + (ch.text.length > 280 ? " …" : "") });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, maxResults);

  return {
    query,
    model: client.model,
    files_globbed: files.length,
    cache_path: ".inaricode/semantic-cache-v1.json",
    results: top.map((h) => ({
      path: h.path,
      score: Math.round(h.score * 10000) / 10000,
      char_offset: h.start,
      snippet: h.snippet,
    })),
  };
}
