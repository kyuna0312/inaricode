#!/usr/bin/env node
import { Command, Option } from "commander";
import {
  loadConfig,
  loadDoctorChatHints,
  loadSidecarDoctorInfo,
  writeExampleInariConfig,
  type InariInitTemplate,
} from "./config.js";
import { engineRequest, resolveEngineBinary, resolveEngineTransport } from "./engine/client.js";
import { sidecarRpc } from "./sidecar/client.js";
import { pingEmbeddings } from "./tools/embeddings-api.js";
import { cliVersionLine, resolveBundledSkillsExamplesDir } from "./pkg-meta.js";
import {
  inariHelpPreamble,
  inariLogoBannerFull,
  resolveBundledLogoPath,
} from "./ui/logo.js";
import { loadLocalePreference, type Locale } from "./i18n/locale.js";
import { tr, type MessageKey } from "./i18n/strings.js";
import { registerCursorCommand } from "./cursor-api/run-cursor-cli.js";
import { registerProvidersCommand } from "./providers/run-providers-cli.js";
import { registerSkillsCommand } from "./skills/run-skills-cli.js";
import { registerMcpCommand } from "./mcp/run-mcp-cli.js";
import { inariProfileFromEnv } from "./config-paths.js";
import { resolveWorkspaceRoot } from "./workspace-root.js";
import { loadSkillPackPathsFromConfig } from "./skills/read-pack-config.js";
import { resolveSkillsContext } from "./skills/resolve-context.js";
import { knownChatToolNames } from "./llm/inari-tools.js";
import { validateProductionEnv, printValidationResult } from "./utils/env-validator.js";

const versionLine = cliVersionLine();

