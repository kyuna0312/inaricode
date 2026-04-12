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

export async function runPick(opts: RunPickOptions): Promise<void> {
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
  const paths = await collectPickCandidates(opts.workspaceRoot, glob);
  if (paths.length === 0) {
    process.stderr.write(`${tr(locale, "pickNoMatches")}\n`);
    process.exitCode = 1;
    return;
  }

  const title = tr(locale, "pickTitle", { count: String(paths.length) });
  let choice: string | null = null;

  if (mode === "fzf") {
    choice = await pickWithFzf(paths, settings.fzfPath, "inari");
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
      process.stderr.write(`${tr(locale, "pickCancelled")}\n`);
      process.exitCode = 1;
      return;
    }
    choice = chosen;
  }

  if (choice) {
    process.stdout.write(`${resolve(opts.workspaceRoot, choice)}\n`);
  } else {
    process.stderr.write(`${tr(locale, "pickCancelled")}\n`);
    process.exitCode = 1;
  }
}
