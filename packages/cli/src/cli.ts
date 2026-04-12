#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig, loadSidecarDoctorInfo, writeExampleConfig } from "./config.js";
import { engineRequest, resolveEngineBinary, resolveEngineTransport } from "./engine/client.js";
import { sidecarRpc } from "./sidecar/client.js";
import { pingEmbeddings } from "./tools/embeddings-api.js";
import { cliPackageVersion } from "./pkg-meta.js";
import {
  inariHelpPreamble,
  inariLogoBannerFull,
  resolveBundledLogoPath,
} from "./ui/logo.js";
import { loadLocalePreference, type Locale } from "./i18n/locale.js";
import { tr, type MessageKey } from "./i18n/strings.js";

const pkgVersion = cliPackageVersion();

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
    .version(pkgVersion)
    .addHelpText("before", inariHelpPreamble(pkgVersion, locale));

  program
    .command("logo")
    .description(L("cmdLogo"))
    .action(() => {
      process.stdout.write(inariLogoBannerFull(pkgVersion, locale));
      const png = resolveBundledLogoPath();
      if (png) {
        process.stdout.write(`${L("logoBundledPng")}\n  ${png}\n`);
      }
    });

  program
    .command("init")
    .description(L("cmdInit"))
    .action(async () => {
      const p = await writeExampleConfig(cwd, locale);
      process.stdout.write(`${L("initWrote", { path: p })}\n`);
    });

  program
    .command("doctor")
    .description(L("cmdDoctor"))
    .action(async () => {
      process.stdout.write(inariLogoBannerFull(pkgVersion, locale));
      process.stdout.write(`${await engineVersionLine(locale)}\n`);
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
    .action(
      async (opts: {
        root: string;
        yes: boolean;
        session?: string;
        noStream: boolean;
        readOnly: boolean;
        tui: boolean;
      }) => {
        const { resolveWorkspaceRoot } = await import("./ui/chat-repl.js");
        const workspaceRoot = resolveWorkspaceRoot(opts.root || undefined, cwd);
        const common = {
          cwd,
          workspaceRoot,
          skipConfirm: Boolean(opts.yes),
          sessionFile: opts.session,
          noStream: Boolean(opts.noStream),
          readOnlyCli: Boolean(opts.readOnly),
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
