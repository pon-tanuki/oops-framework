// String utils tests for OOPS Phase 0 LLM learning tests
const { capitalize, reverse, truncate } = require('../src/string-utils');

test('capitalize first letter', () => {
  expect(capitalize('hello')).toBe('Hello');
});

test('reverse a string', () => {
  expect(reverse('abc')).toBe('cba');
});

test('truncate long string', () => {
  expect(truncate('hello world', 5)).toBe('hello...');
});

test('truncate does not modify short string', () => {
  expect(truncate('hi', 5)).toBe('hi');
});
