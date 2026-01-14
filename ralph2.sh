#!/bin/bash
set -e

# Trap signals to show why script exited
trap 'echo -e "\n${RED}Script interrupted by signal${NC}"; exit 130' INT
trap 'echo -e "\n${RED}Script terminated${NC}"; exit 143' TERM

# ralph2.sh - Automated bug fix implementation runner for ML Dashboard
# Usage: ./ralph2.sh <iterations>
# Runs Claude CLI to fix bugs from plans/prd2.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="ml-dashboard-bugfixes"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
ITERATIONS="${1:-10}"

print_usage() {
  echo "Usage: $0 <iterations>"
  echo ""
  echo "Arguments:"
  echo "  <iterations>   Number of bugs to fix (default: 10)"
  echo ""
  echo "Examples:"
  echo "  $0 50    # Fix up to 50 bugs"
  echo "  $0       # Fix up to 10 bugs (default)"
  echo ""
  echo "Working directory: $SCRIPT_DIR"
}

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  print_usage
  exit 0
fi

# Ensure we're in the right directory
cd "$SCRIPT_DIR"

# Verify PRD2 exists
if [ ! -f "plans/prd2.json" ]; then
  echo -e "${RED}Error: Cannot find plans/prd2.json${NC}"
  exit 1
fi

# Ensure progress2.txt exists
if [ ! -f "progress2.txt" ]; then
  echo "# Bug Fix Progress Log" > "progress2.txt"
  echo "Created: $(date)" >> "progress2.txt"
  echo "" >> "progress2.txt"
fi

# Show current status
CURRENT_BRANCH=$(git branch --show-current)
echo ""
echo -e "${YELLOW}=== ML Dashboard Bug Fix Runner ===${NC}"
echo "Project: $PROJECT_NAME"
echo "Branch: $CURRENT_BRANCH"
echo "Iterations: $ITERATIONS"
echo "Working directory: $SCRIPT_DIR"
echo ""

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${YELLOW}Warning: Uncommitted changes detected${NC}"
  git status --short
  echo ""
fi

for ((i=1; i<=$ITERATIONS; i++)); do
  echo ""
  echo "========================================"
  echo "Iteration $i of $ITERATIONS"
  echo "========================================"
  echo ""

  # Run claude command with error handling
  echo -e "${GREEN}Starting Claude CLI...${NC}"
  set +e
  result=$(claude --permission-mode acceptEdits -p "You are fixing bugs in the ML Dashboard project.

CONTEXT:
- Working directory: $SCRIPT_DIR
- Bug PRD file: plans/prd2.json
- Progress file: progress2.txt
- Backend: backend/ directory (Python/FastAPI)
- Frontend: src/ directory (React/Next.js)
- Profiling: backend/profiling/ directory

INSTRUCTIONS:
1. Read plans/prd2.json to find the highest-priority bug with passes: false
   Priority order: critical first, then high, then medium, then low

2. For the selected bug, follow its debug_steps:
   a. REVIEW: Read the specified files and understand the issue
   b. TEST: Verify the bug exists (check logs, run relevant code)
   c. FIX: Implement the fix as described
   d. VERIFY: Confirm the fix works

3. Implement ONLY that single bug fix following its steps
   - Backend code goes in backend/profiling/ or backend/main.py
   - Frontend code goes in src/components/profiling/ or src/lib/
   - Types go in src/types/index.ts

4. Test your implementation:
   - For backend: ensure no Python syntax errors (python -m py_compile file.py)
   - For frontend: run 'npm run build' to verify TypeScript compiles

5. Update the PRD (plans/prd2.json):
   - Read the file first
   - Edit ONLY the 'passes' field from false to true for the completed bug
   - Verify the edit worked

6. Update progress2.txt:
   - Read the file first
   - APPEND a new entry with: date, bug ID, status, description of fix

7. Commit your changes with format: 'fix(profiling): <description>'

IMPORTANT:
- Work on ONE bug per iteration
- Follow the debug_steps exactly - REVIEW -> TEST -> FIX -> VERIFY
- If all bugs have passes: true, output <promise>COMPLETE</promise>
")
  CLAUDE_EXIT_CODE=$?
  set -e

  # Handle claude command failure
  if [ $CLAUDE_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}Claude command failed with exit code: $CLAUDE_EXIT_CODE${NC}"
    echo -e "${YELLOW}Continuing to next iteration...${NC}"
    continue
  fi

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "========================================"
    echo -e "${GREEN}All bugs fixed after $i iterations!${NC}"
    echo "========================================"
    exit 0
  fi
done

echo ""
echo "========================================"
echo "Completed $ITERATIONS iterations"
echo "========================================"
