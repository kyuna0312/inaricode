#!/usr/bin/env bash
# release.sh — Bump version, update changelog, create git tag
# Usage: ./scripts/release.sh [major|minor|patch] [--codename "FlowerName"]
#
# This script:
#   1. Validates working tree is clean
#   2. Bumps version in packages/cli/package.json
#   3. Updates CHANGELOG.md
#   4. Commits changes
#   5. Creates and pushes git tag
#   6. Prints next steps

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BUMP_TYPE="${1:-patch}"
CODENAME="${2:-}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  InariCode Release Helper                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
  echo -e "${RED}✗ Invalid bump type: $BUMP_TYPE (expected: major, minor, patch)${NC}"
  exit 1
fi

# Navigate to repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# Check git working tree
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}✗ Working tree is not clean. Commit or stash changes first.${NC}"
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./packages/cli/package.json').version")
echo -e "${YELLOW}Current version: ${GREEN}$CURRENT_VERSION${NC}"

# Bump version using npm
cd packages/cli
npm version "$BUMP_TYPE" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
cd "$REPO_ROOT"

echo -e "${YELLOW}New version: ${GREEN}$NEW_VERSION${NC}"
echo ""

# Update codename if provided
if [ -n "$CODENAME" ]; then
  echo -e "${YELLOW}Updating codename to: $CODENAME${NC}"
  # Use node to update package.json
  node -e "
    const pkg = require('./packages/cli/package.json');
    pkg.inaricode = pkg.inaricode || {};
    pkg.inaricode.codename = '$CODENAME';
    require('fs').writeFileSync('./packages/cli/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
fi

# Update CHANGELOG.md
TODAY=$(date +%Y-%m-%d)
CHANGELOG_ENTRY="## v$NEW_VERSION — $TODAY\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n"

if [ -f "CHANGELOG.md" ]; then
  # Prepend new entry
  {
    echo -e "$CHANGELOG_ENTRY"
    cat CHANGELOG.md
  } > CHANGELOG.tmp
  mv CHANGELOG.tmp CHANGELOG.md
else
  # Create new changelog
  echo -e "# Changelog\n\n$CHANGELOG_ENTRY" > CHANGELOG.md
fi

echo -e "${GREEN}✓${NC} CHANGELOG.md updated"

# Commit changes
git add packages/cli/package.json CHANGELOG.md
git commit -m "release: v$NEW_VERSION"

echo -e "${GREEN}✓${NC} Committed version bump"

# Create git tag
TAG="v$NEW_VERSION"
git tag -a "$TAG" -m "Release $TAG"

echo -e "${GREEN}✓${NC} Created git tag: $TAG"

# Push to remote
echo ""
echo -e "${YELLOW}Pushing to remote...${NC}"
git push origin main
git push origin "$TAG"

echo -e "${GREEN}✓${NC} Pushed to remote"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Release v$NEW_VERSION Ready!                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Review CI pipeline: https://github.com/kyuna0312/inaricode/actions"
echo "  2. Once CI passes, publish to npm:"
echo "     cd packages/cli && npm publish --access public"
echo ""
echo "  3. Or let CI auto-publish (if NPM_TOKEN is configured)"
echo ""
echo -e "${GREEN}Release v$NEW_VERSION created successfully!${NC}"
