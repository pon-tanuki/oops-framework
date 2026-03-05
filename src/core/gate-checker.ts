import { readdirSync, existsSync } from 'node:fs';
import { updateState } from './state-manager.js';
import { readConfig } from './config-manager.js';
import { runTests as defaultRunTests } from './test-runner.js';
import type { GateResult, Phase, TestResult } from '../types.js';

// Allow dependency injection for testing
type TestRunner = () => TestResult;
type TestFileFinder = (dir?: string) => string[];

export function extractTestSummary(output: string): string {
  const lines = output.split('\n');
  const summaryLines = lines.filter(
    (line) =>
      /Tests?:/.test(line) ||
      /Suites?:/.test(line) ||
      /pass/i.test(line) ||
      /fail/i.test(line) ||
      /^\s*\d+ (passing|failing|pending)/.test(line) ||
      /^ℹ (tests|pass|fail)/.test(line)
  );

  if (summaryLines.length > 0) {
    return summaryLines.map((l) => l.trim()).join('\n');
  }

  const lastLine = lines.filter((l) => l.trim().length > 0).pop();
  return lastLine?.trim() ?? 'No output';
}

function extractFailingTests(output: string): string[] {
  const lines = output.split('\n');
  const failures: string[] = [];

  for (const line of lines) {
    // node:test format: ✗ test name
    if (/^\s*✗\s+/.test(line) || /^\s*✖\s+/.test(line)) {
      failures.push(line.trim());
    }
    // Jest format: ✕ test name or FAIL
    if (/^\s*✕\s+/.test(line) || /^\s*×\s+/.test(line)) {
      failures.push(line.trim());
    }
  }

  return failures.slice(0, 10); // Limit to 10
}

function defaultFindTestFiles(dir: string = '.'): string[] {
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

export function checkGate(
  from: Phase,
  to: Phase,
  deps?: { runTests?: TestRunner; findTestFiles?: TestFileFinder }
): GateResult {
  const run = deps?.runTests ?? defaultRunTests;
  const find = deps?.findTestFiles ?? defaultFindTestFiles;

  if (from === 'RED' && to === 'GREEN') {
    return checkRedToGreen(run, find);
  }
  if (from === 'GREEN' && to === 'REFACTOR') {
    return checkGreenToRefactor(run);
  }
  if (from === 'REFACTOR' && to === 'RED') {
    return checkRefactorToRed(run);
  }
  return { passed: true, reason: 'No gate check required' };
}

function checkRedToGreen(runTests: TestRunner, findTestFiles: TestFileFinder): GateResult {
  const details: string[] = [];

  // 1. Test files exist
  const testFiles = findTestFiles();
  if (testFiles.length === 0) {
    return { passed: false, reason: 'No test files found. Write tests first!', details: ['Create test files (*.test.* or *.spec.*)'] };
  }
  details.push(`Found ${testFiles.length} test file(s)`);

  // 2. Run tests - they should FAIL (RED means tests exist but fail)
  const result = runTests();
  const summary = extractTestSummary(result.output);

  if (result.passed) {
    return {
      passed: false,
      reason: 'Tests are passing! In RED phase, tests should fail (no implementation yet).',
      details: [...details, 'All tests passed - implementation already exists or tests are trivial'],
      testOutput: summary,
    };
  }

  const failures = extractFailingTests(result.output);
  if (failures.length > 0) {
    details.push(`Failing tests:`);
    for (const f of failures) {
      details.push(`  ${f}`);
    }
  }
  details.push('Tests are failing as expected (RED)');

  // Update state with test results
  updateState((state) => ({
    ...state,
    testResults: { ...state.testResults, total: testFiles.length },
  }));

  return { passed: true, reason: 'Gate passed: tests exist and fail as expected', details, testOutput: summary };
}

function checkGreenToRefactor(runTests: TestRunner): GateResult {
  const details: string[] = [];

  const result = runTests();
  const summary = extractTestSummary(result.output);

  if (!result.passed) {
    const failures = extractFailingTests(result.output);
    if (failures.length > 0) {
      details.push('Failing tests:');
      for (const f of failures) {
        details.push(`  ${f}`);
      }
    }
    details.push('Fix implementation before proceeding.');

    return {
      passed: false,
      reason: 'Tests are still failing! Fix implementation before proceeding.',
      details,
      testOutput: summary,
    };
  }

  details.push('All tests passing');

  updateState((state) => ({
    ...state,
    testResults: { ...state.testResults },
  }));

  return { passed: true, reason: 'Gate passed: all tests passing', details, testOutput: summary };
}

function checkRefactorToRed(runTests: TestRunner): GateResult {
  const result = runTests();
  const summary = extractTestSummary(result.output);

  if (!result.passed) {
    const failures = extractFailingTests(result.output);
    const details = ['Tests broke during refactoring!'];
    if (failures.length > 0) {
      details.push('Failing tests:');
      for (const f of failures) {
        details.push(`  ${f}`);
      }
    }

    return {
      passed: false,
      reason: 'Tests broke during refactoring! Fix before starting new cycle.',
      details,
      testOutput: summary,
    };
  }

  return { passed: true, reason: 'Gate passed: tests still passing after refactor', testOutput: summary };
}
