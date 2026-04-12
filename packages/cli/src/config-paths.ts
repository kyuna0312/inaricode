/** Shared cosmiconfig search list for `inaricode` (config + locale discovery). */
export const INARICODE_CONFIG_SEARCH_PLACES = [
  "inaricode.yaml",
  "inaricode.yml",
  "inaricode.config.cjs",
  "inaricode.config.mjs",
  "inaricode.config.js",
  ".inaricoderc.json",
  ".inaricoderc.yaml",
  ".inaricoderc.yml",
] as const;
