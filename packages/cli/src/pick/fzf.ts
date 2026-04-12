import { spawn } from "node:child_process";

/**
 * Pipe `lines` to fzf; return chosen line or null if missing/cancelled/error.
 */
export function pickWithFzf(
  lines: string[],
  fzfPath: string,
  prompt: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(fzfPath, ["--height", "40%", "--reverse", "--prompt", `${prompt} `], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    const out: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => out.push(Buffer.from(c)));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const line = Buffer.concat(out).toString("utf8").trim().split("\n")[0];
      resolve(line || null);
    });
    child.stdin.write(lines.join("\n"));
    child.stdin.end();
  });
}
