import { describe, expect, it } from "vitest";
import {
  renderBashCompletion,
  renderFishCompletion,
  renderZshCompletion,
} from "../src/completion/render.js";

describe("shell completions", () => {
  it("zsh mentions chat flags and compdef", () => {
    const z = renderZshCompletion();
    expect(z).toContain("compdef _inari inari");
    expect(z).toContain("--provider");
    expect(z).toContain("cursor subcommand");
    expect(z).toContain("skills subcommand");
    expect(z).toContain("mcp");
  });

  it("fish lists cursor verbs", () => {
    const f = renderFishCompletion();
    expect(f).toContain("followup");
    expect(f).toContain("__fish_seen_subcommand_from chat");
  });

  it("bash completes cursor and media subcommands", () => {
    const b = renderBashCompletion();
    expect(b).toContain("launch");
    expect(b).toContain("image video");
    expect(b).toContain("mcp");
  });
});
