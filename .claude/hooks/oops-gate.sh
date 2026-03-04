#!/bin/bash
# OOPS Framework - PreToolUse Gate Hook
# Enforces TDD phases by controlling file access

set -euo pipefail

# Configuration
STATE_FILE=".oops/state.json"
LOCK_FILE=".oops/state.lock"
LOCK_TIMEOUT=3

# Error handling - fail-safe to deny
trap 'handle_error $? $LINENO' ERR

handle_error() {
  local exit_code=$1
  local line_num=$2
  echo "Hook error at line $line_num (exit code: $exit_code). Defaulting to DENY for safety." >&2
  jq -n --arg line "$line_num" --arg code "$exit_code" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("Hook script error at line " + $line + " (code " + $code + "). Operation blocked for safety.")
    }
  }'
  exit 0
}

# Check jq existence
if ! command -v jq &> /dev/null; then
  echo "Error: jq is not installed" >&2
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "jq is not installed. Cannot verify OOPS state."
    }
  }'
  exit 0
fi

# Lock management
acquire_lock() {
  local waited=0
  while [ -f "$LOCK_FILE" ] && [ $waited -lt $((LOCK_TIMEOUT * 10)) ]; do
    sleep 0.1
    waited=$((waited + 1))
  done

  if [ -f "$LOCK_FILE" ]; then
    local lock_age=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)))
    if [ $lock_age -gt 5 ]; then
      # Stale lock - remove it
      rm -f "$LOCK_FILE"
      echo "Removed stale lock (${lock_age}s old)" >&2
    else
      # Active lock - deny for safety
      jq -n --arg age "$lock_age" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: ("Concurrent operation detected. Lock active for " + $age + "s. Try again.")
        }
      }'
      exit 0
    fi
  fi
  echo "$$:$(date +%s)" > "$LOCK_FILE"
}

release_lock() {
  rm -f "$LOCK_FILE"
}

# Increment oops counter
increment_oops() {
  local reason="$1"
  local file="$2"

  acquire_lock

  local current_count=$(jq -r '.oopsCount // 0' "$STATE_FILE")
  local new_count=$((current_count + 1))
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Atomic update
  local temp_file=$(mktemp)
  jq --arg ts "$timestamp" --argjson count "$new_count" \
    '.oopsCount = $count | .lastOops = $ts | .metadata.lastUpdate = $ts' \
    "$STATE_FILE" > "$temp_file"
  mv "$temp_file" "$STATE_FILE"

  release_lock

  echo "🚫 Oops #${new_count}: ${reason}" >&2
  echo "   File: ${file}" >&2
}

# Read tool use request from stdin (Claude Code passes JSON via stdin)
INPUT=$(cat)

# Parse tool use request from stdin JSON
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only intercept file write operations
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "NotebookEdit" ]]; then
  # Not a file write operation - allow
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow"
    }
  }'
  exit 0
fi

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
  # No state file - allow (OOPS not initialized)
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "OOPS not initialized"
    }
  }'
  exit 0
fi

# Read current phase
CURRENT_PHASE=$(jq -r '.phase // "NONE"' "$STATE_FILE")

# NONE phase - allow everything
if [ "$CURRENT_PHASE" = "NONE" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Phase: NONE (unrestricted)"
    }
  }'
  exit 0
fi

# Normalize file path (remove leading ./)
FILE_PATH_NORMALIZED="${FILE_PATH#./}"

# Detect file type
IS_TEST_FILE=false
if [[ "$FILE_PATH_NORMALIZED" =~ \.test\.|\.spec\.|/test/|/tests/|/spec/|/__tests__/ ]]; then
  IS_TEST_FILE=true
fi

# Phase-specific rules
case "$CURRENT_PHASE" in
  RED)
    # RED phase: Only test files allowed
    if [ "$IS_TEST_FILE" = true ]; then
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: ("Phase: RED - Test file allowed: " + $file)
        }
      }'
      exit 0
    else
      increment_oops "Attempted to modify implementation during RED phase" "$FILE_PATH"
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: ("🚫 Phase: RED - Only test files allowed. Cannot modify: " + $file)
        }
      }'
      exit 0
    fi
    ;;

  GREEN)
    # GREEN phase: Only implementation files allowed
    if [ "$IS_TEST_FILE" = false ]; then
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: ("Phase: GREEN - Implementation file allowed: " + $file)
        }
      }'
      exit 0
    else
      increment_oops "Attempted to modify tests during GREEN phase" "$FILE_PATH"
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: ("🚫 Phase: GREEN - Only implementation files allowed. Cannot modify: " + $file)
        }
      }'
      exit 0
    fi
    ;;

  REFACTOR)
    # REFACTOR phase: Both allowed, but test modifications trigger warning
    if [ "$IS_TEST_FILE" = true ]; then
      # Warning but allow (may need to add test cases during refactoring)
      echo "⚠️  Phase: REFACTOR - Modifying test file: $FILE_PATH" >&2
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: ("Phase: REFACTOR - Test modification allowed (with warning): " + $file)
        }
      }'
      exit 0
    else
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: ("Phase: REFACTOR - Implementation file allowed: " + $file)
        }
      }'
      exit 0
    fi
    ;;

  *)
    # Unknown phase - deny for safety
    jq -n --arg phase "$CURRENT_PHASE" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("Unknown phase: " + $phase + ". Blocking for safety.")
      }
    }'
    exit 0
    ;;
esac
