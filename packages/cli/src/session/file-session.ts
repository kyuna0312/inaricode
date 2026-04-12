import { readFile, writeFile } from "node:fs/promises";
import type { AgentHistoryItem } from "../llm/types.js";

const VERSION = 1;

export type SessionFileV1 = {
  version: typeof VERSION;
  history: AgentHistoryItem[];
};

export async function loadSessionFile(path: string): Promise<AgentHistoryItem[]> {
  try {
    const text = await readFile(path, "utf8");
    const data = JSON.parse(text) as SessionFileV1 | { history?: AgentHistoryItem[] };
    if (data && Array.isArray((data as SessionFileV1).history)) {
      return (data as SessionFileV1).history;
    }
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw e;
  }
  return [];
}

export async function saveSessionFile(path: string, history: AgentHistoryItem[]): Promise<void> {
  const body: SessionFileV1 = { version: VERSION, history };
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}
