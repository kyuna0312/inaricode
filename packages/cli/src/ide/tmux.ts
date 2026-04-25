import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class TmuxError extends Error {
  readonly _tag = "TmuxError";
  constructor(message: string) {
    super(message);
    this.name = "TmuxError";
  }
}

export class NotFoundError extends Error {
  readonly _tag = "NotFoundError";
  constructor() {
    super("Tmux not found");
    this.name = "NotFoundError";
  }
}

export async function find(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("which", ["tmux"]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function newSession(
  name: string,
  command?: string[],
): Promise<void> {
  const tmux = await find();
  if (!tmux) throw new NotFoundError();

  const args = ["new-session", "-d", "-s", name];
  if (command) {
    args.push("-c", command[0], "--");
    args.push(...command.slice(1));
  }

  try {
    await execFileAsync(tmux, args);
  } catch (e) {
    const err = e as { message?: string };
    throw new TmuxError(err.message ?? "Failed to create session");
  }
}

export async function sendKeys(
  sessionName: string,
  keys: string,
): Promise<void> {
  const tmux = await find();
  if (!tmux) throw new NotFoundError();

  try {
    await execFileAsync(tmux, ["send-keys", "-t", sessionName, keys]);
  } catch (e) {
    const err = e as { message?: string };
    throw new TmuxError(err.message ?? "Failed to send keys");
  }
}

export async function sendCommand(
  sessionName: string,
  command: string,
): Promise<void> {
  const tmux = await find();
  if (!tmux) throw new NotFoundError();

  try {
    await execFileAsync(tmux, [
      "send-keys",
      "-t",
      sessionName,
      command,
      "Enter",
    ]);
  } catch (e) {
    const err = e as { message?: string };
    throw new TmuxError(err.message ?? "Failed to send command");
  }
}

export async function capturePane(sessionName: string): Promise<string> {
  const tmux = await find();
  if (!tmux) throw new NotFoundError();

  try {
    const { stdout } = await execFileAsync(tmux, [
      "capture-pane",
      "-t",
      sessionName,
      "-p",
    ]);
    return stdout;
  } catch (e) {
    const err = e as { message?: string };
    throw new TmuxError(err.message ?? "Failed to capture pane");
  }
}

export async function killSession(sessionName: string): Promise<void> {
  const tmux = await find();
  if (!tmux) throw new NotFoundError();

  try {
    await execFileAsync(tmux, ["kill-session", "-t", sessionName]);
  } catch (e) {
    const err = e as { message?: string };
    throw new TmuxError(err.message ?? "Failed to kill session");
  }
}

export async function listSessions(): Promise<string[]> {
  const tmux = await find();
  if (!tmux) return [];

  try {
    const { stdout } = await execFileAsync(tmux, [
      "list-sessions",
      "-F",
      "#{session_name}",
    ]);
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function hasSession(name: string): Promise<boolean> {
  const sessions = await listSessions();
  return sessions.includes(name);
}
