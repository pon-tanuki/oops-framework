import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STATE, DEFAULT_CONFIG, type OopsState } from '../types.js';

const TEST_DIR = join(process.cwd(), '.oops-test-hooks');
const OOPS_DIR = join(TEST_DIR, '.oops');
const STATE_FILE = join(OOPS_DIR, 'state.json');
const LOCK_FILE = join(OOPS_DIR, 'state.lock');

function writeState(state: OopsState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function runPreHook(input: object): { stdout: string; stderr: string; exitCode: number } {
  const hookPath = join(process.cwd(), 'src', 'hooks', 'pre-tool-use.ts');
  try {
    const stdout = execFileSync('npx', ['tsx', hookPath], {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      cwd: TEST_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

function parseHookOutput(stdout: string): { permissionDecision: string; permissionDecisionReason?: string } {
  const parsed = JSON.parse(stdout);
  return parsed.hookSpecificOutput;
}

describe('PreToolUse hook integration', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
  });

  after(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  });

  it('should allow non-write tools regardless of phase', () => {
    writeState({ ...DEFAULT_STATE, phase: 'RED' });

    const result = runPreHook({ tool_name: 'Read', tool_input: { file_path: 'src/app.ts' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'allow');
  });

  it('should allow all writes when OOPS is not initialized', () => {
    // Remove state file to simulate uninitialized
    if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);

    const result = runPreHook({ tool_name: 'Write', tool_input: { file_path: 'src/app.ts' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'allow');
  });

  it('should allow all writes in NONE phase', () => {
    writeState({ ...DEFAULT_STATE, phase: 'NONE' });

    const result = runPreHook({ tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'allow');
  });

  it('should allow test file writes in RED phase', () => {
    writeState({ ...DEFAULT_STATE, phase: 'RED' });

    const result = runPreHook({ tool_name: 'Write', tool_input: { file_path: 'src/__tests__/app.test.ts' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'allow');
  });

  it('should deny implementation file writes in RED phase', () => {
    writeState({ ...DEFAULT_STATE, phase: 'RED' });

    const result = runPreHook({ tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'deny');
  });

  it('should allow implementation file writes in GREEN phase', () => {
    writeState({ ...DEFAULT_STATE, phase: 'GREEN' });

    const result = runPreHook({ tool_name: 'Write', tool_input: { file_path: 'src/app.ts' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'allow');
  });

  it('should deny test file writes in GREEN phase', () => {
    writeState({ ...DEFAULT_STATE, phase: 'GREEN' });

    const result = runPreHook({ tool_name: 'Edit', tool_input: { file_path: 'src/__tests__/app.test.ts' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'deny');
  });

  it('should allow both test and impl file writes in REFACTOR phase', () => {
    writeState({ ...DEFAULT_STATE, phase: 'REFACTOR' });

    const implResult = runPreHook({ tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } });
    assert.equal(parseHookOutput(implResult.stdout).permissionDecision, 'allow');

    // Clean lock between runs
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);

    const testResult = runPreHook({ tool_name: 'Edit', tool_input: { file_path: 'src/__tests__/app.test.ts' } });
    assert.equal(parseHookOutput(testResult.stdout).permissionDecision, 'allow');
  });

  it('should increment oops count on RED phase violation', () => {
    writeState({ ...DEFAULT_STATE, phase: 'RED', oopsCount: 0 });

    runPreHook({ tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } });

    const stateRaw = readFileSync(STATE_FILE, 'utf-8');
    const state = JSON.parse(stateRaw);
    assert.equal(state.oopsCount, 1);
    assert.notEqual(state.lastOops, null);
  });

  it('should deny on invalid JSON stdin', () => {
    const hookPath = join(process.cwd(), 'src', 'hooks', 'pre-tool-use.ts');
    try {
      execFileSync('npx', ['tsx', hookPath], {
        input: 'not json at all',
        encoding: 'utf-8',
        cwd: TEST_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
    } catch (err: unknown) {
      // Hook should still produce stdout with deny
      const e = err as { stdout?: string };
      if (e.stdout) {
        const output = parseHookOutput(e.stdout);
        assert.equal(output.permissionDecision, 'deny');
      }
    }
  });

  it('should handle NotebookEdit tool', () => {
    writeState({ ...DEFAULT_STATE, phase: 'RED' });

    const result = runPreHook({ tool_name: 'NotebookEdit', tool_input: { file_path: 'notebook.test.ipynb' } });
    const output = parseHookOutput(result.stdout);
    assert.equal(output.permissionDecision, 'allow'); // .test. in path
  });
});
