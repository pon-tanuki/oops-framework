import { execSync } from 'node:child_process';
import { readConfig } from './config-manager.js';
import type { TestResult } from '../types.js';

export function runTests(): TestResult {
  const config = readConfig();
  const cmd = config.testCommand;

  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, passed: true, output };
  } catch (err: unknown) {
    if (err && typeof err === 'object') {
      const execErr = err as Record<string, unknown>;
      const stdout = typeof execErr.stdout === 'string' ? execErr.stdout : '';
      const stderr = typeof execErr.stderr === 'string' ? execErr.stderr : '';
      const status = typeof execErr.status === 'number' ? execErr.status : 1;
      return {
        exitCode: status,
        passed: false,
        output: stdout + stderr,
      };
    }
    return {
      exitCode: 1,
      passed: false,
      output: err instanceof Error ? err.message : String(err),
    };
  }
}
