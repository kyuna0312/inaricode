/** Cursor HTTP API (Cloud Agents + shared auth). See https://cursor.com/docs/api */

const DEFAULT_BASE = "https://api.cursor.com";

export function cursorApiBaseUrl(): string {
  const b = process.env.CURSOR_API_BASE_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  return DEFAULT_BASE;
}

export function cursorApiKey(): string | null {
  const k = process.env.CURSOR_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

function basicAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`, "utf8").toString("base64")}`;
}

export async function cursorApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = cursorApiKey();
  if (!key) {
    throw new Error("CURSOR_API_KEY is not set (create a key: Cursor Dashboard → Cloud Agents)");
  }
  const base = cursorApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", basicAuthHeader(key));
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

export async function cursorApiJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await cursorApiFetch(path, init);
  const text = await res.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      /* keep raw text */
    }
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message?: string }).message)
        : text || res.statusText;
    throw new Error(`Cursor API ${res.status}: ${msg}`);
  }
  return body;
}
