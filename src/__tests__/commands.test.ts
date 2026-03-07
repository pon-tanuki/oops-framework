import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STATE, DEFAULT_CONFIG, type OopsState, type OopsPlan } from '../types.js';

// We test command logic by manipulating state files directly
// since commands use the state-manager which reads from .oops/
const OOPS_DIR = '.oops';
const STATE_FILE = join(OOPS_DIR, 'state.json');
const CONFIG_FILE = join(OOPS_DIR, 'config.json');
const PLAN_FILE = join(OOPS_DIR, 'plan.json');

function writeTestState(overrides: Partial<OopsState>): void {
  const state = { ...DEFAULT_STATE, ...overrides };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function readTestState(): OopsState {
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

describe('resetOops', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    // Restore to defaults
    writeTestState({});
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
  });

  beforeEach(() => {
    writeTestState({ phase: 'RED', featureName: 'test-feature', oopsCount: 3, sessionId: 'session-abc' });
  });

  it('soft reset should return to NONE phase and preserve oopsCount', async () => {
    const { resetOops } = await import('../commands/reset.js');
    resetOops();
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
    assert.equal(state.oopsCount, 3); // preserved
    assert.equal(state.featureName, undefined);
    assert.equal(state.sessionId, '');
  });

  it('soft reset should be no-op when already in NONE', async () => {
    writeTestState({ phase: 'NONE' });
    const { resetOops } = await import('../commands/reset.js');
    resetOops(); // should not throw
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
  });

  it('hard reset should wipe all state', async () => {
    const { resetOops } = await import('../commands/reset.js');
    resetOops({ hard: true });
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
    assert.equal(state.oopsCount, 0); // wiped
    assert.equal(state.sessionId, '');
  });

  it('hard reset should delete active plan', async () => {
    const plan: OopsPlan = {
      goal: 'test',
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      currentSubtask: 1,
      subtasks: [{ id: 1, name: 'task1', description: '', status: 'in_progress', oopsCount: 0, cycles: 0 }],
    };
    writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    assert.equal(existsSync(PLAN_FILE), true);

    const { resetOops } = await import('../commands/reset.js');
    resetOops({ hard: true });
    assert.equal(existsSync(PLAN_FILE), false);
  });
});

describe('showStatus', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    writeTestState({});
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
  });

  it('should not throw in NONE phase with no feature', async () => {
    writeTestState({ phase: 'NONE' });
    const { showStatus } = await import('../commands/status.js');
    assert.doesNotThrow(() => showStatus());
  });

  it('should not throw in RED phase with active feature', async () => {
    writeTestState({ phase: 'RED', featureName: 'my-feature', startedAt: new Date().toISOString() });
    const { showStatus } = await import('../commands/status.js');
    assert.doesNotThrow(() => showStatus());
  });

  it('should not throw when plan exists', async () => {
    writeTestState({ phase: 'RED', featureName: 'my-feature' });
    const plan: OopsPlan = {
      goal: 'Build something',
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      currentSubtask: 1,
      subtasks: [
        { id: 1, name: 'task1', description: 'desc', status: 'in_progress', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'task2', description: '', status: 'pending', oopsCount: 0, cycles: 0 },
      ],
    };
    writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    const { showStatus } = await import('../commands/status.js');
    assert.doesNotThrow(() => showStatus());
    rmSync(PLAN_FILE);
  });

  it('should show oops count correctly', async () => {
    writeTestState({ phase: 'GREEN', oopsCount: 5, featureName: 'oops-test' });
    const { showStatus } = await import('../commands/status.js');
    // Just verify it runs without errors
    assert.doesNotThrow(() => showStatus());
  });
});

describe('setPhase with gate integration', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    writeTestState({});
  });

  it('should fail gate check when conditions are not met', async () => {
    writeTestState({ phase: 'RED', featureName: 'gate-test' });
    const { setPhase } = await import('../commands/phase.js');
    // RED→GREEN gate requires failing tests; with no test files, gate should fail
    // setPhase shows error and returns without throwing after Task 2 changes
    assert.doesNotThrow(() => setPhase('green', {}));
    // Phase should remain RED (gate blocked transition)
    const state = readTestState();
    assert.equal(state.phase, 'RED');
  });

  it('should allow transition when --skip-gate is used', async () => {
    writeTestState({ phase: 'RED', featureName: 'gate-test' });
    const { setPhase } = await import('../commands/phase.js');
    assert.doesNotThrow(() => setPhase('green', { skipGate: true }));
    const state = readTestState();
    assert.equal(state.phase, 'GREEN');
  });
});
