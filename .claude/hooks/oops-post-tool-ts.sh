#!/usr/bin/env bash
# Wrapper for OOPS PostToolUse hook (TypeScript)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec npx tsx "$SCRIPT_DIR/src/hooks/post-tool-use.ts"
