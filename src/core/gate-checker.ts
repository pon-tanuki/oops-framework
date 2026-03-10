import { updateState } from './state-manager.js';
import { readConfig } from './config-manager.js';
import { runTests as defaultRunTests } from './test-runner.js';
import { checkTestQuality as defaultCheckTestQuality, runQualityCommand as defaultRunQualityCommand, findTestFiles } from './quality-checker.js';
import type { GateResult, Phase, TestResult, TestQualityResult, QualityCommandResult } from '../types.js';

// Allow dependency injection for testing
type TestRunner = () => TestResult;
type TestFileFinder = (dir?: string) => string[];
type QualityChecker = () => TestQualityResult;
type QualityCommandRunner = (cmd: string) => QualityCommandResult;

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

// Reuse findTestFiles from quality-checker.ts (exported as findTestFiles)
const defaultFindTestFiles = findTestFiles;

export interface GateDeps {
  runTests?: TestRunner;
  findTestFiles?: TestFileFinder;
  checkQuality?: QualityChecker;
  runQuality?: QualityCommandRunner;
  qualityGateMode?: 'warn' | 'block';
}

export function checkGate(
  from: Phase,
  to: Phase,
  deps?: GateDeps
): GateResult {
  const run = deps?.runTests ?? defaultRunTests;
  const find = deps?.findTestFiles ?? defaultFindTestFiles;

  if (from === 'RED' && to === 'GREEN') {
    return checkRedToGreen(run, find, deps);
  }
  if (from === 'GREEN' && to === 'REFACTOR') {
    return checkGreenToRefactor(run, deps);
  }
  if (from === 'REFACTOR' && to === 'RED') {
    return checkRefactorToRed(run);
  }
  return { passed: true, reason: 'No gate check required' };
}

function checkRedToGreen(runTests: TestRunner, findTestFiles: TestFileFinder, deps?: GateDeps): GateResult {
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

  // 3. Quality gate check (if available)
  const qualityWarnings = checkTestQualityGate(deps);
  if (qualityWarnings.length > 0) {
    const mode = deps?.qualityGateMode ?? getQualityGateMode();
    if (mode === 'block') {
      return {
        passed: false,
        reason: 'Test quality gate failed. Improve test quality before proceeding.',
        details: [...details, ...qualityWarnings],
        testOutput: summary,
        qualityWarnings,
      };
    }
    return { passed: true, reason: 'Gate passed: tests exist and fail as expected', details, testOutput: summary, qualityWarnings };
  }

  return { passed: true, reason: 'Gate passed: tests exist and fail as expected', details, testOutput: summary };
}

function checkGreenToRefactor(runTests: TestRunner, deps?: GateDeps): GateResult {
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

  // Quality command check (if available)
  const qualityWarnings = checkQualityCommandGate(deps);
  if (qualityWarnings.length > 0) {
    const mode = deps?.qualityGateMode ?? getQualityGateMode();
    if (mode === 'block') {
      return {
        passed: false,
        reason: 'Quality gate failed. Fix lint/quality issues before proceeding.',
        details: [...details, ...qualityWarnings],
        testOutput: summary,
        qualityWarnings,
      };
    }
    return { passed: true, reason: 'Gate passed: all tests passing', details, testOutput: summary, qualityWarnings };
  }

  return { passed: true, reason: 'Gate passed: all tests passing', details, testOutput: summary };
}

function getQualityGateMode(): 'warn' | 'block' {
  try {
    const config = readConfig();
    return config.qualityGate?.mode ?? 'warn';
  } catch {
    return 'warn';
  }
}

function checkTestQualityGate(deps?: GateDeps): string[] {
  try {
    const config = readConfig();
    if (!config.features?.qualityGate) return [];

    const checker = deps?.checkQuality ?? (() => defaultCheckTestQuality());
    const result = checker();
    return result.issues;
  } catch {
    return [];
  }
}

function checkQualityCommandGate(deps?: GateDeps): string[] {
  try {
    const config = readConfig();
    if (!config.features?.qualityGate) return [];

    const qualityCommand = config.qualityGate?.qualityCommand;
    const runner = deps?.runQuality;

    // No command configured and no injected runner — skip
    if (!qualityCommand && !runner) return [];

    // Use injected runner or fall back to real command
    if (runner) {
      const result = runner(qualityCommand ?? '');
      if (!result.passed) {
        return [`Quality command failed: ${result.output}`];
      }
      return [];
    }

    const result = defaultRunQualityCommand(qualityCommand);
    if (!result.passed) {
      return [`Quality command failed: ${result.output}`];
    }
    return [];
  } catch {
    return [];
  }
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
