import type { AgentHistoryItem } from "../llm/types.js";
import type { Locale } from "../i18n/locale.js";
import { tr } from "../i18n/strings.js";

export type SlashLoopAction = "proceed" | "again" | "exit";

type SlashCtx = {
  locale: Locale;
  trimmed: string;
  setHistory: (h: AgentHistoryItem[]) => void;
  write: (s: string) => void | Promise<void>;
  persistEmpty: () => Promise<void>;
};

/**
 * Handle `/…` input. Returns whether the main loop should send text to the model.
 */
export async function handleChatSlashInput(ctx: SlashCtx): Promise<SlashLoopAction> {
  if (!ctx.trimmed.startsWith("/")) return "proceed";

  const raw = ctx.trimmed.slice(1).trim();
  const cmd = raw.split(/\s+/)[0]?.toLowerCase() ?? "";

  if (cmd === "exit" || cmd === "quit") {
    return "exit";
  }

  if (cmd === "help" || cmd === "h" || cmd === "?") {
    await ctx.write(`${tr(ctx.locale, "slashHelp")}\n`);
    return "again";
  }

  if (cmd === "clear" || cmd === "cls") {
    ctx.setHistory([]);
    await ctx.persistEmpty();
    await ctx.write(`${tr(ctx.locale, "slashCleared")}\n`);
    return "again";
  }

  await ctx.write(`${tr(ctx.locale, "slashUnknown", { cmd: ctx.trimmed })}\n`);
  return "again";
}
