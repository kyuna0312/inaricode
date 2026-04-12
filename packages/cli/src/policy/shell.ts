/** Default deny rules (case-insensitive substring match on trimmed command). */
export const DEFAULT_SHELL_DENY_SUBSTRINGS: string[] = [
  "rm -rf /",
  "rm -rf ~/",
  "mkfs.",
  "dd if=",
  "> /dev/sd",
  "| sh",
  "| bash",
  "curl |",
  "wget |",
];

export type ResolvedShellPolicy = {
  denySubstrings: string[];
  /** If non-empty, the trimmed command must start with one of these prefixes */
  allowCommandPrefixes: string[];
};

export type ShellPolicyConfig = {
  denySubstrings?: string[];
  allowCommandPrefixes?: string[];
};

export function resolveShellPolicy(config?: ShellPolicyConfig): ResolvedShellPolicy {
  const deny = [...DEFAULT_SHELL_DENY_SUBSTRINGS, ...(config?.denySubstrings ?? [])];
  const allow = (config?.allowCommandPrefixes ?? []).filter((s) => s.length > 0);
  return { denySubstrings: deny, allowCommandPrefixes: allow };
}

export function assertShellAllowed(command: string, policy: ResolvedShellPolicy): void {
  const c = command.trim().toLowerCase();
  for (const bad of policy.denySubstrings) {
    if (c.includes(bad.toLowerCase())) {
      throw new Error(`Command blocked by policy (matched "${bad}")`);
    }
  }
  const t = command.trim();
  if (policy.allowCommandPrefixes.length > 0) {
    const ok = policy.allowCommandPrefixes.some((p) => t.startsWith(p));
    if (!ok) {
      throw new Error(
        `Command not allowed: must start with one of: ${policy.allowCommandPrefixes.join(", ")}`,
      );
    }
  }
}
