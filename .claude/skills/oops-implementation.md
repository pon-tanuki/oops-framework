---
name: oops-implementation
description: Use during GREEN phase to write minimal implementation code that makes tests pass.
---

# OOPS Implementation (GREEN Phase)

You are in the GREEN phase. Your ONLY job is to make the failing tests pass with MINIMAL code.

## Rules
1. Only create/modify implementation files (NOT test files — hook will BLOCK)
2. Write the MINIMUM code to make tests pass
3. Do NOT add features beyond what tests require
4. Do NOT refactor — that's for the REFACTOR phase

## Process
1. Read the failing test output to understand what's expected
2. Write just enough code to satisfy each assertion
3. Run tests after each change: `npm test`
4. Repeat until ALL tests pass

## Minimal Implementation Examples

```javascript
// BAD: Over-engineered during GREEN phase
class Calculator {
  constructor(precision = 2, locale = 'en-US') { ... }
  add(a, b) {
    this.validate(a, b);
    return this.round(a + b);
  }
}

// GOOD: Minimal to pass tests
class Calculator {
  add(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Invalid input');
    }
    return a + b;
  }
}
```

## After All Tests Pass
1. Run: `npm test` — confirm ALL pass
2. Check gate: `./bin/oops gate green-to-refactor`
3. Transition: `./bin/oops phase refactor`

## Common Mistakes
- Adding functionality not required by tests
- Refactoring before tests pass
- Modifying test files (hook will BLOCK this)
- Writing "clever" code instead of obvious code
