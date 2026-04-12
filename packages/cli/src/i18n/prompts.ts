import type { Locale } from "./locale.js";

/** REPL / TUI: accept y/yes, and for Mongolian т (тийм) Latin or Cyrillic. */
export function isAffirmativeInput(s: string, locale: Locale): boolean {
  const t = s.trim().toLowerCase();
  if (t === "y" || t === "yes") return true;
  if (locale === "mn" && (t === "т" || t === "t" || t === "тийм")) return true;
  return false;
}

export function isNegativeInput(s: string, locale: Locale): boolean {
  const t = s.trim().toLowerCase();
  if (t === "n" || t === "no") return true;
  if (locale === "mn" && (t === "г" || t === "g" || t === "үгүй")) return true;
  return false;
}

export function isExitCommand(s: string, _locale: Locale): boolean {
  const t = s.trim().toLowerCase();
  return t === "exit" || t === "quit" || t === "гарах";
}

/** Single-key confirm (Ink): y, t, Cyrillic т. */
export function isAffirmativeKey(ch: string, locale: Locale): boolean {
  if (ch === "y" || ch === "Y") return true;
  if (locale === "mn") {
    if (ch === "t" || ch === "T") return true;
    if (ch === "\u0442" || ch === "\u0422") return true;
  }
  return false;
}

export function isNegativeKey(ch: string, locale: Locale): boolean {
  if (ch === "n" || ch === "N") return true;
  if (locale === "mn") {
    if (ch === "g" || ch === "G") return true;
    if (ch === "\u0433" || ch === "\u0413") return true;
  }
  return false;
}
