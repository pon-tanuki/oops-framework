import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { readConfig } from './config-manager.js';
import type { TestQualityResult, QualityCommandResult } from '../types.js';

// --- Test file finder (reusable) ---

export function findTestFiles(dir: string = '.'): string[] {
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

// --- Regex patterns for test quality analysis ---

const TEST_CASE_PATTERN = /\b(?:it|test)\s*\(/g;
const ASSERTION_PATTERN = /\b(?:expect|assert)\s*[.(]/g;
const ERROR_CASE_KEYWORDS = /\b(?:error|invalid|fail|reject|throw|not|wrong|missing|empty)\b/i;

// --- Test quality checker ---

export function checkTestQuality(dir: string = '.'): TestQualityResult {
  const config = readConfig();
  const qConfig = config.qualityGate;

  const testFiles = findTestFiles(dir);
  let totalTestCases = 0;
  let totalAssertions = 0;
  let hasErrorCases = false;

  for (const filePath of testFiles) {
    const content = readFileSync(filePath, 'utf-8');

    // Count test cases
    const testMatches = content.match(TEST_CASE_PATTERN);
    const testCount = testMatches?.length ?? 0;
    totalTestCases += testCount;

    // Count assertions
    const assertionMatches = content.match(ASSERTION_PATTERN);
    totalAssertions += assertionMatches?.length ?? 0;

    // Check for error/edge case tests
    // Extract test names and check for error-related keywords
    const testNamePattern = /\b(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = testNamePattern.exec(content)) !== null) {
      if (ERROR_CASE_KEYWORDS.test(match[1])) {
        hasErrorCases = true;
      }
    }
  }

  const assertionsPerTest = totalTestCases > 0 ? totalAssertions / totalTestCases : 0;

  // Build issues list
  const issues: string[] = [];

  if (totalTestCases < qConfig.minTestCases) {
    issues.push(`Only ${totalTestCases} test case(s) found (minimum: ${qConfig.minTestCases})`);
  }

  if (assertionsPerTest < qConfig.minAssertionsPerTest) {
    issues.push(`Assertion density is ${assertionsPerTest.toFixed(1)} per test (minimum: ${qConfig.minAssertionsPerTest})`);
  }

  if (qConfig.requireErrorCases && !hasErrorCases) {
    issues.push('No error/edge case tests found. Add tests for invalid inputs, boundary conditions, etc.');
  }

  return {
    testCaseCount: totalTestCases,
    assertionCount: totalAssertions,
    assertionsPerTest,
    hasErrorCases,
    issues,
  };
}

// --- External quality command runner ---

export function runQualityCommand(command: string): QualityCommandResult {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { passed: true, output: output.trim() };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string };
    const output = ((execErr.stdout ?? '') + (execErr.stderr ?? '')).trim();
    return { passed: false, output };
  }
}
