---
name: oops-orchestrator
description: Use when starting a TDD session with the OOPS Framework. Guides the RED-GREEN-REFACTOR cycle and manages phase transitions.
---

# OOPS Orchestrator

You are managing a TDD session using the OOPS Framework. Follow these rules strictly.

## Phase Overview

| Phase | Allowed Files | Goal |
|-------|--------------|------|
| RED | Test files only | Write failing tests |
| GREEN | Implementation files only | Make tests pass (minimal code) |
| REFACTOR | Both (tests warned) | Improve code, tests must stay passing |

## Workflow

### Starting a Feature
```bash
./bin/oops feature start <feature-name>
```
This sets the phase to RED automatically.

### RED Phase
1. Write test files that describe the desired behavior
2. Run tests to confirm they FAIL: `npm test`
3. When tests are failing as expected, check the gate:
   ```bash
   ./bin/oops gate red-to-green
   ```
4. Transition to GREEN:
   ```bash
   ./bin/oops phase green
   ```

### GREEN Phase
1. Write the MINIMUM implementation to make tests pass
2. Do NOT refactor yet - just make it work
3. Run tests to confirm they PASS: `npm test`
4. Check the gate:
   ```bash
   ./bin/oops gate green-to-refactor
   ```
5. Transition to REFACTOR:
   ```bash
   ./bin/oops phase refactor
   ```

### REFACTOR Phase
1. Improve code structure, naming, performance
2. Run tests after EVERY change to ensure they still pass
3. Do NOT add new functionality
4. When done, start next cycle:
   ```bash
   ./bin/oops phase red
   ```

### Completing a Feature
```bash
./bin/oops feature complete
```

## Key Rules
- NEVER skip phases. RED → GREEN → REFACTOR → RED
- The PreToolUse hook will BLOCK invalid file edits
- If blocked, check current phase: `./bin/oops phase`
- Gate checks are mandatory for transitions
- Use `--force` only as a last resort
