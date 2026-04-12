import type { AgentHistoryItem } from "../llm/types.js";

/** Split history into segments, each starting with a `user_text` item. */
export function segmentHistoryByUserTurns(history: AgentHistoryItem[]): AgentHistoryItem[][] {
  const segments: AgentHistoryItem[][] = [];
  let cur: AgentHistoryItem[] = [];
  for (const item of history) {
    if (item.kind === "user_text") {
      if (cur.length > 0) segments.push(cur);
      cur = [item];
    } else {
      cur.push(item);
    }
  }
  if (cur.length > 0) segments.push(cur);
  return segments;
}

/**
 * Keep only the last `keepUserTurns` user-led segments (each segment begins with `user_text`).
 * Drops older context to reduce tokens on the next model call. Does not summarize — lossy trim.
 */
export function compactHistoryByUserTurns(
  history: AgentHistoryItem[],
  keepUserTurns: number,
): AgentHistoryItem[] {
  if (keepUserTurns < 1) return history;
  const segments = segmentHistoryByUserTurns(history);
  if (segments.length <= keepUserTurns) return history;
  return segments.slice(-keepUserTurns).flat();
}
