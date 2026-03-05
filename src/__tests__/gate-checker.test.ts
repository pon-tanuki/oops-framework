import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkGate, extractTestSummary } from '../core/gate-checker.js';
import type { TestResult } from '../types.js';

// Mock test runners
function passingTests(): TestResult {
  return { exitCode: 0, passed: true, output: 'ℹ tests 5\nℹ pass 5\nℹ fail 0' };
}

function failingTests(): TestResult {
  return { exitCode: 1, passed: false, output: '✗ should add two numbers\n✗ should subtract\nℹ tests 5\nℹ pass 3\nℹ fail 2' };
}

function noTestFiles(): string[] {
  return [];
}

function someTestFiles(): string[] {
  return ['src/__tests__/app.test.ts', 'src/__tests__/utils.test.ts'];
}

describe('RED → GREEN gate', () => {
  it('should fail when no test files exist', () => {
    const result = checkGate('RED', 'GREEN', {
      runTests: passingTests,
      findTestFiles: noTestFiles,
    });
    assert.equal(result.passed, false);
    assert.match(result.reason, /No test files found/);
  });

  it('should fail when tests are passing (tests should fail in RED)', () => {
    const result = checkGate('RED', 'GREEN', {
      runTests: passingTests,
      findTestFiles: someTestFiles,
    });
    assert.equal(result.passed, false);
    assert.match(result.reason, /Tests are passing/);
  });

  it('should pass when test files exist and tests fail', () => {
    const result = checkGate('RED', 'GREEN', {
      runTests: failingTests,
      findTestFiles: someTestFiles,
    });
    assert.equal(result.passed, true);
    assert.match(result.reason, /Gate passed/);
    assert.ok(result.testOutput);
  });

  it('should include failing test names in details', () => {
    const result = checkGate('RED', 'GREEN', {
      runTests: failingTests,
      findTestFiles: someTestFiles,
    });
    assert.ok(result.details);
    const detailsText = result.details!.join('\n');
    assert.match(detailsText, /should add two numbers/);
  });
});

describe('GREEN → REFACTOR gate', () => {
  it('should pass when all tests are passing', () => {
    const result = checkGate('GREEN', 'REFACTOR', {
      runTests: passingTests,
    });
    assert.equal(result.passed, true);
    assert.match(result.reason, /Gate passed/);
  });

  it('should fail when tests are failing', () => {
    const result = checkGate('GREEN', 'REFACTOR', {
      runTests: failingTests,
    });
    assert.equal(result.passed, false);
    assert.match(result.reason, /Tests are still failing/);
    assert.ok(result.testOutput);
  });

  it('should include failing test names when tests fail', () => {
    const result = checkGate('GREEN', 'REFACTOR', {
      runTests: failingTests,
    });
    assert.ok(result.details);
    const detailsText = result.details!.join('\n');
    assert.match(detailsText, /should add two numbers/);
  });
});

describe('REFACTOR → RED gate', () => {
  it('should pass when tests are still passing', () => {
    const result = checkGate('REFACTOR', 'RED', {
      runTests: passingTests,
    });
    assert.equal(result.passed, true);
    assert.match(result.reason, /Gate passed/);
  });

  it('should fail when tests broke during refactoring', () => {
    const result = checkGate('REFACTOR', 'RED', {
      runTests: failingTests,
    });
    assert.equal(result.passed, false);
    assert.match(result.reason, /Tests broke/);
  });
});

describe('extractTestSummary', () => {
  it('should extract node:test summary lines', () => {
    const output = 'some output\nℹ tests 5\nℹ pass 5\nℹ fail 0\nmore output';
    const summary = extractTestSummary(output);
    assert.match(summary, /tests 5/);
    assert.match(summary, /pass 5/);
  });

  it('should extract Jest-style summary lines', () => {
    const output = 'Tests:  3 passed, 3 total\nSuites: 1 passed, 1 total';
    const summary = extractTestSummary(output);
    assert.match(summary, /3 passed/);
  });

  it('should return last line as fallback', () => {
    const output = 'no summary here\njust some output';
    const summary = extractTestSummary(output);
    assert.equal(summary, 'just some output');
  });

  it('should handle empty output', () => {
    const summary = extractTestSummary('');
    assert.equal(summary, 'No output');
  });
});

describe('No gate required', () => {
  it('should pass for non-gated transitions', () => {
    const result = checkGate('NONE', 'RED');
    assert.equal(result.passed, true);
    assert.match(result.reason, /No gate check required/);
  });
});