async function engineVersionLine(locale: Locale): Promise<string> {
  try {
    const bin = resolveEngineBinary();
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(bin, ["--version"]);
    return stdout.toString().trim();
  } catch {
    return tr(locale, "engineNotBuilt");
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const locale = await loadLocalePreference(cwd);
  const L = (key: MessageKey, vars?: Record<string, string>) => tr(locale, key, vars);

  const program = new Command();
  program
    .name("inari")
    .description(L("programDescription"))
    .version(versionLine)
    .addHelpText("before", inariHelpPreamble(versionLine, locale));

  program
    .command("logo")
    .description(L("cmdLogo"))
    .action(() => {
      process.stdout.write(inariLogoBannerFull(versionLine, locale));
      const png = resolveBundledLogoPath();
      if (png) {
        process.stdout.write(`${L("logoBundledPng")}\n  ${png}\n`);
      }
    });

  program
    .command("init")
    .description(L("cmdInit"))
    .addOption(
      new Option("--format <fmt>", L("optInitFormat")).choices(["yaml", "cjs"] as const).default("yaml"),
    )
    .addOption(
      new Option("--template <name>", L("optInitTemplate")).choices(["default", "beginner"] as const).default("default"),
    )
    .action(async (opts: { format: "yaml" | "cjs"; template: InariInitTemplate }) => {
      const p = await writeExampleInariConfig(cwd, locale, opts.format, opts.template);
      process.stdout.write(`${L("initWrote", { path: p })}\n`);
    });

  program
    .command("doctor")
    .description(L("cmdDoctor"))
    .action(async () => {
      process.stdout.write(inariLogoBannerFull(versionLine, locale));
      process.stdout.write(`${await engineVersionLine(locale)}\n`);

      // Production environment validation
      const envResult = validateProductionEnv();
      if (envResult.warnings.length > 0 || envResult.errors.length > 0) {
        process.stdout.write("\n");
        printValidationResult(envResult);
        process.stdout.write("\n");
        if (envResult.errors.length > 0) {
          process.exitCode = 1;
        }
      }

      let transport: string;
      try {
        transport = await resolveEngineTransport();
      } catch (e) {
        transport = `error: ${String(e)}`;
      }
      process.stdout.write(`${L("doctorEngineTransport", { transport })}\n`);
      const reply = await engineRequest({
        id: "1",
        cmd: "echo",
        workspace: process.cwd(),
        payload: { hello: "world" },
      });
      if (reply.ok) {
        process.stdout.write(`${L("doctorEngineIpcOk", { detail: JSON.stringify(reply.result) })}\n`);
      } else {
        process.stderr.write(`${L("doctorEngineIpcFail", { detail: reply.error })}\n`);
        process.exitCode = 1;
      }
      const sc = await loadSidecarDoctorInfo(process.cwd());
      if (sc.enabledInConfig && !sc.argv) {
        process.stderr.write(`${L("doctorSidecarUnresolved")}\n`);
        process.exitCode = 1;
      } else if (sc.argv) {
        process.stdout.write(`sidecar: ${sc.argv.join(" ")}\n`);
        try {
          await sidecarRpc(sc.argv, { id: "doctor", method: "ping", params: {} });
          process.stdout.write(`${L("doctorSidecarPingOk")}\n`);
        } catch (e) {
          process.stderr.write(`${L("doctorSidecarPingFail", { detail: String(e) })}\n`);
          process.exitCode = 1;
        }
      } else {
        process.stdout.write(`${L("doctorSidecarOff")}\n`);
      }
      try {
        const cfg = await loadConfig(process.cwd());
        if (cfg.embeddings.client) {
          const c = cfg.embeddings.client;
          process.stdout.write(`${L("doctorEmbeddingsLine", { model: c.model, base: c.baseURL })}\n`);
          try {
            await pingEmbeddings(c);
            process.stdout.write(`${L("doctorEmbeddingsOk")}\n`);
          } catch (e) {
            process.stderr.write(`${L("doctorEmbeddingsFail", { detail: String(e) })}\n`);
            process.exitCode = 1;
          }
        } else {
          process.stdout.write(`${L("doctorEmbeddingsOff")}\n`);
        }
      } catch {
        process.stdout.write(`${L("doctorEmbeddingsSkipped")}\n`);
      }
      const skillsEx = resolveBundledSkillsExamplesDir();
      if (skillsEx) {
        process.stdout.write(`${L("doctorSkillsExamplesAt", { path: skillsEx })}\n`);
      } else {
        process.stdout.write(`${L("doctorSkillsExamplesNone")}\n`);
      }
      const chatHints = await loadDoctorChatHints(process.cwd());
      if (chatHints) {
        process.stdout.write(
          `${L("doctorChatSession", {
            maxHistory: String(chatHints.maxHistoryItems),
            maxSteps: String(chatHints.maxAgentSteps),
          })}\n`,
        );
      }
      const profile = inariProfileFromEnv();
      if (profile) {
        process.stdout.write(`${L("doctorConfigProfile", { profile })}\n`);
      }
      const skillPaths = await loadSkillPackPathsFromConfig(process.cwd());
      if (skillPaths.length === 0) {
        process.stdout.write(`${L("doctorSkillsNone")}\n`);
      } else {
        const known = knownChatToolNames({
          readOnly: false,
          includeCodebaseSearch: true,
          includeSemanticSearch: true,
        });
        const sc = await resolveSkillsContext(process.cwd(), skillPaths, known);
        if (sc.packs.length > 0) {
          const ids = sc.packs.map((p) => p.manifest.id).join(", ");
          process.stdout.write(`${L("doctorSkillsActive", { ids, count: String(sc.packs.length) })}\n`);
        }
        for (const iss of sc.issues) {
          process.stderr.write(`${L("doctorSkillsLoadIssue", { detail: `${iss.path}: ${iss.message}` })}\n`);
          if (skillPaths.includes(iss.path) || iss.path === "(skills)") {
            process.exitCode = 1;
          }
        }
      }
    });

  registerCursorCommand(program, L);
  registerProvidersCommand(program, L);
  registerSkillsCommand(program, L);
  registerMcpCommand(program, L);

  const media = program.command("media").description(L("cmdMedia"));
  media
    .command("image")
    .description(L("cmdMediaImage"))
    .requiredOption("-p, --prompt <text>", "Image prompt")
    .option("-o, --output <path>", "Output file", "inari-image.png")
    .option(
      "-m, --model <id>",
      "Hugging Face model id (e.g. black-forest-labs/FLUX.1-schnell)",
      "black-forest-labs/FLUX.1-schnell",
    )
    .option("--provider <name>", "huggingface (default) or google", "huggingface")
    .option("--token <secret>", "Override HF_TOKEN for this run")
    .action(
      async (opts: { prompt: string; output: string; model: string; provider: string; token?: string }) => {
        const { runMediaImage } = await import("./media/run-media.js");
        await runMediaImage({ cwd, ...opts });
      },
    );
  media
    .command("video")
    .description(L("cmdMediaVideo"))
    .action(async () => {
      const { runMediaVideo } = await import("./media/run-media.js");
      await runMediaVideo({ cwd });
    });

  program
    .command("pick")
    .description(L("cmdPick"))
    .option("--root <path>", L("optRoot"), "")
    .option("--glob <pattern>", L("optPickGlob"))
    .option("--picker <mode>", L("optPicker"))
    .action(
      async (opts: { root: string; glob?: string; picker?: string }) => {
        const { runPick } = await import("./pick/run-pick.js");
        const workspaceRoot = resolveWorkspaceRoot(opts.root || undefined, cwd);
        let picker: "builtin" | "fzf" | undefined;
        if (opts.picker === "fzf") picker = "fzf";
        else if (opts.picker === "builtin") picker = "builtin";
        await runPick({ cwd, workspaceRoot, glob: opts.glob, picker });
      },
    );

  program
    .command("completion")
    .description(L("cmdCompletion"))
    .argument("<shell>", "zsh | fish | bash")
    .action(async (shell: string) => {
      const { renderCompletion } = await import("./completion/render.js");
      const body = renderCompletion(shell.trim());
      if (!body) {
        process.stderr.write(`${L("completionInvalidShell", { shell })}\n`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(body);
      if (!body.endsWith("\n")) process.stdout.write("\n");
    });

  program
    .command("chat")
    .description(L("cmdChat"))
    .option("--root <path>", L("optRoot"), "")
    .option("-y, --yes", L("optYes"), false)
    .option("--session <path>", L("optSession"))
    .option("--no-stream", L("optNoStream"), false)
    .option("--read-only", L("optReadOnly"), false)
    .option("--tui", L("optTui"), false)
    .option("--plain", L("optPlain"), false)
    .option("--provider <id>", L("optChatProvider"))
    .option("--model <id>", L("optChatModel"))
    .action(
      async (opts: {
        root: string;
        yes: boolean;
        session?: string;
        noStream: boolean;
        readOnly: boolean;
        tui: boolean;
        plain: boolean;
        provider?: string;
        model?: string;
      }) => {
        const workspaceRoot = resolveWorkspaceRoot(opts.root || undefined, cwd);
        const common = {
          cwd,
          workspaceRoot,
          skipConfirm: Boolean(opts.yes),
          sessionFile: opts.session,
          noStream: Boolean(opts.noStream),
          readOnlyCli: Boolean(opts.readOnly),
          plainCli: Boolean(opts.plain),
          providerCli: opts.provider,
          modelCli: opts.model,
        };
        if (opts.tui) {
          const { runChatTui } = await import("./ui/chat-tui.js");
          await runChatTui(common);
        } else {
          const { runChatRepl } = await import("./ui/chat-repl.js");
          await runChatRepl(common);
        }
      },
    );

  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
}

void main();
