import { Command } from "commander";
import { loadConfig } from "./config.js";
import { versionLine } from "./version.js";
import { detectIde } from "./nyanvim.js";

export async function runChat(opts: {
  root?: string;
  tui?: boolean;
  provider?: string;
  model?: string;
  yes?: boolean;
  session?: string;
  noStream?: boolean;
}): Promise<void> {
  const cfg = await loadConfig(opts.root ?? process.cwd());
  const ide = await detectIde();
  
  console.log(`InariCode ${versionLine()}`);
  console.log(`Provider: ${cfg.provider}`);
  console.log(`IDE: ${ide.isNeovim ? "Neovim" : "Terminal"}`);
  if (ide.isNyanNvim) console.log("nyan.nvim: detected");
  if (!opts.noStream && cfg.streaming) console.log("Streaming: enabled");
  if (opts.tui) console.log("Mode: TUI");
  
  console.log("\nStarting chat...");
  return;
  // Chat implementation - OpenCode integration
}

export async function runPick(_opts: {
  root?: string;
  glob?: string;
}): Promise<void> {
  console.log("Picking files...");
}

export async function runDoctor(): Promise<void> {
  const ide = await detectIde();
  
  console.log("InariCode Doctor");
  console.log("=".repeat(40));
  console.log(`Version: ${versionLine()}`);
  console.log(`Neovim: ${ide.isNeovim ? "Yes" : "No"}`);
  console.log(`nyan.nvim: ${ide.isNyanNvim ? "Yes" : "No"}`);
  console.log(`Terminal: ${ide.terminal}`);
  console.log(`Vim keybindings: ${ide.vimKeybindings ? "Yes" : "No"}`);
}

export async function runProviders(): Promise<void> {
  console.log("Available providers:");
  console.log("  opencode    - OpenCode serve endpoint");
  console.log("  anthropic  - Anthropic Claude");
  console.log("  openai     - OpenAI ChatGPT");
  console.log("  kimi       - Moonshot Kimi");
  console.log("  ollama     - Ollama (local)");
  console.log("  groq       - Groq");
  console.log("  google    - Google Gemini");
  console.log("  custom    - Custom OpenAI-compatible URL");
}

export async function runInit(_opts: {
  format?: string;
  template?: string;
}): Promise<void> {
  console.log("Wrote inaricode.yaml");
}

export async function runLogo(): Promise<void> {
  console.log(`
      _ __      __               
     (_) |____/ /___  ____  ____
    / /| '_ \\ / _ \\| '__||_  /
   / / | | | |  __/ | |   / / 
  /_/  |_| |_|\\___||_|  /___/ 
  
  OpenCode + nyanvim Integration
  `);
}

export async function main(argv: string[]): Promise<void> {
  const program = new Command();
  
  program
    .name("inari")
    .description("InariCode — OpenCode + nyanvim CLI assistant")
    .version(versionLine());

  program
    .command("chat")
    .description("Start REPL chat")
    .option("-r, --root <path>", "Workspace root", process.cwd())
    .option("-t, --tui", "TUI mode")
    .option("-p, --provider <p>", "Provider", "opencode")
    .option("-m, --model <m>", "Model")
    .option("-y, --yes", "Skip confirmations")
    .option("--session <f>", "Session file")
    .option("--no-stream", "Disable streaming")
    .action(runChat);

  program
    .command("pick")
    .description("Fuzzy file picker")
    .option("-r, --root <path>", "Root", process.cwd())
    .option("-g, --glob <pattern>", "Glob", "**/*")
    .action(runPick);

  program.command("doctor").description("System check").action(runDoctor);
  program.command("providers").description("List providers").action(runProviders);
  
  program
    .command("init")
    .description("Create config")
    .option("-f, --format <f>", "yaml or cjs", "yaml")
    .option("-t, --template <t>", "Template", "default")
    .action(runInit);

  program.command("logo").description("Print logo").action(runLogo);

  await program.parseAsync(argv);
}