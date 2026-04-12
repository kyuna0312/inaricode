/**
 * When **`INARI_LOG=json`**, append one JSON object per line to **stderr** (no ANSI).
 * Use for CI / debugging agent loops (Phase 7).
 */
export function inariJsonLog(event: Record<string, unknown>): void {
  if (process.env.INARI_LOG?.trim().toLowerCase() !== "json") return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    source: "inaricode",
    ...event,
  });
  process.stderr.write(`${line}\n`);
}
