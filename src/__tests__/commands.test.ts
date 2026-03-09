import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STATE, DEFAULT_CONFIG, type OopsState, type OopsPlan, type Subtask } from '../types.js';
import { resetOops } from '../commands/reset.js';
import { showStatus } from '../commands/status.js';
import { setPhase } from '../commands/phase.js';
import { startFeature, completeFeature } from '../commands/feature.js';
import { createPlanCommand, nextSubtask, doneSubtask } from '../commands/plan.js';

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

  it('soft reset should return to NONE phase and preserve oopsCount', () => {
    resetOops();
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
    assert.equal(state.oopsCount, 3); // preserved
    assert.equal(state.featureName, undefined);
    assert.equal(state.sessionId, '');
  });

  it('soft reset should be no-op when already in NONE', () => {
    writeTestState({ phase: 'NONE' });
    resetOops(); // should not throw
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
  });

  it('hard reset should wipe all state', () => {
    resetOops({ hard: true });
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
    assert.equal(state.oopsCount, 0); // wiped
    assert.equal(state.sessionId, '');
  });

  it('hard reset should delete active plan', () => {
    const plan: OopsPlan = {
      goal: 'test',
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      currentSubtask: 1,
      subtasks: [{ id: 1, name: 'task1', description: '', status: 'in_progress', oopsCount: 0, cycles: 0 }],
    };
    writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    assert.equal(existsSync(PLAN_FILE), true);

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

  it('should not throw in NONE phase with no feature', () => {
    writeTestState({ phase: 'NONE' });
    assert.doesNotThrow(() => showStatus());
  });

  it('should not throw in RED phase with active feature', () => {
    writeTestState({ phase: 'RED', featureName: 'my-feature', startedAt: new Date().toISOString() });
    assert.doesNotThrow(() => showStatus());
  });

  it('should not throw when plan exists', () => {
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
    assert.doesNotThrow(() => showStatus());
    rmSync(PLAN_FILE);
  });

  it('should show oops count correctly', () => {
    writeTestState({ phase: 'GREEN', oopsCount: 5, featureName: 'oops-test' });
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

  it('should fail gate check when conditions are not met', () => {
    writeTestState({ phase: 'RED', featureName: 'gate-test' });
    // RED→GREEN gate requires failing tests; with no test files, gate should fail
    // setPhase shows error and returns without throwing after Task 2 changes
    assert.doesNotThrow(() => setPhase('green', {}));
    // Phase should remain RED (gate blocked transition)
    const state = readTestState();
    assert.equal(state.phase, 'RED');
  });

  it('should allow transition when --skip-gate is used', () => {
    writeTestState({ phase: 'RED', featureName: 'gate-test' });
    assert.doesNotThrow(() => setPhase('green', { skipGate: true }));
    const state = readTestState();
    assert.equal(state.phase, 'GREEN');
  });
});

function readTestPlan(): OopsPlan {
  return JSON.parse(readFileSync(PLAN_FILE, 'utf-8'));
}

function writeTestPlan(plan: OopsPlan): void {
  writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
}

function makePlan(overrides: Partial<OopsPlan> = {}): OopsPlan {
  return {
    goal: 'Test goal',
    createdAt: new Date().toISOString(),
    status: 'in_progress',
    currentSubtask: null,
    subtasks: [],
    ...overrides,
  };
}

describe('completeFeature auto-syncs plan subtask', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    writeTestState({});
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
  });

  it('should auto-complete in_progress plan subtask on feature complete', () => {
    writeTestState({ phase: 'REFACTOR', featureName: 'task1', oopsCount: 2, sessionId: 'session-abc' });
    const plan = makePlan({
      currentSubtask: 1,
      subtasks: [
        { id: 1, name: 'task1', description: 'desc', status: 'in_progress', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'task2', description: '', status: 'pending', oopsCount: 0, cycles: 0 },
      ],
    });
    writeTestPlan(plan);

    completeFeature();

    const updated = readTestPlan();
    assert.equal(updated.subtasks[0].status, 'completed');
    assert.equal(updated.subtasks[0].oopsCount, 2);
    assert.ok(updated.subtasks[0].completedAt);
    assert.equal(updated.currentSubtask, null);
    assert.equal(updated.subtasks[1].status, 'pending');
  });

  it('should not modify plan when no plan exists', () => {
    writeTestState({ phase: 'REFACTOR', featureName: 'solo-task', sessionId: 'session-abc' });
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);

    assert.doesNotThrow(() => completeFeature());
    assert.equal(existsSync(PLAN_FILE), false);
  });

  it('should not modify plan when no subtask is in_progress', () => {
    writeTestState({ phase: 'REFACTOR', featureName: 'solo-task', sessionId: 'session-abc' });
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'done-task', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
      ],
    });
    writeTestPlan(plan);

    completeFeature();

    const updated = readTestPlan();
    assert.equal(updated.subtasks[0].status, 'completed');
  });
});

