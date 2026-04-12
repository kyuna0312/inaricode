import { describe, expect, it } from "vitest";
import { redactToolOutput } from "../src/tools/redact.js";

describe("redactToolOutput", () => {
  it("redacts AWS access key id", () => {
    const s = redactToolOutput("key=AKIAIOSFODNN7EXAMPLE");
    expect(s).toContain("[REDACTED]");
    expect(s).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("redacts sk-ant style keys", () => {
    const s = redactToolOutput("ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890AB");
    expect(s).toContain("[REDACTED]");
  });

  it("redacts assignment-style secrets", () => {
    const s = redactToolOutput("config: api_key=supersecretvaluehere");
    expect(s).toContain("[REDACTED]");
  });
});
