import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Locale } from "../i18n/locale.js";
import { tr } from "../i18n/strings.js";

/** 256-color ANSI: orange hoodie, brown outline, cream accent (kitsune mascot). */
const A = {
  o: "\x1b[38;5;208m",
  O: "\x1b[38;5;214m",
  b: "\x1b[38;5;94m",
  w: "\x1b[38;5;230m",
  d: "\x1b[38;5;240m",
  x: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

export function ansiLogoEnabled(): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== "") return false;
  if (process.env.FORCE_COLOR === "0") return false;
  return process.stdout.isTTY === true;
}

function z(use: boolean): typeof A {
  if (!use) {
    return { o: "", O: "", b: "", w: "", d: "", x: "", bold: "", dim: "" };
  }
  return A;
}

/**
 * Absolute path to bundled mascot PNG (pixel fox · Inari).
 * From `dist/ui/logo.js` → `packages/cli/assets/logo.png`.
 */
export function resolveBundledLogoPath(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = join(here, "..", "..", "assets", "logo.png");
  return existsSync(p) ? p : null;
}

/** Full banner: `inari doctor`, `inari logo`. */
export function inariLogoBannerFull(version: string, locale: Locale): string {
  const c = z(ansiLogoEnabled());
  const title = `${c.bold}${c.w}InariCode${c.x} ${c.dim}v${version}${c.x}`;
  const sub = `${c.dim}${tr(locale, "logoSub")}${c.x}`;
  const kitsune = `${c.b}${tr(locale, "logoKitsune")}${c.x}`;
  const usb = `${c.d}[⌂]${c.x} ${tr(locale, "logoUsb")}`;
  const cmds = `${c.dim}${tr(locale, "logoCommands")}${c.x}`;
  const png = resolveBundledLogoPath();
  const mascotLine = png
    ? tr(locale, "logoMascot", { path: png })
    : tr(locale, "logoMascotMissing");
  return [
    "",
    `      ${c.o}▄▄▄▄▄▄▄▄${c.x}                    ${title}`,
    `     ${c.o}██${c.b}▀${c.o}▀${c.b}▀${c.o}▀${c.b}▀${c.o}██${c.x}       ${c.O}__/\\__${c.x}     ${kitsune}`,
    `    ${c.o}█${c.w}o${c.b}.${c.b}.${c.w}o${c.o}█${c.x}       ${c.O}/  ${c.w}w${c.O}  \\${c.x}   ${sub}`,
    `    ${c.o}█${c.b}█${c.o}██${c.b}█${c.o}█${c.b}█${c.o}█${c.x}       ${usb}   ${cmds}`,
    `     ${c.o}▀${c.b}██████${c.o}▀${c.x}`,
    `      ${c.O}‾${c.b}~~${c.w}██${c.b}~~${c.O}‾${c.x}       ${c.dim}${mascotLine}${c.x}`,
    "",
  ].join("\n");
}

/** One-line header for `inari chat` / TUI. */
export function inariLogoBannerCompact(version: string, locale: Locale): string {
  const c = z(ansiLogoEnabled());
  return (
    `${c.o}▄▄▄${c.x} ${c.bold}${c.w}InariCode${c.x} ${c.dim}v${version}${c.x}  ` +
    `${c.O}__/\\__${c.x} ${c.b}·${c.x} ${c.dim}${tr(locale, "logoCompactHints")}${c.x}\n`
  );
}

/** Prepended to `inari --help`. */
export function inariHelpPreamble(version: string, locale: Locale): string {
  return `${inariLogoBannerCompact(version, locale)}\n`;
}
