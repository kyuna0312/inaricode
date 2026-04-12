/**
 * Hugging Face Inference API (classic) — text-to-image.
 * @see https://huggingface.co/docs/api-inference
 */
export async function huggingFaceTextToImage(params: {
  token: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(params.model)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: params.prompt }),
    signal: params.signal,
  });

  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(buf.toString("utf8")) as { error?: string; message?: string };
      if (typeof j.error === "string") detail = j.error;
      else if (typeof j.message === "string") detail = j.message;
    } catch {
      if (buf.length > 0 && buf.length < 800) detail = buf.toString("utf8").trim();
    }
    throw new Error(detail);
  }

  if (ct.includes("image/")) {
    return buf;
  }

  try {
    const j = JSON.parse(buf.toString("utf8")) as unknown;
    const b64 = extractBase64Image(j);
    if (b64) return Buffer.from(b64, "base64");
  } catch {
    /* fall through */
  }

  throw new Error(
    `Unexpected response (content-type: ${ct || "unknown"}). Try another --model or check the model card on Hugging Face.`,
  );
}

function extractBase64Image(j: unknown): string | null {
  if (Array.isArray(j) && j.length > 0) {
    const first = j[0] as Record<string, unknown>;
    if (typeof first.generated_image === "string") {
      return stripDataUrl(first.generated_image);
    }
    if (typeof first.image === "string") {
      return stripDataUrl(first.image);
    }
  }
  if (j && typeof j === "object" && "generated_image" in j) {
    const v = (j as { generated_image?: string }).generated_image;
    if (typeof v === "string") return stripDataUrl(v);
  }
  return null;
}

function stripDataUrl(s: string): string {
  const m = /^data:image\/\w+;base64,(.+)$/i.exec(s.trim());
  return m?.[1] ?? s;
}
