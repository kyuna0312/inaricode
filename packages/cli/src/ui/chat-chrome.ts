import { homedir } from "node:os";
import type { Locale } from "../i18n/locale.js";
import { tr } from "../i18n/strings.js";

export type ChatThemeId = "default" | "soft" | "high_contrast";

export type ChatSessionContext = {
  locale: Locale;
  /** Full line from `cliVersionLine()` (semver · patch · flower). */
  version: string;
  provider: string;
  model: string;
  workspaceRoot: string;
  sessionPath: string | null;
  readOnly: boolean;
  streaming: boolean;
  /** No ANSI / minimal Ink styling (also INARI_PLAIN=1). */
  plain: boolean;
  /** Git branch under workspace, if any. */
  gitBranch: string | null;
  /** REPL palette from config (`chatTheme`). */
  chatTheme: ChatThemeId;
};

function ansiBase(): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== "") return false;
  if (process.env.FORCE_COLOR === "0") return false;
  return process.stdout.isTTY === true;
}

export function useChatAnsi(plain: boolean): boolean {
  if (plain) return false;
  return ansiBase();
}

type Palette = {
  reset: string;
  bold: string;
  dim: string;
  fgMuted: string;
  fgLine: string;
  fgYou: string;
  fgAssistant: string;
};

const PALETTES: Record<ChatThemeId, Palette> = {
  default: {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    fgMuted: "\x1b[38;5;245m",
    fgLine: "\x1b[38;5;238m",
    fgYou: "\x1b[38;5;73m",
    fgAssistant: "\x1b[38;5;252m",
  },
  soft: {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    fgMuted: "\x1b[38;5;244m",
    fgLine: "\x1b[38;5;240m",
    fgYou: "\x1b[38;5;109m",
    fgAssistant: "\x1b[38;5;250m",
  },
  high_contrast: {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    fgMuted: "\x1b[90m",
    fgLine: "\x1b[37m",
    fgYou: "\x1b[96m",
    fgAssistant: "\x1b[97m",
  },
};

function palette(theme: ChatThemeId, use: boolean): Palette {
  if (!use) {
    return {
      reset: "",
      bold: "",
      dim: "",
      fgMuted: "",
      fgLine: "",
      fgYou: "",
      fgAssistant: "",
    };
  }
  return PALETTES[theme] ?? PALETTES.default;
}

/** Tilde-abbreviate home directory for display. */
export function shortenPath(absPath: string): string {
  const home = homedir();
  if (!home) return absPath;
  const norm = absPath.replace(/\\/g, "/");
  const h = home.replace(/\\/g, "/");
  if (norm === h) return "~";
  if (norm.startsWith(h.endsWith("/") ? h : `${h}/`)) {
    return `~${norm.slice(h.length)}`;
  }
  return absPath;
}

export function replPrompt(plain: boolean, theme: ChatThemeId = "default"): string {
  const c = palette(theme, useChatAnsi(plain));
  return `\n${c.fgMuted}›${c.reset} `;
}

export function replTurnSeparator(plain: boolean, theme: ChatThemeId = "default"): string {
  const c = palette(theme, useChatAnsi(plain));
  const w = Math.min(44, Math.max(32, (process.stdout.columns ?? 56) - 4));
  return `${c.dim}${c.fgLine}${"─".repeat(w)}${c.reset}\n`;
}

export function replAssistantLead(plain: boolean, theme: ChatThemeId = "default"): string {
  const c = palette(theme, useChatAnsi(plain));
  return `\n${c.dim}${c.fgAssistant}assistant${c.reset}\n`;
}

export function replUserBlock(locale: Locale, line: string, plain: boolean, theme: ChatThemeId = "default"): string {
  const c = palette(theme, useChatAnsi(plain));
  const you = tr(locale, "chatReplYou");
  return `\n${c.fgYou}${c.bold}${you}${c.reset} ${c.dim}›${c.reset} ${line}\n`;
}

/** Full welcome block for readline chat (no mascot ASCII). */
export function formatReplSessionWelcome(ctx: ChatSessionContext): string {
  const c = palette(ctx.chatTheme, useChatAnsi(ctx.plain));
  const L = ctx.locale;
  const pathDisp = shortenPath(ctx.workspaceRoot);
  const badges: string[] = [];
  if (ctx.readOnly) badges.push(tr(L, "chatBadgeReadOnly"));
  badges.push(ctx.streaming ? tr(L, "chatBadgeStream") : tr(L, "chatBadgeBuffer"));

  const lineModel = tr(L, "chatChromeLineModel", { provider: ctx.provider, model: ctx.model });
  const lineWs = tr(L, "chatChromeLineWorkspace", { path: pathDisp });
  let out = "";
  out += `${c.bold}${c.fgYou}InariCode${c.reset} ${c.dim}${ctx.version}${c.reset}  ${c.fgMuted}·${c.reset}  ${c.dim}${tr(L, "chatChromeSubtitle")}${c.reset}\n`;
  out += `${c.dim}${lineModel}${c.reset}\n`;
  out += `${c.dim}${lineWs}${c.reset}\n`;
  if (ctx.gitBranch) {
    out += `${c.dim}${tr(L, "chatChromeBranch", { branch: ctx.gitBranch })}${c.reset}\n`;
  }
  if (ctx.sessionPath) {
    out += `${c.dim}${tr(L, "chatChromeSession", { path: shortenPath(ctx.sessionPath) })}${c.reset}\n`;
  }
  out += `${c.dim}${badges.join(" · ")}${c.reset}\n`;
  out += `\n${c.dim}${tr(L, "chatHintShort")}${c.reset}\n`;
  return out;
}

export type TuiChromeLines = {
  title: string;
  subtitle: string;
  modelLine: string;
  workspaceLine: string;
  branchLine: string | null;
  sessionLine: string | null;
  badges: string;
  hint: string;
};

/** Ink accent for busy / prompts (matches `chatTheme` when not plain). */
export function tuiAccentColor(theme: ChatThemeId, plain: boolean): "cyan" | "blue" | "magenta" | "gray" {
  if (plain) return "gray";
  if (theme === "high_contrast") return "magenta";
  if (theme === "soft") return "blue";
  return "cyan";
}

export function buildTuiChromeLines(ctx: ChatSessionContext): TuiChromeLines {
  const L = ctx.locale;
  const pathDisp = shortenPath(ctx.workspaceRoot);
  const badgeParts: string[] = [];
  if (ctx.readOnly) badgeParts.push(tr(L, "chatBadgeReadOnly"));
  badgeParts.push(ctx.streaming ? tr(L, "chatBadgeStream") : tr(L, "chatBadgeBuffer"));
  return {
    title: `InariCode ${ctx.version}`,
    subtitle: tr(L, "chatChromeSubtitle"),
    modelLine: tr(L, "chatChromeLineModel", { provider: ctx.provider, model: ctx.model }),
    workspaceLine: tr(L, "chatChromeLineWorkspace", { path: pathDisp }),
    branchLine: ctx.gitBranch ? tr(L, "chatChromeBranch", { branch: ctx.gitBranch }) : null,
    sessionLine: ctx.sessionPath ? tr(L, "chatChromeSession", { path: shortenPath(ctx.sessionPath) }) : null,
    badges: badgeParts.join(" · "),
    hint: tr(L, "chatHintShort"),
  };
}
