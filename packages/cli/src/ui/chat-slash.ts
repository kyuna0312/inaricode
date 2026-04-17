import type { AgentHistoryItem, LLMProvider } from "../llm/types.js";
import type { Locale } from "../i18n/locale.js";
import { compactHistoryByUserTurns } from "../session/compact-history.js";
import { summarizeHistory } from "../session/summarize-history.js";
import { tr } from "../i18n/strings.js";

export type SlashLoopAction =
  | { kind: "proceed" }
  | { kind: "again" }
  | { kind: "exit" }
  | { kind: "send"; text: string };

type SlashCtx = {
  locale: Locale;
  cwd: string;
  workspaceRoot: string;
  trimmed: string;
  getHistory: () => AgentHistoryItem[];
  setHistory: (h: AgentHistoryItem[]) => void;
  persistHistory: (h: AgentHistoryItem[]) => Promise<void>;
  write: (s: string) => void | Promise<void>;
  persistEmpty: () => Promise<void>;
  /** Appended after built-in /help (e.g. skill pack slash_hints). */
  slashHelpExtra?: string;
  /** Required for /compact summary. */
  provider: LLMProvider;
  summarization: { enabled: boolean; threshold: number; keepRecentTurns: number };
};

/**
 * Handle `/…` input. Returns whether the main loop should send text to the model.
 */
export async function handleChatSlashInput(ctx: SlashCtx): Promise<SlashLoopAction> {
  if (!ctx.trimmed.startsWith("/")) return { kind: "proceed" };

  const raw = ctx.trimmed.slice(1).trim();
  const cmd = raw.split(/\s+/)[0]?.toLowerCase() ?? "";

  if (cmd === "exit" || cmd === "quit") {
    return { kind: "exit" };
  }

  if (cmd === "help" || cmd === "h" || cmd === "?") {
    let msg = `${tr(ctx.locale, "slashHelp")}\n`;
    if (ctx.slashHelpExtra) msg += ctx.slashHelpExtra;
    await ctx.write(msg);
    return { kind: "again" };
  }

  if (cmd === "clear" || cmd === "cls") {
    ctx.setHistory([]);
    await ctx.persistEmpty();
    await ctx.write(`${tr(ctx.locale, "slashCleared")}\n`);
    return { kind: "again" };
  }

  if (cmd === "pick") {
    const { listPickCandidatePaths, pickOneRelativePath } = await import("../pick/run-pick.js");
    const paths = await listPickCandidatePaths({
      cwd: ctx.cwd,
      workspaceRoot: ctx.workspaceRoot,
    });
    if (paths.length === 0) {
      await ctx.write(`${tr(ctx.locale, "pickNoMatches")}\n`);
      return { kind: "again" };
    }
    const rel = await pickOneRelativePath({ cwd: ctx.cwd, workspaceRoot: ctx.workspaceRoot });
    if (!rel) {
      await ctx.write(`${tr(ctx.locale, "slashPickCancelled")}\n`);
      return { kind: "again" };
    }
    await ctx.write(`${tr(ctx.locale, "slashPickSelected", { path: rel })}\n`);
    return { kind: "send", text: rel };
  }

  if (cmd === "compact" || cmd === "trim") {
    const rest = raw.slice(cmd.length).trim();

    if (rest === "summary") {
      const history = ctx.getHistory();
      const summarized = await summarizeHistory(history, {
        provider: ctx.provider,
        keepRecentTurns: ctx.summarization.keepRecentTurns,
      });
      ctx.setHistory(summarized);
      await ctx.persistHistory(summarized);
      await ctx.write(`${tr(ctx.locale, "slashCompactSummarized")}\n`);
      return { kind: "again" };
    }

    let keep = 8;
    if (rest.length > 0) {
      const n = parseInt(rest, 10);
      if (!Number.isFinite(n) || n < 1 || n > 64) {
        await ctx.write(`${tr(ctx.locale, "slashCompactUsage")}\n`);
        return { kind: "again" };
      }
      keep = n;
    }
    const before = ctx.getHistory();
    const after = compactHistoryByUserTurns(before, keep);
    if (after.length === before.length) {
      await ctx.write(`${tr(ctx.locale, "slashCompactNoop", { keep: String(keep) })}\n`);
      return { kind: "again" };
    }
    ctx.setHistory(after);
    await ctx.persistHistory(after);
    await ctx.write(
      `${tr(ctx.locale, "slashCompactDone", {
        before: String(before.length),
        after: String(after.length),
        keep: String(keep),
      })}\n`,
    );
    return { kind: "again" };
  }

  await ctx.write(`${tr(ctx.locale, "slashUnknown", { cmd: ctx.trimmed })}\n`);
  return { kind: "again" };
}
