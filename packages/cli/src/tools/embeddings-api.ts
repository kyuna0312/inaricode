export type EmbeddingClient = {
  baseURL: string;
  apiKey: string;
  model: string;
};

type EmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

export async function fetchEmbeddings(
  client: EmbeddingClient,
  inputs: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const url = `${client.baseURL.replace(/\/$/, "")}/embeddings`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${client.apiKey}`,
    },
    body: JSON.stringify({ model: client.model, input: inputs }),
    signal,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`embeddings HTTP ${res.status}: ${text.slice(0, 800)}`);
  }
  let j: EmbeddingsResponse;
  try {
    j = JSON.parse(text) as EmbeddingsResponse;
  } catch (e) {
    throw new Error(`embeddings: invalid JSON: ${String(e)}`);
  }
  const rows = j.data ?? [];
  const out: number[][] = Array.from({ length: inputs.length }, () => []);
  const indexed = rows.every((d) => typeof d.index === "number");
  if (!indexed && rows.length === inputs.length) {
    return rows.map((d) => d.embedding);
  }
  for (const d of rows) {
    if (typeof d.index === "number" && Array.isArray(d.embedding)) {
      out[d.index] = d.embedding;
    }
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d < 1e-12 ? 0 : dot / d;
}

export async function pingEmbeddings(client: EmbeddingClient, signal?: AbortSignal): Promise<void> {
  await fetchEmbeddings(client, ["inaricode-doctor"], signal);
}
