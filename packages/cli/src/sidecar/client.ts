import { spawn } from "node:child_process";
import * as readline from "node:readline";

export type SidecarRequest = {
  id: string;
  method: string;
  params: Record<string, unknown>;
};

/**
 * One-shot RPC: spawn sidecar, write one JSON line, read one JSON line.
 */
export async function sidecarRpc(argv: string[], req: SidecarRequest, timeoutMs = 120_000): Promise<unknown> {
  if (argv.length === 0) {
    throw new Error("sidecar argv is empty");
  }
  const child = spawn(argv[0], argv.slice(1), {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (c) => stderrChunks.push(Buffer.from(c)));

  const lineReader = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

  const errText = () => Buffer.concat(stderrChunks).toString("utf8").trim();

  const linePromise = new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const t = setTimeout(() => {
      finish(() => reject(new Error(`sidecar timeout after ${timeoutMs}ms`)));
    }, timeoutMs);

    lineReader.once("line", (ln) => {
      clearTimeout(t);
      finish(() => resolve(ln));
    });
    child.once("error", (e) => {
      clearTimeout(t);
      finish(() => reject(e));
    });
    child.once("close", (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(t);
        finish(() => reject(new Error(errText() || `sidecar exited ${code}`)));
      }
    });
  });

  child.stdin.write(`${JSON.stringify(req)}\n`);
  child.stdin.end();

  let raw: string;
  try {
    raw = await linePromise;
  } finally {
    lineReader.close();
  }

  let parsed: { ok?: boolean; result?: unknown; error?: string };
  try {
    parsed = JSON.parse(raw) as { ok?: boolean; result?: unknown; error?: string };
  } catch (e) {
    throw new Error(`invalid sidecar JSON: ${String(e)}: ${raw.slice(0, 500)}`);
  }
  if (!parsed.ok) {
    throw new Error(parsed.error || "sidecar error");
  }
  return parsed.result;
}
