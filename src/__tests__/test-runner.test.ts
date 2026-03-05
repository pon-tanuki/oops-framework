import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import type { TestResult } from '../types.js';

// Test the test-runner pattern (same logic as test-runner.ts)
// without depending on config-manager file I/O

function runCommand(cmd: string, timeout = 10000): TestResult {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, passed: true, output };
  } catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string; stderr?: string };
    const output = (execErr.stdout ?? '') + (execErr.stderr ?? '');
    return {
      exitCode: execErr.status ?? 1,
      passed: false,
      output,
    };
  }
}

describe('Test runner execution', () => {
  it('should return passed=true for successful commands', () => {
    const result = runCommand('echo "all tests pass"');
    assert.equal(result.passed, true);
    assert.equal(result.exitCode, 0);
    assert.match(result.output, /all tests pass/);
  });

  it('should return passed=false for failing commands', () => {
    const result = runCommand('exit 1');
    assert.equal(result.passed, false);
    assert.equal(result.exitCode, 1);
  });

  it('should capture stdout output', () => {
    const result = runCommand('echo "line1" && echo "line2"');
    assert.equal(result.passed, true);
    assert.match(result.output, /line1/);
    assert.match(result.output, /line2/);
  });

  it('should capture stderr on failure', () => {
    const result = runCommand('echo "error msg" >&2; exit 1');
    assert.equal(result.passed, false);
    assert.match(result.output, /error msg/);
  });

  it('should handle non-existent commands', () => {
    const result = runCommand('nonexistent_command_xyz_123');
    assert.equal(result.passed, false);
    assert.notEqual(result.exitCode, 0);
  });

  it('should handle timeout', () => {
    const result = runCommand('sleep 5', 500);
    assert.equal(result.passed, false);
  });
});

describe('Test result structure', () => {
  it('should always have exitCode, passed, and output fields', () => {
    const success = runCommand('echo ok');
    assert.equal(typeof success.exitCode, 'number');
    assert.equal(typeof success.passed, 'boolean');
    assert.equal(typeof success.output, 'string');

    const failure = runCommand('exit 1');
    assert.equal(typeof failure.exitCode, 'number');
    assert.equal(typeof failure.passed, 'boolean');
    assert.equal(typeof failure.output, 'string');
  });

  it('should have exitCode 0 for passing tests', () => {
    const result = runCommand('true');
    assert.equal(result.exitCode, 0);
    assert.equal(result.passed, true);
  });

  it('should have non-zero exitCode for failing tests', () => {
    const result = runCommand('exit 2');
    assert.equal(result.exitCode, 2);
    assert.equal(result.passed, false);
  });
});
