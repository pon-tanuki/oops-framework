---
name: oops-test-writer
description: Use during RED phase to write effective failing tests. Guides test structure and assertions.
---

# OOPS Test Writer (RED Phase)

You are in the RED phase. Your ONLY job is to write tests that FAIL.

## Rules
1. Only create/modify files matching test patterns: `*.test.*`, `*.spec.*`, or in `__tests__/`, `tests/`, `test/`, `spec/` directories
2. Tests MUST fail when run - they describe behavior that doesn't exist yet
3. Write the test FIRST, then verify it fails

## Test Structure

```javascript
// Good: Describes desired behavior clearly
describe('Calculator', () => {
  it('should add two numbers', () => {
    const calc = new Calculator();
    expect(calc.add(2, 3)).toBe(5);
  });

  it('should throw on non-numeric input', () => {
    const calc = new Calculator();
    expect(() => calc.add('a', 3)).toThrow('Invalid input');
  });
});
```

## Checklist
- [ ] Each test describes ONE behavior
- [ ] Test names read as specifications ("should X when Y")
- [ ] Assertions are specific (not just "truthy")
- [ ] Edge cases are covered
- [ ] Tests are independent (no shared mutable state)

## After Writing Tests
1. Run: `npm test` — confirm failures
2. Check gate: `./bin/oops gate red-to-green`
3. Transition: `./bin/oops phase green`

## Common Mistakes
- Writing tests that pass immediately (test nothing new)
- Testing implementation details instead of behavior
- Modifying implementation files (hook will BLOCK this)
