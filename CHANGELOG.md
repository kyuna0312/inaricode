# Changelog

All notable changes to InariCode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Retry executor with exponential backoff for resilient LLM API calls
- Context compaction to prevent context limit errors in long sessions
- Concurrency-limited tool execution pool for parallel tool calls
- Config cache with file-mtime based invalidation
- HTTP keep-alive for LLM providers (100-300ms faster per API call)
- Production environment validator (`validateProductionEnv()`)
- Production build script (`scripts/production-build.sh`)
- Release automation script (`scripts/release.sh`)

### Changed
- Optimized Rust engine release profile (`codegen-units = 1`, `panic = "abort"`)
- TypeScript strict ESM mode (`verbatimModuleSyntax`)
- Agent loop: parallel tool execution with concurrency limits
- Fuzzy matching: early rejection and pre-filtering (30-50% faster)
- Turbo cache: explicit inputs for precise cache invalidation

### Fixed
- LLM provider error handling with retry logic
- Memory management with context compaction
- Cache misses from unrelated file changes

---

## v0.1.0 — 2026-04-15

### Added
- Initial release of InariCode CLI
- Multi-turn chat with tool use (read/write/grep/patch/shell)
- Anthropic and OpenAI-compatible API support
- Rust engine for sandboxed filesystem and process work
- Ink-based terminal UI
- Fuzzy file picker
- MCP stdio server
- Cursor IDE integration
- Shell completions (zsh, fish, bash)
- Doctor command for environment validation
- Skills system for declarative prompts
- Media generation (Hugging Face text-to-image)
- English and Mongolian localization
