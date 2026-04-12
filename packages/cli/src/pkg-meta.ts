import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flowerForSemver, parseSemverParts } from "./release-flowers.js";

type InariCliPackageJson = {
  version: string;
  inaricode?: { codename?: string };
};

let cachedSemver: string | null = null;
let cachedPkg: InariCliPackageJson | null = null;

function readCliPackageJson(): InariCliPackageJson {
  if (cachedPkg) return cachedPkg;
  const p = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
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
