// Test file for Phase 0 verification
// This should also be allowed in NONE phase

const { add } = require('./example');

test('add function should sum two numbers', () => {
  expect(add(2, 3)).toBe(5);
});

test('add function should handle negative numbers', () => {
  expect(add(-1, 1)).toBe(0);
});

// Added during REFACTOR phase (allowed with warning)
