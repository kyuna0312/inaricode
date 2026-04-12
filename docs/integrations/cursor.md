# Cursor IDE + InariCode

Use **Cursor** as your editor and **InariCode** in the terminal. The **`.cursor/`** directory is **not committed** to this repo (see `.gitignore`); keep rules and local Cursor state private to your machine.

## LLM switching vs Cursor

**REPL chat** (`inari chat`) uses **Anthropic**, **OpenAI**, **Kimi**, **Ollama**, etc. — see **`inari providers list`**. Switch with **`inaricode.yaml`** / **`inaricode.config.cjs`**, env **`INARI_PROVIDER`** / **`INARI_MODEL`**, or **`inari chat --provider … --model …`**.

**Cursor Cloud Agents** are separate: **`inari cursor …`** with **`CURSOR_API_KEY`** (GitHub repo tasks), not a `provider:` value for `chat`.

## Cursor Cloud API from the CLI

With **`CURSOR_API_KEY`** set (from [Cursor Dashboard → Cloud Agents](https://cursor.com/dashboard/cloud-agents)), you can call Cursor’s HTTP API from the repo root:

```bash
export CURSOR_API_KEY='key_…'   # never commit this
yarn cli cursor me
yarn cli cursor agents
yarn cli cursor models
yarn cli cursor status bc_abc123
yarn cli cursor conversation bc_abc123
yarn cli cursor launch --repository 'https://github.com/org/repo' --prompt 'Describe the task'
yarn cli cursor followup bc_abc123 --prompt 'Also fix tests'
yarn cli cursor stop bc_abc123
yarn cli cursor delete bc_abc123
```

- **Docs:** [Cursor API overview](https://cursor.com/docs/api), [Cloud Agents endpoints](https://cursor.com/docs/cloud-agent/api/endpoints).
- **Optional:** `CURSOR_API_BASE_URL` overrides the default `https://api.cursor.com`.
- **`cursor repos`** lists GitHub repos for the key but is **heavily rate-limited**; the CLI prints a warning.

Admin / Analytics APIs need different keys and Enterprise access; this CLI surface targets **Cloud Agents** (`/v0/…`) first.

## Project rules (local only)

To use Cursor **project rules**, create files under **`.cursor/rules/`** yourself (they stay out of git). Copy or adapt the examples in **[`cursor-rules.example.md`](cursor-rules.example.md)** into `.mdc` or rule files on your disk.

## Editor + terminal workflow

1. **Cursor** — Composer, inline edits, refactors.
2. **`yarn cli chat`** — local agent with Rust engine tools and confirmations.
3. **`yarn cli cursor …`** — remote **cloud agents** on GitHub repos via Cursor’s API.

## MCP

In-editor **MCP** is configured in Cursor settings. A future **MCP server** inside InariCode is still on the [product plan](../plan/inari-code-plan.md).

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| `CURSOR_API_KEY is not set` | Export the key from Cloud Agents settings; do not commit it. |
| `401` / `403` | Key type must match the API (Cloud Agents key for `/v0/*`). |
| Rules missing on clone | Expected: rules are local. Use **`cursor-rules.example.md`**. |
