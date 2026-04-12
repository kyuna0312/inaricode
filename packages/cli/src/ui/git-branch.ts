import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Current branch name for `workspaceRoot`, or null if not a git repo / detached / error. */
export async function getWorkspaceGitBranch(workspaceRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: workspaceRoot,
      maxBuffer: 256,
    });
    const b = stdout.toString().trim();
    if (!b || b === "HEAD") return null;
    return b;
  } catch {
    return null;
  }
}
