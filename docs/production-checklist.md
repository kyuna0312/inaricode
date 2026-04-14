# Production Deployment Checklist

This guide ensures InariCode is ready for production release.

## Pre-Release Checks

### 1. Environment Setup

- [ ] Node.js >= 20 installed
- [ ] Yarn Classic v1.22.22 installed
- [ ] Rust stable toolchain installed
- [ ] Git working tree is clean

### 2. Code Quality

- [ ] All TypeScript strict mode checks pass
- [ ] ESLint passes with zero warnings
- [ ] Rust clippy passes with `-D warnings`
- [ ] All tests pass (Vitest + Cargo test)

```bash
yarn verify:all
```

### 3. Build Verification

- [ ] Production build script runs successfully

```bash
./scripts/production-build.sh --release
```

- [ ] Package tarball contents verified

```bash
cd packages/cli && npm pack --dry-run
```

- [ ] Engine binary size is reasonable (< 20MB for release build)

### 4. Feature Testing

- [ ] `inari doctor` passes all checks
- [ ] `inari chat` works with at least one provider
- [ ] `inari pick` works in a test directory
- [ ] `inari completion` outputs valid shell scripts
- [ ] `inari cursor` works with `CURSOR_API_KEY`
- [ ] `inari mcp` starts without errors

### 5. Performance Checks

- [ ] Agent loop completes within expected time (test with simple query)
- [ ] Retry logic works (test with invalid API key to see retry attempts)
- [ ] Context compaction triggers in long sessions (test with 50+ turns)
- [ ] Parallel tool execution works (test with multiple file reads)

### 6. Documentation

- [ ] README.md is up to date
- [ ] CHANGELOG.md has entry for this version
- [ ] docs/publishing.md is current
- [ ] AGENTS.md reflects current conventions

## Release Process

### Step 1: Bump Version

```bash
# Choose bump type: major, minor, or patch
./scripts/release.sh patch "FlowerName"
```

This will:
- Validate working tree
- Bump version in `packages/cli/package.json`
- Update CHANGELOG.md
- Commit changes
- Create and push git tag

### Step 2: CI Pipeline

After pushing the tag, CI will automatically:

1. Run full verification (`yarn verify:all`)
2. Verify git tag matches package version
3. Build engine and CLI
4. Publish to npm (if `NPM_TOKEN` is configured)

Monitor the pipeline: https://github.com/kyuna0312/inaricode/actions

### Step 3: Manual Publish (if needed)

If CI doesn't auto-publish:

```bash
# Ensure you're logged in to npm
npm whoami

# Publish
cd packages/cli
npm publish --access public --provenance
```

### Step 4: Post-Release Verification

```bash
# Install from npm
npm install -g @inaricode/cli

# Verify installation
inari --version
inari doctor
inari chat --help
```

### Step 5: Announce Release

- Update GitHub Releases page with changelog
- Tag any relevant issues/PRs that this release addresses
- Update documentation if needed

## Troubleshooting

### Build Fails

1. Check Node.js version: `node -v`
2. Check Rust version: `rustc --version`
3. Clean and reinstall dependencies:

```bash
rm -rf node_modules packages/cli/node_modules packages/engine-native/node_modules
yarn install
```

4. Retry build: `yarn build`

### Publish Fails

1. Verify npm login: `npm whoami`
2. Check package version hasn't been published already
3. Verify `NPM_TOKEN` secret is set in repo settings
4. Check tarball contents: `npm pack --dry-run`

### CI Fails

1. Review workflow logs in GitHub Actions
2. Ensure all pre-release checks pass locally
3. Check that git tag matches package version
4. Verify `NPM_TOKEN` is configured correctly

## Rollback Procedure

If a release has critical issues:

1. Deprecate the version on npm:

```bash
npm deprecate @inaricode/cli@0.1.0 "Critical bug, use v0.1.1 instead"
```

2. Create a patch release with fixes
3. Update CHANGELOG.md with deprecation notice

## Security Checklist

- [ ] No secrets committed to repo
- [ ] `.npmrc` not committed
- [ ] `NPM_TOKEN` is rotation-ready
- [ ] Dependencies have no known CVEs
- [ ] Native addons are from trusted sources
- [ ] Engine binary is stripped of debug symbols

## Performance Benchmarks (Reference)

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| CLI startup | < 500ms | First run may be slower |
| Engine IPC call | < 50ms | Subprocess mode |
| LLM API call | 500-3000ms | Depends on provider |
| Tool execution (read_file) | < 10ms | Small files |
| Fuzzy pick (10k files) | < 2s | With optimizations |
| Agent loop (single tool) | 1-5s | LLM latency dependent |
| Agent loop (parallel tools) | 1-5s | 2-3x faster with parallel execution |

---

**Last updated:** 2026-04-15
**Version:** v0.1.0