describe('doneSubtask records oopsCount correctly', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    writeTestState({});
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
  });

  it('should record session oopsCount in completed subtask', () => {
    writeTestState({ phase: 'REFACTOR', featureName: 'task1', oopsCount: 5, sessionId: 'session-xyz' });
    const plan = makePlan({
      currentSubtask: 1,
      subtasks: [
        { id: 1, name: 'task1', description: '', status: 'in_progress', oopsCount: 0, cycles: 0 },
      ],
    });
    writeTestPlan(plan);

    doneSubtask();

    const updated = readTestPlan();
    assert.equal(updated.subtasks[0].status, 'completed');
    assert.equal(updated.subtasks[0].oopsCount, 5);
  });
});

describe('nextSubtask records startedAt', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    writeTestState({});
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
  });

  it('should set startedAt when starting subtask', () => {
    writeTestState({ phase: 'NONE' });
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'task1', description: 'desc', status: 'pending', oopsCount: 0, cycles: 0 },
      ],
    });
    writeTestPlan(plan);

    nextSubtask();

    const updated = readTestPlan();
    assert.equal(updated.subtasks[0].status, 'in_progress');
    assert.ok(updated.subtasks[0].startedAt);
    // Verify it's a valid ISO date
    assert.ok(!isNaN(new Date(updated.subtasks[0].startedAt!).getTime()));
  });
});

describe('startFeature with --no-tdd', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    writeTestState({});
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
  });

  it('should start in NONE phase when --no-tdd is set', () => {
    writeTestState({ phase: 'NONE' });
    startFeature('docs-task', { noTdd: true });
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
    assert.equal(state.featureName, 'docs-task');
    assert.equal(state.noTdd, true);
    assert.ok(state.sessionId);
  });

  it('should start in RED phase by default', () => {
    writeTestState({ phase: 'NONE' });
    startFeature('normal-task');
    const state = readTestState();
    assert.equal(state.phase, 'RED');
    assert.equal(state.featureName, 'normal-task');
    assert.notEqual(state.noTdd, true);
  });

  it('should complete from NONE phase when noTdd is true', () => {
    writeTestState({ phase: 'NONE', featureName: 'docs-task', noTdd: true, sessionId: 'session-abc' });
    assert.doesNotThrow(() => completeFeature());
    const state = readTestState();
    assert.equal(state.phase, 'NONE');
    assert.equal(state.featureName, undefined);
    assert.equal(state.noTdd, undefined);
  });
});

describe('createPlanCommand', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    writeTestState({});
  });

  after(() => {
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
  });

  it('should create plan without subtasks', () => {
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
    assert.doesNotThrow(() => createPlanCommand('テスト目標', []));
    const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf-8'));
    assert.equal(plan.goal, 'テスト目標');
    assert.equal(plan.subtasks.length, 0);
    rmSync(PLAN_FILE);
  });

  it('should create plan with subtasks', () => {
    if (existsSync(PLAN_FILE)) rmSync(PLAN_FILE);
    assert.doesNotThrow(() => createPlanCommand('目標', ['タスク1: 説明1', 'タスク2: 説明2']));
    const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf-8'));
    assert.equal(plan.subtasks.length, 2);
    assert.equal(plan.subtasks[0].name, 'タスク1');
    rmSync(PLAN_FILE);
  });
});
