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
    const execErr = err as { status?: number; stdout?: string; stderr?: string };
    const output = (execErr.stdout ?? '') + (execErr.stderr ?? '');
    return {
      exitCode: execErr.status ?? 1,
      passed: false,
      output,
    };
  }
}
