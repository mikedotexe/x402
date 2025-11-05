#!/bin/bash
#
# CREATE ARCHIVE - x402 Codebase
# ===============================
#
# Creates a clean archive of the entire codebase, excluding temporary files,
# caches, and other items that should typically be in .gitignore.
#
# Usage:
#   ./create_archive.sh [output_filename]
#
# If no filename is provided, generates: x402-YYYYMMDD-HHMMSS.tar.gz

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory (where the code lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CREATING X402 ARCHIVE${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Generate archive filename if not provided
if [ -z "$1" ]; then
    TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
    ARCHIVE_NAME="x402-${TIMESTAMP}.tar.gz"
else
    ARCHIVE_NAME="$1"
fi

# Ensure .tar.gz extension
if [[ ! "$ARCHIVE_NAME" =~ \.tar\.gz$ ]]; then
    ARCHIVE_NAME="${ARCHIVE_NAME}.tar.gz"
fi

echo -e "${YELLOW}Archive name:${NC} ${ARCHIVE_NAME}"
echo ""

# Create archives directory if it doesn't exist
mkdir -p archives

# Files and directories to EXCLUDE (typical .gitignore patterns)
EXCLUDE_PATTERNS=(
    # Node.js / JavaScript / TypeScript
    "node_modules"
    "dist"
    "build"
    ".next"
    ".turbo"
    "out"
    "coverage"
    ".pnp"
    ".pnp.*"
    "*.tsbuildinfo"
    "npm-debug.log*"
    "yarn-debug.log*"
    "yarn-error.log*"
    "pnpm-debug.log*"
    "lerna-debug.log*"

    # Java / Maven
    "target"
    "pom.xml.tag"
    "pom.xml.releaseBackup"
    "pom.xml.versionsBackup"
    "dependency-reduced-pom.xml"
    ".mvn"
    "*.class"
    "*.jar"
    "*.war"
    "*.ear"

    # Python
    "__pycache__"
    "*.pyc"
    "*.pyo"
    "*.pyd"
    ".Python"
    "venv"
    "env"
    ".venv"

    # Environment and secrets
    ".env"
    ".env.local"
    ".env.*.local"
    "*.pem"

    # IDE
    ".vscode"
    ".idea"
    "*.iml"
    "*.ipr"
    "*.iws"
    ".classpath"
    ".project"
    ".settings"
    "*.swp"
    "*.swo"
    "*~"

    # OS files
    ".DS_Store"
    "Thumbs.db"
    "desktop.ini"

    # Git
    ".git"

    # Claude Code
    ".claude"

    # Archives (don't archive archives!)
    "archives"
    "*.tar.gz"
    "*.zip"

    # Temporary files
    "*.tmp"
    "*.log"
    ".cache"
    "tmp"
    "temp"
    "*.patch"

    # x402 specific
    "proxy"
)

# Build tar exclude arguments
EXCLUDE_ARGS=()
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS+=(--exclude="$pattern")
done

echo -e "${YELLOW}Excluding patterns:${NC}"
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    echo "  - $pattern"
done
echo ""

# Count files before archiving
echo -e "${YELLOW}Analyzing files...${NC}"
TOTAL_FILES=$(find . -type f | wc -l | tr -d ' ')
echo -e "  Total files in directory: ${GREEN}${TOTAL_FILES}${NC}"

# Create the archive
echo ""
echo -e "${YELLOW}Creating archive...${NC}"

tar "${EXCLUDE_ARGS[@]}" \
    -czf "archives/${ARCHIVE_NAME}" \
    --exclude="archives/${ARCHIVE_NAME}" \
    . 2>&1 | grep -v "Removing leading" || true

# Check if archive was created successfully
if [ -f "archives/${ARCHIVE_NAME}" ]; then
    ARCHIVE_SIZE=$(du -h "archives/${ARCHIVE_NAME}" | cut -f1)
    ARCHIVED_FILES=$(tar -tzf "archives/${ARCHIVE_NAME}" | wc -l | tr -d ' ')

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ ARCHIVE CREATED SUCCESSFULLY${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Archive details:${NC}"
    echo -e "  Location: ${BLUE}archives/${ARCHIVE_NAME}${NC}"
    echo -e "  Size: ${GREEN}${ARCHIVE_SIZE}${NC}"
    echo -e "  Files archived: ${GREEN}${ARCHIVED_FILES}${NC}"
    echo -e "  Files excluded: ${YELLOW}$((TOTAL_FILES - ARCHIVED_FILES))${NC}"
    echo ""

    # Show what's included (summary)
    echo -e "${YELLOW}Contents summary:${NC}"
    echo ""

    # Count TypeScript files
    TS_COUNT=$(tar -tzf "archives/${ARCHIVE_NAME}" | grep -c "\.ts$" || echo "0")
    echo -e "  TypeScript files (.ts): ${GREEN}${TS_COUNT}${NC}"

    # Count TSX files
    TSX_COUNT=$(tar -tzf "archives/${ARCHIVE_NAME}" | grep -c "\.tsx$" || echo "0")
    echo -e "  React TypeScript (.tsx): ${GREEN}${TSX_COUNT}${NC}"

    # Count JavaScript files
    JS_COUNT=$(tar -tzf "archives/${ARCHIVE_NAME}" | grep -c "\.js$\|\.mjs$\|\.cjs$" || echo "0")
    echo -e "  JavaScript files (.js/.mjs/.cjs): ${GREEN}${JS_COUNT}${NC}"

    # Count Java files
    JAVA_COUNT=$(tar -tzf "archives/${ARCHIVE_NAME}" | grep -c "\.java$" || echo "0")
    echo -e "  Java files (.java): ${GREEN}${JAVA_COUNT}${NC}"

    # Count HTML files
    HTML_COUNT=$(tar -tzf "archives/${ARCHIVE_NAME}" | grep -c "\.html$" || echo "0")
    echo -e "  HTML files (.html): ${GREEN}${HTML_COUNT}${NC}"

    # Count Markdown files
    MD_COUNT=$(tar -tzf "archives/${ARCHIVE_NAME}" | grep -c "\.md$" || echo "0")
    echo -e "  Documentation (.md): ${GREEN}${MD_COUNT}${NC}"

    # Count JSON files
    JSON_COUNT=$(tar -tzf "archives/${ARCHIVE_NAME}" | grep -c "\.json$" || echo "0")
    echo -e "  Config/Data files (.json): ${GREEN}${JSON_COUNT}${NC}"

    echo ""

    # Show top-level structure
    echo -e "${YELLOW}Top-level structure:${NC}"
    tar -tzf "archives/${ARCHIVE_NAME}" | grep -E "^\./[^/]+$" | sed 's|^\./||' | sort | head -20

    echo ""
    echo -e "${YELLOW}Major directories:${NC}"
    tar -tzf "archives/${ARCHIVE_NAME}" | grep -E "^\./[^/]+/" | sed 's|^\./||' | cut -d'/' -f1 | sort -u

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Archive ready for distribution!${NC}"
    echo -e "${GREEN}========================================${NC}"

else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ ARCHIVE CREATION FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi

# Optional: Create a manifest file
MANIFEST_FILE="archives/${ARCHIVE_NAME%.tar.gz}_manifest.txt"
echo -e ""
echo -e "${YELLOW}Creating manifest file...${NC}"
tar -tzf "archives/${ARCHIVE_NAME}" | sort > "$MANIFEST_FILE"
echo -e "  Manifest: ${BLUE}${MANIFEST_FILE}${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}COMPLETE${NC}"
echo -e "${BLUE}========================================${NC}"
