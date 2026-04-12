import { resolve } from "node:path";

export function resolveWorkspaceRoot(flag: string | undefined, cwd: string): string {
  return resolve(cwd, flag ?? ".");
}
