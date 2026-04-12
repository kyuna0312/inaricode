import type { Command } from "commander";
import { getProviderCatalog, getProviderCatalogEntry } from "./catalog.js";
import type { MessageKey } from "../i18n/strings.js";

type TranslateFn = (key: MessageKey, vars?: Record<string, string>) => string;

export function registerProvidersCommand(program: Command, tr: TranslateFn): void {
  const prov = program.command("providers").description(tr("cmdProviders"));

  prov
    .command("list")
    .description("List chat providers + Cursor cloud (JSON)")
    .option("--plain", "Tab-separated table instead of JSON", false)
    .action((opts: { plain: boolean }) => {
      const rows = getProviderCatalog();
      if (opts.plain) {
        process.stdout.write("id\tbackend\tlabel\tdefaultModel\tbaseURL\tenvKeys\n");
        for (const r of rows) {
          process.stdout.write(
            `${r.id}\t${r.backend}\t${r.label}\t${r.defaultModel}\t${r.baseURL}\t${r.envKeys.join(",")}\n`,
          );
        }
        return;
      }
      process.stdout.write(`${JSON.stringify({ providers: rows }, null, 2)}\n`);
    });

  prov
    .command("show")
    .description("Show one provider by id (e.g. anthropic, ollama, cursor)")
    .argument("<id>", "Provider id")
    .action((id: string) => {
      const e = getProviderCatalogEntry(id.trim().toLowerCase());
      if (!e) {
        process.stderr.write(`${tr("providersUnknown", { id })}\n`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${JSON.stringify(e, null, 2)}\n`);
    });
}
