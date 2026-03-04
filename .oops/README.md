# OOPS Framework State Directory

This directory contains the runtime state for the OOPS Framework.

## Files

- `state.json` - Current phase state and statistics
- `state.lock` - Lock file for concurrent access prevention
- `phase0-results/` - Phase 0 verification experiment results

## State Schema

```json
{
  "phase": "NONE | RED | GREEN | REFACTOR",
  "sessionId": "string",
  "orchestratorId": "string",
  "locked": boolean,
  "oopsCount": number,
  "lastOops": "ISO-8601 timestamp or null",
  "testResults": {
    "passed": number,
    "failed": number,
    "total": number
  }
}
```

## Phase Transitions

- `NONE` → `RED`: Start TDD cycle (Orchestrator creates Test Writer agent)
- `RED` → `GREEN`: Tests written and failing (Orchestrator creates Implementation agent)
- `GREEN` → `REFACTOR`: Tests passing (Orchestrator creates Refactor agent)
- `REFACTOR` → `RED`: Refactoring complete (Start new cycle)

## Safety

- All state updates must be atomic (temp file + mv)
- Lock acquisition required before state modifications
- Default to deny on errors (fail-safe)
