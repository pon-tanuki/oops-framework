// Calculator tests for OOPS Phase 0 LLM learning tests
const { add, subtract, multiply, divide } = require('../src/calculator');

test('add returns sum', () => {
  expect(add(1, 2)).toBe(3);
});

test('subtract returns difference', () => {
  expect(subtract(5, 3)).toBe(2);
});

test('multiply returns product', () => {
  expect(multiply(3, 4)).toBe(12);
});

test('divide returns quotient', () => {
  expect(divide(10, 2)).toBe(5);
});

test('divide throws on zero', () => {
  expect(() => divide(1, 0)).toThrow('Division by zero');
});

test('power returns base raised to exponent', () => {
  expect(power(2, 3)).toBe(8);
});

test('divide handles negative numbers correctly', () => {
  expect(divide(-6, 3)).toBe(-2);
  expect(divide(6, -3)).toBe(-2);
});
