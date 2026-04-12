import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flowerForSemver, parseSemverParts } from "./release-flowers.js";

type InariCliPackageJson = {
  version: string;
  inaricode?: { codename?: string };
};

let cachedSemver: string | null = null;
let cachedPkg: InariCliPackageJson | null = null;

/** Root of `@inaricode/cli` on disk (`package.json` directory). */
export function cliPackageRootDir(): string {
  const distDir = dirname(fileURLToPath(import.meta.url));
  return join(distDir, "..");
}

/**
 * Monorepo checkout: `packages/skills/examples` beside `packages/cli`.
 * Omitted from the published npm package — returns `null` for normal installs.
 */
export function resolveBundledSkillsExamplesDir(): string | null {
  const candidate = join(cliPackageRootDir(), "..", "skills", "examples");
  try {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readCliPackageJson(): InariCliPackageJson {
  if (cachedPkg) return cachedPkg;
  const p = join(cliPackageRootDir(), "package.json");
  cachedPkg = JSON.parse(readFileSync(p, "utf8")) as InariCliPackageJson;
  return cachedPkg;
}

/** Semver from `package.json` only (e.g. `0.1.0`). */
export function cliPackageVersion(): string {
  if (cachedSemver) return cachedSemver;
  cachedSemver = readCliPackageJson().version;
  return cachedSemver;
}

export type CliReleaseMeta = {
  /** Full semver string from package.json */
  semver: string;
  major: number;
  minor: number;
  patch: number;
  /** Flower / release name (override or derived from semver) */
  codename: string;
};

/** Parsed semver, patch level, and flower codename for banners and `--version`. */
export function cliPackageReleaseMeta(): CliReleaseMeta {
  const pkg = readCliPackageJson();
  const semver = pkg.version;
  const parts = parseSemverParts(semver) ?? { major: 0, minor: 1, patch: 0 };
  const override = pkg.inaricode?.codename?.trim();
  const codename = override && override.length > 0 ? override : flowerForSemver(parts);
  return {
    semver,
    major: parts.major,
    minor: parts.minor,
    patch: parts.patch,
    codename,
  };
}

/** Single line for CLI UI: version, patch, and flower name. */
export function cliVersionLine(): string {
  const { semver, patch, codename } = cliPackageReleaseMeta();
  return `v${semver} · patch ${patch} · ${codename}`;
}
