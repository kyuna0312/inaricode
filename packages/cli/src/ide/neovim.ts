import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export class NeovimError extends Error {
  readonly _tag = "NeovimError";
  constructor(message: string) {
    super(message);
    this.name = "NeovimError";
  }
}

export class NotFoundError extends Error {
  readonly _tag = "NotFoundError";
  constructor() {
    super("Neovim not found");
    this.name = "NotFoundError";
  }
}

export async function find(): Promise<string | undefined> {
  for (const cmd of ["nvim", "vim", "neovim", "nvim-linux64", "appimage"]) {
    try {
      const { stdout } = await execFileAsync("which", [cmd]);
      if (stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function edit(
  content: string,
  opts?: { filename?: string; language?: string },
): Promise<string> {
  const editor = await find();
  if (!editor) throw new NotFoundError();

  const filepath =
    opts?.filename ??
    join(
      tmpdir(),
      `${Date.now()}${opts?.language ? `.${opts.language}` : ".txt"}`,
    );

  const fs = await import("node:fs/promises");
  await fs.writeFile(filepath, content);

  try {
    const child = spawn(
      editor,
      process.platform === "win32"
        ? [filepath]
        : ["--headless", "-es", filepath],
      {
        stdio: "inherit",
        shell: true,
      },
    );

    await new Promise<void>((resolve) => {
      child.on("exit", () => resolve());
    });

    const result = await fs.readFile(filepath, "utf-8");
    return result;
  } finally {
    if (!opts?.filename) {
      await fs.unlink(filepath).catch(() => {});
    }
  }
}
