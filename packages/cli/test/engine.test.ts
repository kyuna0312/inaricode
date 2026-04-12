import { describe, expect, it } from "vitest";
import { engineRequest, resolveEngineBinary } from "../src/engine/client.js";

describe("inaricode-engine IPC", () => {
  it("resolves engine binary", () => {
    const bin = resolveEngineBinary();
    expect(bin).toMatch(/inaricode-engine$/);
  });

  it("echo roundtrip", async () => {
    const reply = await engineRequest({
      id: "e1",
      cmd: "echo",
      workspace: process.cwd(),
      payload: { x: 1 },
    });
    expect(reply.ok).toBe(true);
    if (reply.ok) {
      expect((reply.result as { pong?: boolean }).pong).toBe(true);
    }
  });
});
