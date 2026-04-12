import { writeFile } from "node:fs/promises";
import { loadLocalePreference } from "../i18n/locale.js";
import { tr } from "../i18n/strings.js";
import { huggingFaceTextToImage } from "./hf-image.js";

function firstEnv(keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.length > 0) return v;
  }
  return undefined;
}

export async function runMediaImage(opts: {
  cwd: string;
  prompt: string;
  output: string;
  model: string;
  provider: string;
  token?: string;
}): Promise<void> {
  const locale = await loadLocalePreference(opts.cwd);
  const L = (key: Parameters<typeof tr>[1], vars?: Record<string, string>) => tr(locale, key, vars);

  const provider = opts.provider.toLowerCase();
  if (provider === "google") {
    process.stderr.write(`${L("mediaGoogleImageNotImplemented")}\n`);
    process.exitCode = 1;
    return;
  }
  if (provider !== "huggingface") {
    process.stderr.write(`${L("mediaUnknownProvider", { provider: opts.provider })}\n`);
    process.exitCode = 1;
    return;
  }

  const token = opts.token ?? firstEnv(["HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"]);
  if (!token) {
    process.stderr.write(`${L("mediaMissingHfToken")}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const bytes = await huggingFaceTextToImage({
      token,
      model: opts.model,
      prompt: opts.prompt,
    });
    await writeFile(opts.output, bytes);
    process.stdout.write(`${L("mediaImageWrote", { path: opts.output, bytes: String(bytes.length) })}\n`);
  } catch (e) {
    process.stderr.write(`${L("mediaImageFail", { detail: String(e) })}\n`);
    process.exitCode = 1;
  }
}

export async function runMediaVideo(opts: { cwd: string }): Promise<void> {
  const locale = await loadLocalePreference(opts.cwd);
  process.stderr.write(`${tr(locale, "mediaVideoStub")}\n`);
  process.exitCode = 0;
}
