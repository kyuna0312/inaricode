import React from "react";
import { resolve } from "node:path";
import { render } from "ink";
import { loadPickerSettings } from "../config.js";
import { tr } from "../i18n/strings.js";
import { loadLocalePreference } from "../i18n/locale.js";
import { collectPickCandidates } from "./collect-files.js";
import { pickWithFzf } from "./fzf.js";
import { PickTui } from "./pick-tui.js";

export type RunPickOptions = {
  cwd: string;
  workspaceRoot: string;
  /** Glob pattern; defaults to config `picker.defaultFileGlob` or all files. */
  glob?: string;
  /** Override config: builtin | fzf */
  picker?: "builtin" | "fzf";
};

/** Same glob/rules as `pickOneRelativePath`, without opening a picker (for `/pick` preflight). */
export async function listPickCandidatePaths(opts: RunPickOptions): Promise<string[]> {
  const { glob } = await resolvePickModeAndGlob(opts);
  return collectPickCandidates(opts.workspaceRoot, glob);
}

async function resolvePickModeAndGlob(opts: RunPickOptions): Promise<{
  mode: "builtin" | "fzf";
  glob: string;
  fzfPath: string;
  locale: Awaited<ReturnType<typeof loadLocalePreference>>;
}> {
  const locale = await loadLocalePreference(opts.cwd);
  const settings = await loadPickerSettings(opts.cwd);
  const envPicker =
    process.env.INARI_PICKER === "fzf"
      ? "fzf"
      : process.env.INARI_PICKER === "builtin"
        ? "builtin"
        : undefined;
  const mode = opts.picker ?? envPicker ?? settings.mode;
  const glob = opts.glob ?? settings.defaultFileGlob;
  return { mode, glob, fzfPath: settings.fzfPath, locale };
}

/**
 * Interactive file pick; returns **relative** path from `workspaceRoot`, or `null` if cancelled / none.
 */
export async function pickOneRelativePath(opts: RunPickOptions): Promise<string | null> {
  const { mode, glob, fzfPath, locale } = await resolvePickModeAndGlob(opts);
  const paths = await collectPickCandidates(opts.workspaceRoot, glob);
  if (paths.length === 0) {
    return null;
  }

  const title = tr(locale, "pickTitle", { count: String(paths.length) });
  let choice: string | null = null;

  if (mode === "fzf") {
    choice = await pickWithFzf(paths, fzfPath, "inari");
    if (choice === null) {
      process.stderr.write(`${tr(locale, "pickFzfFallback")}\n`);
    }
  }

  if (choice === null) {
    let chosen: string | null = null;
    let cancelled = false;
    const { waitUntilExit } = render(
      React.createElement(PickTui, {
        items: paths,
        title,
        onChoose: (line: string) => {
          chosen = line;
        },
        onCancel: () => {
          cancelled = true;
        },
      }),
    );
    await waitUntilExit();
    if (cancelled) {
      return null;
    }
    choice = chosen;
  }

  return choice;
}

export async function runPick(opts: RunPickOptions): Promise<void> {
  const locale = await loadLocalePreference(opts.cwd);
  const { glob } = await resolvePickModeAndGlob(opts);
  const paths = await collectPickCandidates(opts.workspaceRoot, glob);
  if (paths.length === 0) {
    process.stderr.write(`${tr(locale, "pickNoMatches")}\n`);
    process.exitCode = 1;
    return;
  }
  const choice = await pickOneRelativePath(opts);
  if (!choice) {
    process.stderr.write(`${tr(locale, "pickCancelled")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${resolve(opts.workspaceRoot, choice)}\n`);
}
