import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OopsPlan, Subtask, SubtaskStatus } from '../types.js';

// Inline logic functions for testing (same pattern as hook-logic.test.ts)
function getNextSubtask(plan: OopsPlan): Subtask | null {
  return plan.subtasks.find((s) => s.status === 'pending') ?? null;
}

function isAllCompleted(plan: OopsPlan): boolean {
  return plan.subtasks.every((s) => s.status === 'completed' || s.status === 'skipped');
}

function createSubtasks(defs: { name: string; description: string }[]): Subtask[] {
  return defs.map((def, index) => ({
    id: index + 1,
    name: def.name,
    description: def.description,
    status: 'pending' as SubtaskStatus,
    oopsCount: 0,
    cycles: 0,
  }));
}

function makePlan(overrides: Partial<OopsPlan> = {}): OopsPlan {
  return {
    goal: 'Test goal',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'planning',
    currentSubtask: null,
    subtasks: [],
    ...overrides,
  };
}

describe('Plan creation', () => {
  it('should create subtasks with correct structure', () => {
    const subtasks = createSubtasks([
      { name: 'Task A', description: 'Do A' },
      { name: 'Task B', description: 'Do B' },
    ]);

    assert.equal(subtasks.length, 2);
    assert.equal(subtasks[0].name, 'Task A');
    assert.equal(subtasks[0].description, 'Do A');
    assert.equal(subtasks[1].name, 'Task B');
    assert.equal(subtasks[1].description, 'Do B');
  });

  it('should assign sequential IDs starting from 1', () => {
    const subtasks = createSubtasks([
      { name: 'First', description: 'first' },
      { name: 'Second', description: 'second' },
      { name: 'Third', description: 'third' },
    ]);

    assert.equal(subtasks[0].id, 1);
    assert.equal(subtasks[1].id, 2);
    assert.equal(subtasks[2].id, 3);
  });

  it('should initialize subtasks with pending status', () => {
    const subtasks = createSubtasks([
      { name: 'Task', description: 'desc' },
    ]);

    assert.equal(subtasks[0].status, 'pending');
    assert.equal(subtasks[0].oopsCount, 0);
    assert.equal(subtasks[0].cycles, 0);
  });
});

describe('Next subtask', () => {
  it('should return first pending subtask', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'Done', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'Next', description: '', status: 'pending', oopsCount: 0, cycles: 0 },
        { id: 3, name: 'Later', description: '', status: 'pending', oopsCount: 0, cycles: 0 },
      ],
    });

    const next = getNextSubtask(plan);
    assert.notEqual(next, null);
    assert.equal(next!.id, 2);
    assert.equal(next!.name, 'Next');
  });

  it('should return null when all subtasks are completed', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'A', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'B', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
      ],
    });

    assert.equal(getNextSubtask(plan), null);
  });

  it('should skip subtasks with skipped status', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'Skipped', description: '', status: 'skipped', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'Pending', description: '', status: 'pending', oopsCount: 0, cycles: 0 },
      ],
    });

    const next = getNextSubtask(plan);
    assert.notEqual(next, null);
    assert.equal(next!.id, 2);
  });

  it('should return null when all are skipped', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'A', description: '', status: 'skipped', oopsCount: 0, cycles: 0 },
      ],
    });

    assert.equal(getNextSubtask(plan), null);
  });
});

describe('Completion check', () => {
  it('should detect all completed', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'A', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'B', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
      ],
    });

    assert.equal(isAllCompleted(plan), true);
  });

  it('should treat skipped as done', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'A', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'B', description: '', status: 'skipped', oopsCount: 0, cycles: 0 },
      ],
    });

    assert.equal(isAllCompleted(plan), true);
  });

  it('should detect incomplete when pending exists', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'A', description: '', status: 'completed', oopsCount: 0, cycles: 0 },
        { id: 2, name: 'B', description: '', status: 'pending', oopsCount: 0, cycles: 0 },
      ],
    });

    assert.equal(isAllCompleted(plan), false);
  });

  it('should detect incomplete when in_progress exists', () => {
    const plan = makePlan({
      subtasks: [
        { id: 1, name: 'A', description: '', status: 'in_progress', oopsCount: 0, cycles: 0 },
      ],
    });

    assert.equal(isAllCompleted(plan), false);
  });

  it('should return true for empty subtasks', () => {
    const plan = makePlan({ subtasks: [] });
    assert.equal(isAllCompleted(plan), true);
  });
});
