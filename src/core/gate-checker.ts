import { readdirSync, existsSync } from 'node:fs';
import { readState, updateState } from './state-manager.js';
import { readConfig } from './config-manager.js';
import { runTests } from './test-runner.js';
import type { GateResult, Phase } from '../types.js';

function findTestFiles(dir: string = '.'): string[] {
  const config = readConfig();
  const pattern = new RegExp(config.testFilePattern);
  const results: string[] = [];

  function walk(d: string): void {
    if (!existsSync(d)) return;
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${d}/${entry.name}`;
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.oops') continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (pattern.test(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

export function checkGate(from: Phase, to: Phase): GateResult {
  if (from === 'RED' && to === 'GREEN') {
    return checkRedToGreen();
  }
  if (from === 'GREEN' && to === 'REFACTOR') {
    return checkGreenToRefactor();
  }
  if (from === 'REFACTOR' && to === 'RED') {
    return checkRefactorToRed();
  }
  return { passed: true, reason: 'No gate check required' };
}

function checkRedToGreen(): GateResult {
  const details: string[] = [];

  // 1. Test files exist
  const testFiles = findTestFiles();
  if (testFiles.length === 0) {
    return { passed: false, reason: 'No test files found. Write tests first!', details: ['Create test files (*.test.* or *.spec.*)'] };
  }
  details.push(`Found ${testFiles.length} test file(s)`);

  // 2. Run tests - they should all FAIL (RED means tests exist but fail)
  const result = runTests();

  if (result.passed) {
    return {
      passed: false,
      reason: 'Tests are passing! In RED phase, tests should fail (no implementation yet).',
      details: [...details, 'All tests passed - this means implementation already exists or tests are trivial'],
    };
  }

  details.push('Tests are failing as expected (RED)');

  // Update state with test results
  updateState((state) => ({
    ...state,
    testResults: { ...state.testResults, total: testFiles.length },
  }));

  return { passed: true, reason: 'Gate passed: tests exist and fail as expected', details };
}

function checkGreenToRefactor(): GateResult {
  const details: string[] = [];

  // Run tests - they should all PASS (GREEN means implementation is complete)
  const result = runTests();

  if (!result.passed) {
    return {
      passed: false,
      reason: 'Tests are still failing! Fix implementation before proceeding.',
      details: ['Some tests are failing. Implementation is not complete.'],
    };
  }

  details.push('All tests passing');

  updateState((state) => ({
    ...state,
    testResults: { ...state.testResults },
  }));

  return { passed: true, reason: 'Gate passed: all tests passing', details };
}

function checkRefactorToRed(): GateResult {
  // After refactor, tests should still pass
  const result = runTests();

  if (!result.passed) {
    return {
      passed: false,
      reason: 'Tests broke during refactoring! Fix before starting new cycle.',
    };
  }

  return { passed: true, reason: 'Gate passed: tests still passing after refactor' };
}
