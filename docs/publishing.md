# Publishing **`@inaricode/cli`** (maintainers)

End-user install from the registry is **not** required for local development; this page is for **cutting a release**.

## Preconditions

- **`yarn verify:all`** passes (lint, CLI build/test, Rust tests, **`yarn pack:check`**).
- **`packages/cli/package.json`**: **`prepublishOnly`** runs **`tsc`** so **`dist/`** is fresh on publish.

## What gets published

- **`files`**: **`dist/`**, **`assets/`** only (no **`src/`**). Inspect anytime:

```bash
yarn pack:check
# or: cd packages/cli && npm pack --dry-run
```

## Manual publish (npmjs)

From repo root after login **`npm whoami`**:

```bash
cd packages/cli
npm publish --access public
```

*(Adjust **`--access`** if the scope is private.)* Tag the git release separately (e.g. **`v0.1.0`**) to match **`package.json` `version`**.

## Consumers

After publish:

```bash
npm install -g @inaricode/cli
# or: npx @inaricode/cli --help
```

They still need a working **engine**: **subprocess** path (install/build binary or set **`INARI_ENGINE_PATH`**) or a **prebuilt native** addon if you ship one per platform — document in the **README** when the matrix is automated.

## CI automation

The workflow **[`.github/workflows/publish.yml`](../.github/workflows/publish.yml)** publishes **`@inaricode/cli`** when you push a **git tag** that matches **`packages/cli/package.json` `version`** (e.g. tag **`v0.1.0`** for version **`0.1.0`**). You can also run it manually via **Actions → Publish npm → Run workflow**.

### Setup

1. In the GitHub repo: **Settings → Secrets and variables → Actions**, add **`NPM_TOKEN`** (npm [automation access token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with publish rights for the scope).
2. Bump **`packages/cli/package.json` `version`**, merge to **`main`**, then create and push the matching tag:
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```
3. The workflow runs **`yarn verify:all`** (same gate as a release) then **`npm publish --access public --provenance`**.

If **`NPM_TOKEN`** is missing or the version was already published, the publish step fails; fix the secret or bump the version.

Do not commit **`.npmrc`** with credentials.
