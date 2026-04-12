import { describe, expect, it } from "vitest";
import { flowerForSemver, parseSemverParts, RELEASE_FLOWERS } from "../src/release-flowers.js";

describe("parseSemverParts", () => {
  it("parses X.Y.Z", () => {
    expect(parseSemverParts("0.1.0")).toEqual({ major: 0, minor: 1, patch: 0 });
    expect(parseSemverParts("2.10.3-rc.1")).toEqual({ major: 2, minor: 10, patch: 3 });
  });

  it("returns null for garbage", () => {
    expect(parseSemverParts("v1")).toBeNull();
  });
});

describe("flowerForSemver", () => {
  it("is stable for a given version", () => {
    const a = flowerForSemver({ major: 0, minor: 1, patch: 0 });
    const b = flowerForSemver({ major: 0, minor: 1, patch: 0 });
    expect(a).toBe(b);
    expect(RELEASE_FLOWERS).toContain(a);
  });

  it("covers the flower table", () => {
    expect(RELEASE_FLOWERS.length).toBeGreaterThan(10);
    expect(flowerForSemver({ major: 0, minor: 0, patch: 0 })).toMatch(/^[A-Za-z ]+$/);
  });
});
