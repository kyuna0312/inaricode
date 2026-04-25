import { homedir } from "node:os";
import { join } from "node:path";

export interface IdeContext {
  isNeovim: boolean;
  isNyanNvim: boolean;
  terminal: string;
  vimKeybindings: boolean;
}

export async function isRunningInNeovim(): Promise<boolean> {
  if (process.env.NVIM || process.env.NVIM_APPNAME || process.env.NVIM_TUI_ENABLE_CURSOR) {
    return true;
  }
  return false;
}

function expandUser(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

export async function detectNyanNvim(): Promise<boolean> {
  const paths = [
    expandUser("~/.local/share/nvim/site/pack/plugins/start/nyan.nvim"),
    expandUser("~/.local/share/nvim/plugged/nyan.nvim"),
    expandUser("~/.config/nvim/plugins/nyan.nvim"),
  ];

  const fs = await import("node:fs/promises");
  for (const p of paths) {
    try {
      await fs.access(p);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function detectIde(): Promise<IdeContext> {
  const [isNeovim, isNyan] = await Promise.all([
    isRunningInNeovim(),
    detectNyanNvim(),
  ]);

  let terminal = "unknown";
  if (process.env.TERM_PROGRAM === "iTerm.app") terminal = "iterm";
  else if (process.env.TERM_PROGRAM === "Apple_Terminal") terminal = "terminal";
  else if (process.env.WEZTERM_Pane) terminal = "wezterm";
  else if (process.env.KITTMOD_ID) terminal = "kitty";
  else if (process.env.ALACRITTY_SOCKET) terminal = "alacritty";

  return {
    isNeovim,
    isNyanNvim: isNyan,
    terminal,
    vimKeybindings: isNeovim || process.env.INARICODE_VIM_KEYS === "1",
  };
}