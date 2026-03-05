#!/bin/bash
# OOPS Framework Sanity Check
# Verifies prerequisites before Phase 0 implementation

echo "🔍 OOPS Framework Sanity Check"
echo "================================"
echo ""

ERRORS=0
WARNINGS=0

# 1. Check jq installation
echo -n "✓ Checking jq installation... "
if command -v jq &> /dev/null; then
    echo "OK ($(jq --version))"
else
    echo "❌ FAILED"
    echo "  jq is required for JSON state management"
    echo "  Install: sudo apt-get install jq"
    ERRORS=$((ERRORS + 1))
fi

# 2. Check .oops directory
echo -n "✓ Checking .oops/ directory... "
if [ -d ".oops" ]; then
    echo "OK (exists)"
else
    echo "⚠️  WARN (will be created)"
    WARNINGS=$((WARNINGS + 1))
fi

# 3. Check state.json validity (if exists)
echo -n "✓ Checking state.json validity... "
if [ -f ".oops/state.json" ]; then
    if jq empty .oops/state.json 2>/dev/null; then
        echo "OK (valid JSON)"
    else
        echo "❌ FAILED (invalid JSON)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️  WARN (will be created)"
    WARNINGS=$((WARNINGS + 1))
fi

# 4. Check hook script executability
echo -n "✓ Checking hook scripts... "
if [ -d ".claude/hooks" ]; then
    if [ -f ".claude/hooks/oops-gate.sh" ]; then
        if [ -x ".claude/hooks/oops-gate.sh" ]; then
            echo "OK (executable)"
        else
            echo "⚠️  WARN (not executable, will fix)"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo "⚠️  WARN (will be created)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  WARN (will be created)"
    WARNINGS=$((WARNINGS + 1))
fi

# 5. Check .claude/settings.json
echo -n "✓ Checking .claude/settings.json... "
if [ -f ".claude/settings.json" ]; then
    if jq empty .claude/settings.json 2>/dev/null; then
        echo "OK (valid JSON)"
    else
        echo "❌ FAILED (invalid JSON)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️  WARN (will be created)"
    WARNINGS=$((WARNINGS + 1))
fi

# 6. Check hooks registration
echo -n "✓ Checking hooks registration... "
if [ -f ".claude/settings.json" ]; then
    if jq -e '.hooks' .claude/settings.json &>/dev/null; then
        echo "OK (hooks configured)"
    else
        echo "⚠️  WARN (will be configured)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  WARN (will be configured)"
    WARNINGS=$((WARNINGS + 1))
fi

# 7. Check test runner
echo -n "✓ Checking test runner... "
if [ -f "package.json" ]; then
    if jq -e '.scripts.test' package.json &>/dev/null; then
        echo "OK (npm test available)"
    else
        echo "⚠️  WARN (no test script)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  WARN (no package.json)"
    WARNINGS=$((WARNINGS + 1))
fi

# 8. Check Git repository
echo -n "✓ Checking Git repository... "
if git rev-parse --git-dir &>/dev/null; then
    echo "OK (git repo)"
else
    echo "❌ FAILED (not a git repo)"
    echo "  OOPS requires Git for version control"
    ERRORS=$((ERRORS + 1))
fi

# 9. Check disk space
echo -n "✓ Checking disk space... "
AVAILABLE=$(df . | tail -1 | awk '{print $4}')
if [ "$AVAILABLE" -gt 102400 ]; then  # 100MB in KB
    echo "OK (${AVAILABLE}KB available)"
else
    echo "⚠️  WARN (low disk space: ${AVAILABLE}KB)"
    WARNINGS=$((WARNINGS + 1))
fi

# 10. Check for stale locks
echo -n "✓ Checking for stale locks... "
if [ -f ".oops/state.lock" ]; then
    LOCK_AGE=$(($(date +%s) - $(stat -c %Y ".oops/state.lock" 2>/dev/null || echo 0)))
    if [ "$LOCK_AGE" -gt 5 ]; then
        echo "⚠️  WARN (stale lock: ${LOCK_AGE}s old, will remove)"
        rm -f .oops/state.lock
        WARNINGS=$((WARNINGS + 1))
    else
        echo "⚠️  WARN (active lock: ${LOCK_AGE}s old)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "OK (no locks)"
fi

echo ""
echo "================================"
echo "Summary:"
echo "  Errors:   $ERRORS"
echo "  Warnings: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo "✅ Sanity check PASSED"
    echo "Ready to start Phase 0!"
    exit 0
else
    echo "❌ Sanity check FAILED"
    echo "Please fix the errors above before proceeding."
    exit 1
fi
