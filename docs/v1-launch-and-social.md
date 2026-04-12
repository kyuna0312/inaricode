# v1 launch: social and community

Notes for when **InariCode v1** ships as an open-source project — how to announce it without spamming, and how to help newcomers try it.

## Before you post

- **One clear sentence:** what it is, who it is for, and one concrete benefit (e.g. local CLI agent, Rust-sandboxed engine, confirmed edits). Avoid a long feature list in the first line.
- **Show, don’t tell:** a **short screen recording** (terminal: `inari doctor` → one real task) converts better than screenshots alone.
- **Links ready:** GitHub repo, install / build steps, **CHANGELOG** or GitHub **Release** notes for v1.
- **Honest limits:** platform support, optional native build, which LLM keys are needed — reduces frustration and builds trust.

## Channels (pick a few)

| Channel | Tip |
|---------|-----|
| **X / Bluesky / Mastodon** | Clip + one paragraph + link; reply to questions quickly. |
| **Reddit** | Post only where it fits (`r/commandline`, `r/rust`, `r/node`, etc.); **read subreddit rules**; participate in threads, don’t drive-by advertise. |
| **Hacker News** | **`Show HN:`** title; technical angle; stay in comments to answer setup questions. |
| **Blog (Dev.to / your site)** | “Why we built this” + architecture — good for sharing and SEO. |
| **Communities you already use** | One message in the right channel; no mass DMs. |

## Message shape that tends to work

1. **Problem** — e.g. “I wanted a terminal coding agent with explicit confirms and a sandboxed engine.”
2. **Approach** — brief stack (TS CLI + Rust engine, etc.).
3. **Try it** — clone / `yarn` / `yarn build` / `inari doctor` (adjust when npm install exists).

## Avoid

- Copy-pasting the same post across many subreddits or Discord servers.
- Vague “AI agent” hype with no repo, no demo, and no install path.
- Launching before **install** and **`inari doctor`** are documented for a clean machine.

## After launch

- **Issue templates** and a **`good first issue`** label for contributors.
- Thank people who file issues; ship small fixes publicly — steady updates read well.
- Prefer **release notes** when something user-visible ships, not noise for every internal refactor.

## Related

- Roadmap and backlog: [`plan/inari-code-plan.md`](./plan/inari-code-plan.md).
