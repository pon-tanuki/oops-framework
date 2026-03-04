// Test file for Phase 0 verification
// This should also be allowed in NONE phase

const { add } = require('./example');

test('add function should sum two numbers', () => {
  expect(add(2, 3)).toBe(5);
});
