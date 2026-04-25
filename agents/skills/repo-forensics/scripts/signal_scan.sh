#!/usr/bin/env bash
#
# signal_scan.sh — Mechanical signal extraction for repo-forensics
#
# Gathers observable data about a codebase without judging it.
# Output is structured for the agent to consume and rate.
#
# Usage:
#   bash signal_scan.sh [repo-path]
#   bash signal_scan.sh .                  # current directory
#   bash signal_scan.sh /path/to/repo      # specific repo
#
# Output sections:
#   MANIFEST       — Package manifest summary
#   LOC_PER_DIR    — Lines of code per top-level directory
#   DEP_COUNTS     — Dependency counts (direct vs dev)
#   TEST_RATIO     — Test files vs source files per directory
#   CONFIG_SIZE    — Config/tooling file sizes
#   GIT_RECENT     — Last 20 commit messages

set -euo pipefail

REPO_PATH="${1:-.}"

if [ ! -d "$REPO_PATH" ]; then
  echo "❌ Directory not found: $REPO_PATH"
  exit 1
fi

cd "$REPO_PATH"

# Ensure we're in a git repo (optional — git section will skip if not)
GIT_AVAILABLE=true
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  GIT_AVAILABLE=false
fi

echo "═══════════════════════════════════════"
echo "REPO FORENSICS — Signal Scan"
echo "═══════════════════════════════════════"
echo ""

# ── MANIFEST ────────────────────────────
echo "## MANIFEST"
echo ""

# Detect package manifest
MANIFEST_FILE=""
for f in package.json go.mod Cargo.toml pyproject.toml pom.xml build.gradle Gemfile composer.json mix.exs pubspec.yaml; do
  if [ -f "$f" ]; then
    MANIFEST_FILE="$f"
    break
  fi
done

if [ -n "$MANIFEST_FILE" ]; then
  echo "Manifest: $MANIFEST_FILE"

  # Extract name and description if package.json
  if [ "$MANIFEST_FILE" = "package.json" ] && command -v node &>/dev/null; then
    NAME=$(node -e "try{console.log(require('./package.json').name||'')}catch(e){}" 2>/dev/null || echo "")
    DESC=$(node -e "try{console.log(require('./package.json').description||'')}catch(e){}" 2>/dev/null || echo "")
    echo "Name: $NAME"
    echo "Description: $DESC"
  fi
else
  echo "No standard package manifest found"
fi

echo ""

# ── LOC PER DIR ─────────────────────────
echo "## LOC_PER_DIR"
echo ""

# Count LOC per top-level directory, excluding common noise
EXCLUDE_DIRS="node_modules vendor .git dist build __pycache__ .next .cache .venv venv env .tox target bin obj out coverage .terraform"

# Build find exclude args
FIND_EXCLUDE=""
for d in $EXCLUDE_DIRS; do
  FIND_EXCLUDE="$FIND_EXCLUDE -not -path './$d/*'"
done

# Collect LOC per top-level dir into temp file for reliable sorting
TEMP_LOC=$(mktemp)

SOURCE_EXTS="-name *.js -o -name *.ts -o -name *.jsx -o -name *.tsx
  -o -name *.py -o -name *.go -o -name *.rs -o -name *.rb
  -o -name *.java -o -name *.kt -o -name *.scala
  -o -name *.c -o -name *.cpp -o -name *.h -o -name *.hpp
  -o -name *.cs -o -name *.swift -o -name *.ex -o -name *.exs
  -o -name *.erl -o -name *.clj -o -name *.hs -o -name *.elm
  -o -name *.vue -o -name *.svelte -o -name *.html -o -name *.css
  -o -name *.scss -o -name *.sql -o -name *.sh -o -name *.yaml
  -o -name *.yml -o -name *.toml -o -name *.json"

