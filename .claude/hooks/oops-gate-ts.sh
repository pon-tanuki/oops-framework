#!/usr/bin/env bash
# OOPS Framework - PreToolUse Hook (TypeScript wrapper)
# Delegates to src/hooks/pre-tool-use.ts via tsx
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec npx tsx "$SCRIPT_DIR/src/hooks/pre-tool-use.ts"
