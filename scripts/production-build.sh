#!/usr/bin/env bash
# production-build.sh — Build all artifacts for production release
# Usage: ./scripts/production-build.sh [--release]
#
# This script:
#   1. Validates Node.js and Rust toolchain versions
#   2. Installs dependencies (clean if --clean flag)
#   3. Builds Rust engine (release or debug)
#   4. Builds TypeScript CLI
#   5. Optionally builds native addon
#   6. Runs full verification
#   7. Generates package tarball for inspection

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse flags
RELEASE_MODE=false
CLEAN_INSTALL=false
SKIP_NATIVE=false

for arg in "$@"; do
  case $arg in
    --release)
      RELEASE_MODE=true
      shift
      ;;
    --clean)
      CLEAN_INSTALL=true
      shift
      ;;
    --skip-native)
      SKIP_NATIVE=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--release] [--clean] [--skip-native]"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  InariCode Production Build Script                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "${RED}✗ Node.js >= 20 required (found $NODE_VERSION)${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"

# Check Rust toolchain
if ! command -v cargo &> /dev/null; then
  echo -e "${RED}✗ Rust/Cargo not found in PATH${NC}"
  exit 1
fi
RUST_VERSION=$(rustc --version)
echo -e "${GREEN}✓${NC} $RUST_VERSION"

# Check Yarn
if ! command -v yarn &> /dev/null; then
  echo -e "${RED}✗ Yarn not found in PATH${NC}"
  exit 1
fi
YARN_VERSION=$(yarn --version)
echo -e "${GREEN}✓${NC} Yarn $YARN_VERSION"
echo ""

# Navigate to repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo -e "${YELLOW}▸ Installing dependencies...${NC}"
if [ "$CLEAN_INSTALL" = true ]; then
  rm -rf node_modules packages/cli/node_modules packages/engine-native/node_modules
  yarn install --frozen-lockfile
else
  yarn install
fi
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Build engine
if [ "$RELEASE_MODE" = true ]; then
  echo -e "${YELLOW}▸ Building inaricode-engine (release)...${NC}"
  cargo build --manifest-path packages/engine/Cargo.toml --release
  ENGINE_PATH="$REPO_ROOT/packages/engine/target/release/inaricode-engine"
else
  echo -e "${YELLOW}▸ Building inaricode-engine (debug)...${NC}"
  cargo build --manifest-path packages/engine/Cargo.toml
  ENGINE_PATH="$REPO_ROOT/packages/engine/target/debug/inaricode-engine"
fi

if [ ! -f "$ENGINE_PATH" ]; then
  echo -e "${RED}✗ Engine binary not found at $ENGINE_PATH${NC}"
  exit 1
fi

ENGINE_SIZE=$(du -h "$ENGINE_PATH" | cut -f1)
echo -e "${GREEN}✓${NC} Engine binary: $ENGINE_PATH ($ENGINE_SIZE)"
echo ""

# Build TypeScript CLI
echo -e "${YELLOW}▸ Building TypeScript CLI...${NC}"
yarn build:cli
echo -e "${GREEN}✓${NC} CLI built successfully"
echo ""

# Build native addon (optional)
if [ "$SKIP_NATIVE" = false ]; then
  echo -e "${YELLOW}▸ Building @inaricode/engine-native...${NC}"
  yarn build:native || {
    echo -e "${YELLOW}⚠ Native addon build failed (non-critical for release)${NC}"
    echo -e "${YELLOW}  Users can fallback to subprocess IPC with INARI_ENGINE_IPC=subprocess${NC}"
  }
  echo ""
fi

# Run verification
echo -e "${YELLOW}▸ Running full verification (yarn verify:all)...${NC}"
export INARI_ENGINE_IPC=subprocess
if yarn verify:all; then
  echo -e "${GREEN}✓${NC} All checks passed"
else
  echo -e "${RED}✗ Verification failed${NC}"
  exit 1
fi
unset INARI_ENGINE_IPC
echo ""

# Check package contents
echo -e "${YELLOW}▸ Checking package contents...${NC}"
yarn pack:check
echo ""

# Generate tarball
echo -e "${YELLOW}▸ Generating package tarball...${NC}"
cd packages/cli
TARBALL=$(npm pack 2>&1 | tail -1)
TARBALL_SIZE=$(du -h "$TARBALL" | cut -f1)
echo -e "${GREEN}✓${NC} Tarball: $TARBALL ($TARBALL_SIZE)"
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Build Complete!                                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Release artifacts:"
echo "  • Engine: $ENGINE_PATH"
echo "  • CLI:    $REPO_ROOT/packages/cli/dist/"
echo "  • Tarball: $REPO_ROOT/packages/cli/$TARBALL"
echo ""

if [ "$RELEASE_MODE" = true ]; then
  echo -e "${YELLOW}Next steps for release:${NC}"
  echo "  1. Test the tarball: npm install -g $TARBALL"
  echo "  2. Run: inari doctor"
  echo "  3. Run: inari chat --help"
  echo "  4. If everything works: npm publish --access public"
  echo ""
fi

echo -e "${GREEN}Build completed successfully!${NC}"