for dir in $(find . -maxdepth 1 -type directory $FIND_EXCLUDE | sort); do
  dirname=$(basename "$dir")
  # Count lines in source files (common extensions)
  loc=$(find "$dir" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.rb" -o -name "*.java" -o -name "*.kt" -o -name "*.scala" -o -name "*.c" -o -name "*.cpp" -o -name "*.h" -o -name "*.hpp" -o -name "*.cs" -o -name "*.swift" -o -name "*.ex" -o -name "*.exs" -o -name "*.erl" -o -name "*.clj" -o -name "*.hs" -o -name "*.elm" -o -name "*.vue" -o -name "*.svelte" -o -name "*.html" -o -name "*.css" -o -name "*.scss" -o -name "*.sql" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" -o -name "*.json" \) -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/__pycache__/*" -not -path "*/.next/*" -not -path "*/.cache/*" -not -name "package-lock.json" -not -name "yarn.lock" -not -name "pnpm-lock.yaml" -print0 2>/dev/null | xargs -0 cat 2>/dev/null | wc -l | tr -d ' ')

  if [ -n "$loc" ] && [ "$loc" -gt 0 ] 2>/dev/null; then
    printf "%8s  %s\n" "$loc" "$dirname" >> "$TEMP_LOC"
  fi
done

# Root-level files
root_loc=$(find . -maxdepth 1 -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" \) -print0 2>/dev/null | xargs -0 cat 2>/dev/null | wc -l | tr -d ' ')

if [ -n "$root_loc" ] && [ "$root_loc" -gt 0 ] 2>/dev/null; then
  printf "%8s  %s\n" "$root_loc" "(root files)" >> "$TEMP_LOC"
fi

# Display sorted
cat "$TEMP_LOC" | sort -rn
rm -f "$TEMP_LOC"

echo ""

# ── DEP COUNTS ──────────────────────────
echo "## DEP_COUNTS"
echo ""

if [ -f "package.json" ] && command -v node &>/dev/null; then
  DIRECT=$(node -e "try{const d=require('./package.json').dependencies||{};console.log(Object.keys(d).length)}catch(e){console.log(0)}" 2>/dev/null)
  DEV=$(node -e "try{const d=require('./package.json').devDependencies||{};console.log(Object.keys(d).length)}catch(e){console.log(0)}" 2>/dev/null)
  echo "Direct dependencies: $DIRECT"
  echo "Dev dependencies: $DEV"
  echo "Total: $((DIRECT + DEV))"
elif [ -f "go.mod" ]; then
  REQUIRES=$(grep -c "^require" go.mod 2>/dev/null || echo "?")
  echo "Go requires: $REQUIRES"
elif [ -f "Cargo.toml" ]; then
  DEPS=$(grep -c "^.*=" Cargo.toml 2>/dev/null || echo "?")
  echo "Cargo dependencies (approx): $DEPS"
elif [ -f "pyproject.toml" ]; then
  DEPS=$(grep -c "^[a-zA-Z]" pyproject.toml 2>/dev/null || echo "?")
  echo "Python dependencies (approx): $DEPS"
else
  echo "Could not extract dependency counts from manifest"
fi

echo ""

# ── TEST RATIO ──────────────────────────
echo "## TEST_RATIO"
echo ""

# Count source vs test files
SOURCE_COUNT=$(find . -type f \
  \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \
     -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.rb" \
     -o -name "*.java" -o -name "*.kt" -o -name "*.vue" -o -name "*.svelte" \) \
  -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.git/*" \
  -not -path "*/dist/*" -not -path "*/build/*" \
  -not -name "*.test.*" -not -name "*.spec.*" -not -name "*_test.*" \
  -not -path "*/tests/*" -not -path "*/test/*" -not -path "*/__tests__/*" \
  2>/dev/null | wc -l | tr -d ' ')

TEST_COUNT=$(find . -type f \
  \( -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" -o -name "*_test.go" \) \
  -o -path "*/tests/*" -o -path "*/test/*" -o -path "*/__tests__/*" \
  -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.git/*" \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$SOURCE_COUNT" -gt 0 ] 2>/dev/null; then
  RATIO=$(echo "scale=2; $TEST_COUNT / $SOURCE_COUNT" | bc 2>/dev/null || echo "N/A")
  echo "Source files: $SOURCE_COUNT"
  echo "Test files: $TEST_COUNT"
  echo "Test-to-source ratio: $RATIO"
else
  echo "No source files detected"
fi

echo ""

# ── CONFIG SIZE ─────────────────────────
echo "## CONFIG_SIZE"
echo ""

CONFIG_FILES="Dockerfile docker-compose.yml docker-compose.yaml Makefile .eslintrc.js .eslintrc.json .eslintrc.yml .prettierrc .prettierrc.json tsconfig.json webpack.config.js webpack.config.ts vite.config.ts vite.config.js next.config.js next.config.ts jest.config.js jest.config.ts vitest.config.ts rollup.config.js .github/workflows/*.yml .github/workflows/*.yaml .env.example .gitlab-ci.yml Jenkinsfile"

total_config_loc=0
for pattern in $CONFIG_FILES; do
  for f in $pattern; do
    if [ -f "$f" ]; then
      loc=$(wc -l < "$f" 2>/dev/null || echo 0)
      printf "%8s  %s\n" "$loc" "$f"
      total_config_loc=$((total_config_loc + loc))
    fi
  done
done

echo ""
echo "Total config LOC: $total_config_loc"

echo ""

# ── GIT RECENT ──────────────────────────
echo "## GIT_RECENT"
echo ""

if [ "$GIT_AVAILABLE" = true ]; then
  echo "Last 20 commits:"
  git log --oneline -20 2>/dev/null || echo "Could not read git log"
  echo ""

  # Quick categorization of recent commits
  echo "Commit category hints:"
  TOTAL_COMMITS=$(git log --oneline -50 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TOTAL_COMMITS" -gt 0 ] 2>/dev/null; then
    FEATURE=$(git log --oneline -50 2>/dev/null | grep -ciE "feat|feature|add|implement|new" || echo 0)
    FIX=$(git log --oneline -50 2>/dev/null | grep -ciE "fix|bug|patch|hotfix" || echo 0)
    REFACTOR=$(git log --oneline -50 2>/dev/null | grep -ciE "refactor|clean|restructure|reorg" || echo 0)
    CHORE=$(git log --oneline -50 2>/dev/null | grep -ciE "chore|ci|build|deps|bump|update|upgrade" || echo 0)
    echo "  Feature: $FEATURE / $TOTAL_COMMITS"
    echo "  Bugfix:  $FIX / $TOTAL_COMMITS"
    echo "  Refactor: $REFACTOR / $TOTAL_COMMITS"
    echo "  Chore:   $CHORE / $TOTAL_COMMITS"
  fi
else
  echo "Not a git repository — skipping git signals"
fi

echo ""
echo "═══════════════════════════════════════"
echo "Scan complete"
echo "═══════════════════════════════════════"
