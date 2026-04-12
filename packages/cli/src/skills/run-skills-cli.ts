import type { Command } from "commander";
import { knownChatToolNames } from "../llm/inari-tools.js";
import { loadSkillPack } from "./load-pack.js";
import { loadSkillPackPathsFromConfig } from "./read-pack-config.js";
import type { MessageKey } from "../i18n/strings.js";

type TranslateFn = (key: MessageKey, vars?: Record<string, string>) => string;

export function registerSkillsCommand(program: Command, tr: TranslateFn): void {
  const skills = program.command("skills").description(tr("cmdSkills"));

  skills
    .command("list")
    .description(tr("cmdSkillsList"))
    .action(async () => {
      const cwd = process.cwd();
      const paths = await loadSkillPackPathsFromConfig(cwd);
      if (paths.length === 0) {
        process.stdout.write(`${tr("skillsListEmpty")}\n`);
        return;
      }
      process.stdout.write(`${tr("skillsListHeader")}\n`);
      const known = knownChatToolNames({
        readOnly: false,
        includeCodebaseSearch: true,
        includeSemanticSearch: true,
      });
      for (const p of paths) {
        try {
          const pack = await loadSkillPack(cwd, p);
          const m = pack.manifest;
          const allowed = m.tools_allow.filter((t) => known.has(t));
          const unknown = m.tools_allow.length - allowed.length;
          process.stdout.write(`- ${m.id}@${m.version}  ${m.name}\n`);
          process.stdout.write(`  path: ${p}\n`);
          process.stdout.write(`  tools: ${allowed.join(", ")}${unknown > 0 ? ` (+${unknown} not in default session)` : ""}\n`);
        } catch (e) {
          process.stderr.write(`${tr("skillsListError", { path: p, detail: String(e) })}\n`);
        }
      }
    });
}
