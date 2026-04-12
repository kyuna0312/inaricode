/** Subsequence fuzzy score: higher is better; -1 = no match. */
export function fuzzyScore(pattern: string, candidate: string): number {
  const p = pattern.toLowerCase();
  const s = candidate.toLowerCase();
  if (p.length === 0) return 0;
  let pi = 0;
  let score = 0;
  let consecutive = 0;
  for (let i = 0; i < s.length && pi < p.length; i++) {
    const ch = s.charAt(i);
    if (ch === p.charAt(pi)) {
      score += 12 + consecutive * 6;
      const prev = i > 0 ? s.charAt(i - 1) : "/";
      if (/[/._\-\\]/.test(prev)) score += 8;
      if (i === 0 || prev === "/") score += 4;
      consecutive++;
      pi++;
    } else {
      consecutive = 0;
    }
  }
  return pi === p.length ? score : -1;
}

export function filterFuzzySorted(pattern: string, candidates: string[], limit = 500): string[] {
  const scored: { s: string; sc: number }[] = [];
  for (const c of candidates) {
    const sc = fuzzyScore(pattern, c);
    if (sc >= 0) scored.push({ s: c, sc });
  }
  scored.sort((a, b) => {
    if (b.sc !== a.sc) return b.sc - a.sc;
    return a.s.localeCompare(b.s);
  });
  return scored.slice(0, limit).map((x) => x.s);
}
