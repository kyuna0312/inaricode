import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type EngineEnvelope = {
  id: string;
  cmd: string;
  workspace: string;
  payload: Record<string, unknown>;
};

export type EngineOk = { id: string; ok: true; result: unknown };
export type EngineErr = { id: string; ok: false; error: string };
export type EngineReply = EngineOk | EngineErr;

export type EngineTransport = "native" | "subprocess";

function repoRootFromCliSrc(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "..");
}

export function resolveEngineBinary(): string {
  const fromEnv = process.env.INARI_ENGINE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const root = repoRootFromCliSrc();
  const candidates = [
    join(root, "packages/engine/target/release/inaricode-engine"),
    join(root, "packages/engine/target/debug/inaricode-engine"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    "inaricode-engine not found. Build with: yarn run build:engine:dev (from repo root). " +
      "Or set INARI_ENGINE_PATH.",
  );
}

type NativeIpc = (line: string) => string;

let nativeIpc: NativeIpc | null | undefined;

async function loadNativeIpc(): Promise<NativeIpc | null> {
  if (nativeIpc !== undefined) return nativeIpc;
  try {
    const mod = (await import("@inaricode/engine-native")) as { ipcRequest?: NativeIpc };
    nativeIpc = typeof mod.ipcRequest === "function" ? mod.ipcRequest : null;
  } catch {
    nativeIpc = null;
  }
  return nativeIpc;
}

function ipcMode(): "auto" | "native" | "subprocess" {
  const v = process.env.INARI_ENGINE_IPC?.trim().toLowerCase();
  if (v === "native" || v === "subprocess") return v;
  return "auto";
}

/** First successful resolution: native module if allowed and loadable, else subprocess binary. */
export async function resolveEngineTransport(): Promise<EngineTransport> {
  const mode = ipcMode();
  if (mode === "subprocess") return "subprocess";
  const ipc = await loadNativeIpc();
  if (ipc && (mode === "native" || mode === "auto")) return "native";
  if (mode === "native") {
    throw new Error(
      "INARI_ENGINE_IPC=native but @inaricode/engine-native did not load. Run yarn build:native from repo root.",
    );
  }
  return "subprocess";
}

function parseReply(env: EngineEnvelope, first: string | undefined, err: string, code: number | null): EngineReply {
  if (code !== 0 && !first) {
    return { id: env.id, ok: false, error: err || `engine exited ${code}` };
  }
  if (!first) {
    return { id: env.id, ok: false, error: err || "empty engine response" };
  }
  try {
    return JSON.parse(first) as EngineReply;
  } catch (e) {
    return {
      id: env.id,
      ok: false,
      error: `invalid JSON from engine: ${String(e)}; stdout=${first}`,
    };
  }
}

async function engineRequestSubprocess(env: EngineEnvelope): Promise<EngineReply> {
  const bin = resolveEngineBinary();
  const child = spawn(bin, ["ipc"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const outChunks: Buffer[] = [];
  const errChunks: Buffer[] = [];
  child.stdout.on("data", (c) => outChunks.push(Buffer.from(c)));
  child.stderr.on("data", (c) => errChunks.push(Buffer.from(c)));

  const line = `${JSON.stringify(env)}\n`;
  child.stdin.write(line);
  child.stdin.end();

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (c) => resolve(c));
  });

  const stderr = Buffer.concat(errChunks).toString("utf8").trim();
  const out = Buffer.concat(outChunks).toString("utf8").trim();
  const lines = out ? out.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  return parseReply(env, lines[0], stderr, code);
}

export async function engineRequest(env: EngineEnvelope): Promise<EngineReply> {
  const mode = ipcMode();
  if (mode === "subprocess") {
    return engineRequestSubprocess(env);
  }

  const ipc = await loadNativeIpc();
  if (ipc && (mode === "native" || mode === "auto")) {
    try {
      const raw = ipc(JSON.stringify(env));
      return JSON.parse(raw) as EngineReply;
    } catch (e) {
      if (mode === "native") {
        return {
          id: env.id,
          ok: false,
          error: `native engine error: ${String(e)}`,
        };
      }
    }
  } else if (mode === "native") {
    return {
      id: env.id,
      ok: false,
      error:
        "INARI_ENGINE_IPC=native but @inaricode/engine-native did not load. Run yarn build:native from repo root.",
    };
  }

  return engineRequestSubprocess(env);
}
