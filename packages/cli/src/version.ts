export const VERSION = "0.2.0";

export const FLOWERS = [
  "Sakura", "Rose", "Tulip", "Lotus", "Sunflower",
  "Daisy", "Jasmine", "Lavender", "Orchid", "Cherry"
] as const;

export function getCodename(): string {
  const parts = VERSION.split(".");
  const patch = parseInt(parts[2] ?? "0", 10);
  return FLOWERS[patch % FLOWERS.length];
}

export function versionLine(): string {
  return `v${VERSION} · ${getCodename()}`;
}