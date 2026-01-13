#!/bin/bash
set -e

# Trap signals to show why script exited
trap 'echo -e "\n${RED}Script interrupted by signal${NC}"; exit 130' INT
trap 'echo -e "\n${RED}Script terminated${NC}"; exit 143' TERM

# ralph.sh - Automated PRD feature implementation runner (Worktree Version)
# Usage: ./ralph.sh -b <branch> <iterations>
# Runs Claude CLI to implement features from plans/prd.json
#
# This script runs from tech-project/<automation-folder>/
# and works on an ISOLATED WORKTREE in web-erp-app/.worktrees/<automation-name>
#
# IMPORTANT: Each automation gets its own worktree - no conflicts!

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOMATION_NAME="$(basename "$SCRIPT_DIR")"
TECH_PROJECT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_ERP="$TECH_PROJECT/web-erp-app"
WORKTREE_DIR="$WEB_ERP/.worktrees/$AUTOMATION_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Monitoring server configuration
SERVER_URL="http://localhost:3333"
SERVER_ENABLED=false
INSTANCE_ID=""

# Parse arguments
BRANCH=""
ITERATIONS=""

print_usage() {
  echo "Usage: $0 -b <branch> <iterations>"
  echo ""
  echo "Arguments:"
  echo "  -b <branch>    Target git branch (required)"
  echo "                 Use 'develop' for integration, or 'feature/xyz' for feature work"
  echo "  <iterations>   Number of features to process"
  echo ""
  echo "Examples:"
  echo "  $0 -b develop 10                    # Work on develop branch, 10 iterations"
  echo "  $0 -b feature/finance-ui 22         # Work on feature branch, 22 iterations"
  echo ""
  echo "This script uses git worktrees for isolation."
  echo "Worktree location: $WORKTREE_DIR"
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      if [ -z "$ITERATIONS" ]; then
        ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Verify we're in the right place
if [ ! -f "$WEB_ERP/package.json" ]; then
  echo -e "${RED}Error: Cannot find web-erp-app/package.json${NC}"
  echo "Expected at: $WEB_ERP"
  exit 1
fi

# Validate required arguments
if [ -z "$BRANCH" ]; then
  echo -e "${RED}Error: Branch is required${NC}"
  echo ""
  print_usage
  exit 1
fi

if [ -z "$ITERATIONS" ]; then
  echo -e "${RED}Error: Iterations count is required${NC}"
  echo ""
  print_usage
  exit 1
fi

# Ensure progress.txt exists
if [ ! -f "$SCRIPT_DIR/progress.txt" ]; then
  echo "# Progress Log" > "$SCRIPT_DIR/progress.txt"
  echo "Created: $(date)" >> "$SCRIPT_DIR/progress.txt"
  echo "" >> "$SCRIPT_DIR/progress.txt"
fi

# === MONITORING SERVER INTEGRATION ===
echo ""
echo -e "${YELLOW}=== Monitoring Server Check ===${NC}"
if curl -s -f "$SERVER_URL/api/instances" > /dev/null 2>&1; then
  SERVER_ENABLED=true
  echo -e "${GREEN}Monitoring server detected at $SERVER_URL${NC}"
else
  echo -e "${YELLOW}Monitoring server not running (optional)${NC}"
  echo "To enable tracking, start the server: cd ralph-monitoring-server && npm run dev"
fi
echo ""

# === WORKTREE MANAGEMENT ===
cd "$WEB_ERP"

echo ""
echo -e "${YELLOW}=== Worktree Management ===${NC}"
echo "Automation: $AUTOMATION_NAME"
echo "Target branch: $BRANCH"
echo "Worktree path: $WORKTREE_DIR"

# Ensure .worktrees directory exists
mkdir -p "$WEB_ERP/.worktrees"

# Check if worktree already exists
if [ -d "$WORKTREE_DIR" ]; then
  echo -e "${GREEN}Worktree already exists${NC}"

  # Check if it's on the right branch
  WORKTREE_BRANCH=$(cd "$WORKTREE_DIR" && git branch --show-current)
  if [ "$WORKTREE_BRANCH" != "$BRANCH" ]; then
    echo -e "${YELLOW}Worktree is on branch '$WORKTREE_BRANCH', switching to '$BRANCH'${NC}"
    cd "$WORKTREE_DIR"

    # Check for uncommitted changes in worktree
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo -e "${RED}Error: Worktree has uncommitted changes${NC}"
      git status --short
      exit 1
    fi

    # Switch branch in worktree
    if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
      git checkout "$BRANCH"
    elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
      git checkout -b "$BRANCH" "origin/$BRANCH"
    else
      git checkout -b "$BRANCH"
      echo -e "${GREEN}Created new branch: $BRANCH${NC}"
    fi
  fi
else
  echo "Creating new worktree..."

  # Check if branch exists
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    # Branch exists locally - but might be checked out elsewhere
    EXISTING_WORKTREE=$(git worktree list | grep "\[$BRANCH\]" | awk '{print $1}' || true)
    if [ -n "$EXISTING_WORKTREE" ] && [ "$EXISTING_WORKTREE" != "$WORKTREE_DIR" ]; then
      echo -e "${RED}Error: Branch '$BRANCH' is already checked out at: $EXISTING_WORKTREE${NC}"
      echo "Either use a different branch or remove that worktree first."
      exit 1
    fi
    git worktree add "$WORKTREE_DIR" "$BRANCH"
  elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    # Branch exists on remote
    git worktree add "$WORKTREE_DIR" -b "$BRANCH" "origin/$BRANCH"
  else
    # Create new branch from develop
    echo -e "${YELLOW}Branch '$BRANCH' does not exist. Creating from develop...${NC}"
    git worktree add "$WORKTREE_DIR" -b "$BRANCH" develop
  fi

  echo -e "${GREEN}Created worktree at: $WORKTREE_DIR${NC}"
fi

# Verify worktree is ready
cd "$WORKTREE_DIR"
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${GREEN}Worktree ready on branch: $CURRENT_BRANCH${NC}"

# Check for uncommitted changes in worktree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${RED}Error: Worktree has uncommitted changes${NC}"
  git status --short
  exit 1
fi

echo ""

# Register with monitoring server
if [ "$SERVER_ENABLED" = true ]; then
  PID=$$

  echo -e "${YELLOW}=== Registering with Monitoring Server ===${NC}"
  REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"worktreePath\": \"$WORKTREE_DIR\",
      \"branch\": \"$CURRENT_BRANCH\",
      \"pid\": $PID,
      \"iterations\": $ITERATIONS
    }")

  INSTANCE_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$INSTANCE_ID" ]; then
    echo -e "${GREEN}Registered as instance: $INSTANCE_ID${NC}"

    # Set up cleanup trap to unregister on exit
    trap "curl -s -X DELETE '$SERVER_URL/api/unregister/$INSTANCE_ID' > /dev/null 2>&1; echo -e '${YELLOW}Unregistered from monitoring server${NC}'" EXIT
  else
    echo -e "${RED}Failed to register with monitoring server${NC}"
    SERVER_ENABLED=false
  fi
  echo ""
