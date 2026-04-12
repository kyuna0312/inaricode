import type { Locale } from "./locale.js";

const EN = {
  programDescription: "InariCode — CLI AI coding assistant (kitsune · Inari)",
  cmdLogo: "Print the InariCode ASCII banner and path to the mascot PNG",
  cmdInit: "Write example inaricode.config.cjs in the current directory",
  cmdDoctor: "Check CLI and native engine wiring",
  cmdChat: "REPL: Claude / ChatGPT / Kimi / Qwen / Ollama / … + Rust engine tools",
  optRoot: "Workspace root (default: cwd)",
  optYes: "Skip confirmation for write/search_replace/shell",
  optSession: "Load/save JSON conversation history (relative to cwd)",
  optNoStream: "Disable token streaming (buffer each model reply)",
  optReadOnly: "Only read_file, list_dir, grep (overrides config if set)",
  optTui: "Ink terminal UI instead of readline",
  initWrote: "Wrote {path}",
  logoBundledPng: "Bundled mascot PNG:",
  engineNotBuilt: "inaricode-engine: not built or INARI_ENGINE_PATH unset",
  doctorEngineTransport: "engine transport: {transport}",
  doctorEngineIpcOk: "engine ipc: ok {detail}",
  doctorEngineIpcFail: "engine ipc: failed {detail}",
  doctorSidecarUnresolved:
    "sidecar: enabled in config but command/script not resolved (set sidecar.command or INARI_SIDECAR_CMD)",
  doctorSidecarPingOk: "sidecar ping: ok",
  doctorSidecarPingFail: "sidecar ping: {detail}",
  doctorSidecarOff: "sidecar: off (set sidecar.enabled for codebase_search)",
  doctorEmbeddingsLine: "embeddings: {model} @ {base}",
  doctorEmbeddingsOk: "embeddings API: ok",
  doctorEmbeddingsFail: "embeddings API: {detail}",
  doctorEmbeddingsOff: "embeddings: off (set embeddings.enabled for semantic_codebase_search)",
  doctorEmbeddingsSkipped: "embeddings: skipped (load full config failed — check API keys)",
  logoSub: "AI coding assistant · Rust engine · multi-LLM",
  logoKitsune: "kitsune for your codebase",
  logoUsb: "USB",
  logoCommands: "inari chat · inari doctor · inari logo",
  logoMascot: "Mascot: {path}",
  logoMascotMissing: "(install @inaricode/cli with assets)",
  logoCompactHints: "chat | doctor | logo",
  chatTitle: "InariCode chat — provider: {provider}, model: {model}",
  chatTuiTitle: "InariCode (TUI) — provider: {provider}, model: {model}",
  chatReadOnly: ", read-only",
  chatStreaming: ", streaming",
  chatNoStream: ", no stream",
  chatSession: "Session: {path}",
  chatHint: "Type a message, or 'exit' / 'quit'. Mutating tools prompt unless --yes.",
  chatRoot: "root: {path}",
  confirmBlock: "\n[confirm: {title}]\n{body}\n",
  confirmPrompt: "Proceed? [y/N] ",
  confirmTitle: "Confirm:",
  tuiConfirmYes: "[y] yes  [n] no  [Esc] no  (mn: т/г)",
  tuiBusy: "…",
} as const;

const MN: Record<keyof typeof EN, string> = {
  programDescription: "InariCode — CLI AI код бичих туслах (үнэхээр · Инарь)",
  cmdLogo: "InariCode ASCII баннер бол дүрслэлийн PNG-ийн замыг хэвлэх",
  cmdInit: "Жишээ inaricode.config.cjs файлыг одоогийн хавтсанд бичих",
  cmdDoctor: "CLI болон угсарсан engine-ийн холболтыг шалгах",
  cmdChat: "REPL: Claude / ChatGPT / Kimi / Qwen / Ollama / … + Rust engine хэрэгслүүд",
  optRoot: "Ажлын сан (анхдагч: одоогийн хавтас)",
  optYes: "write/search_replace/shell баталгааг алгасах",
  optSession: "Ярианы түүхийг JSON-оор ачаалах/хадгалах (cwd-тэй харьцах зам)",
  optNoStream: "Токен урсгалыг унтраах (моделийн хариу бүтэн буферлэх)",
  optReadOnly: "Зөвхөн read_file, list_dir, grep (тохиргоог дарж бичнэ)",
  optTui: "Readline-ийн оронд Ink терминал UI",
  initWrote: "Бичсэн: {path}",
  logoBundledPng: "Дүрслэлийн PNG:",
  engineNotBuilt: "inaricode-engine: бүтээгдээгүй эсвэл INARI_ENGINE_PATH тохируулаагүй",
  doctorEngineTransport: "engine transport: {transport}",
  doctorEngineIpcOk: "engine ipc: ok {detail}",
  doctorEngineIpcFail: "engine ipc: алдаа {detail}",
  doctorSidecarUnresolved:
    "sidecar: тохиргоонд идэвхтэй боловч командыг олсонгүй (sidecar.command эсвэл INARI_SIDECAR_CMD)",
  doctorSidecarPingOk: "sidecar ping: ok",
  doctorSidecarPingFail: "sidecar ping: {detail}",
  doctorSidecarOff: "sidecar: унтраалттай (codebase_search-д sidecar.enabled)",
  doctorEmbeddingsLine: "embeddings: {model} @ {base}",
  doctorEmbeddingsOk: "embeddings API: ok",
  doctorEmbeddingsFail: "embeddings API: {detail}",
  doctorEmbeddingsOff: "embeddings: унтраалттай (semantic_codebase_search-д embeddings.enabled)",
  doctorEmbeddingsSkipped: "embeddings: алгассан (бүтэн тохиргоо ачаалахад алдаа — API түлхүүр шалгана уу)",
  logoSub: "AI кодын туслах · Rust engine · олон LLM",
  logoKitsune: "кодын санд тань — kitsune",
  logoUsb: "USB",
  logoCommands: "inari chat · inari doctor · inari logo",
  logoMascot: "Дүрслэл: {path}",
  logoMascotMissing: "(@inaricode/cli assets-тай суулгана уу)",
  logoCompactHints: "chat | doctor | logo",
  chatTitle: "InariCode chat — үйлчилгүүр: {provider}, загвар: {model}",
  chatTuiTitle: "InariCode (TUI) — үйлчилгүүр: {provider}, загвар: {model}",
  chatReadOnly: ", зөвхөн унших",
  chatStreaming: ", урсгалтай",
  chatNoStream: ", урсгалгүй",
  chatSession: "Session: {path}",
  chatHint:
    "Мессеж бичнэ үү, эсвэл 'exit' / 'quit' / 'гарах'. --yes байхгүй бол өөрчлөлтийн баталгаа асуух.",
  chatRoot: "root: {path}",
  confirmBlock: "\n[баталгаа: {title}]\n{body}\n",
  confirmPrompt: "Үргэлжлүүлэх үү? [т/г] (эсвэл y/n) ",
  confirmTitle: "Баталгаа:",
  tuiConfirmYes: "[т] тийм  [г] үгүй  [Esc] үгүй  (y/n)",
  tuiBusy: "…",
};

export type MessageKey = keyof typeof EN;

const TABLES: Record<Locale, Record<MessageKey, string>> = {
  en: EN,
  mn: MN,
};

export function tr(locale: Locale, key: MessageKey, vars?: Record<string, string>): string {
  let s: string = TABLES[locale][key] ?? TABLES.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(v);
    }
  }
  return s;
}