fi

# Change to tech-project so Claude has access to automation folder
cd "$TECH_PROJECT"

# Calculate relative path from tech-project to worktree
WORKTREE_REL="web-erp-app/.worktrees/$AUTOMATION_NAME"

echo "Working directory: $(pwd)"
echo "Worktree: $WORKTREE_REL"
echo "Branch: $CURRENT_BRANCH"
echo ""

for ((i=1; i<=$ITERATIONS; i++)); do
  echo ""
  echo "========================================"
  echo "Iteration $i of $ITERATIONS"
  echo "========================================"

  # Send heartbeat to monitoring server
  if [ "$SERVER_ENABLED" = true ] && [ -n "$INSTANCE_ID" ]; then
    curl -s -X POST "$SERVER_URL/api/heartbeat/$INSTANCE_ID" \
      -H "Content-Type: application/json" \
      -d "{\"currentIteration\": $i, \"status\": \"running\"}" > /dev/null 2>&1 || true
  fi
  echo "DEBUG: Past heartbeat, about to run claude"

  # Run claude command with error handling (set -e would exit on non-zero)
  echo -e "${GREEN}Starting Claude CLI...${NC}"
  echo "Command: claude --permission-mode acceptEdits -p \"@$AUTOMATION_NAME/plans/prd.json ...\""
  set +e
  result=$(claude --permission-mode acceptEdits -p "@$AUTOMATION_NAME/plans/prd.json @$AUTOMATION_NAME/progress.txt \
You are working on the web-erp-app codebase in a WORKTREE. All code changes should be in the $WORKTREE_REL/ directory. \
1. Find the highest-priority feature to work on (passes: false) and work only on that feature. \
Priority order: CRITICAL bugs first, then HIGH priority, then MEDIUM, then LOW. \
IMPORTANT: FINAL priority features should ONLY be worked on when ALL other features have passes: true. \
2. Implement the fix/feature following the steps provided. Files are in $WORKTREE_REL/frontend/. \
3. Verify by running 'cd $WORKTREE_REL/frontend && npm run build' - must pass without errors. \
3b. MUST USE Chrome DevTools MCP server (chrome-devtools) to test UI changes visually before marking complete. \
4. Update the PRD ($AUTOMATION_NAME/plans/prd.json): \
   - FIRST use the Read tool to read the PRD file (required before editing). \
   - Then use the Edit tool to change ONLY the 'passes' field from false to true for the completed feature. \
   - After editing, use the Read tool again to VERIFY the edit was successful. \
   - If the edit failed, retry the edit. The PRD MUST be updated before proceeding. \
   - DO NOT modify any other fields. DO NOT rewrite the entire file. \
5. Append to progress.txt ($AUTOMATION_NAME/progress.txt): \
   - FIRST use the Read tool to read the progress file (required before editing). \
   - Use the Edit tool to APPEND new content to the end of the file. \
   - DO NOT rewrite or modify existing progress entries. \
   - Format: date, feature ID, status, and description of what was done. \
6. Make a git commit in $WORKTREE_REL with format: 'fix(module): <description>' or 'feat(module): <description>'. \
ONLY WORK ON A SINGLE FEATURE PER ITERATION. \
If all features have passes: true, output <promise>COMPLETE</promise>. \
")
  CLAUDE_EXIT_CODE=$?
  set -e

  # Handle claude command failure
  if [ $CLAUDE_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}Claude command failed with exit code: $CLAUDE_EXIT_CODE${NC}"
    echo -e "${YELLOW}Output (if any):${NC}"
    echo "$result"

    # Send error to monitoring server
    if [ "$SERVER_ENABLED" = true ] && [ -n "$INSTANCE_ID" ]; then
      curl -s -X POST "$SERVER_URL/api/log/$INSTANCE_ID" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"Claude failed with exit code $CLAUDE_EXIT_CODE\", \"type\": \"error\"}" > /dev/null 2>&1 || true
    fi

    echo -e "${YELLOW}Continuing to next iteration...${NC}"
    continue
  fi

  echo "$result"

  # Send log to monitoring server
  if [ "$SERVER_ENABLED" = true ] && [ -n "$INSTANCE_ID" ]; then
    # Send a summary log entry (full output can be too large)
    LOG_SUMMARY=$(echo "$result" | tail -50 | head -20)
    curl -s -X POST "$SERVER_URL/api/log/$INSTANCE_ID" \
      -H "Content-Type: application/json" \
      -d "{\"message\": $(echo "$LOG_SUMMARY" | jq -Rs .), \"type\": \"stdout\"}" > /dev/null 2>&1 || true
  fi

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "========================================"
    echo "PRD complete after $i iterations!"
    echo "========================================"
    command -v tt >/dev/null 2>&1 && tt notify "PRD complete after $i iterations"
    exit 0
  fi
done

echo ""
echo "========================================"
echo "Completed $ITERATIONS iterations"
echo "========================================"
