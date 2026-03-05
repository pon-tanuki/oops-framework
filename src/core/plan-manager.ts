import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { type OopsPlan, type Subtask, type SubtaskStatus, DEFAULT_PLAN } from '../types.js';

const OOPS_DIR = '.oops';
const PLAN_FILE = join(OOPS_DIR, 'plan.json');

function ensureOopsDir(): void {
  if (!existsSync(OOPS_DIR)) {
    mkdirSync(OOPS_DIR, { recursive: true });
  }
}

export function planExists(): boolean {
  return existsSync(PLAN_FILE);
}

export function readPlan(): OopsPlan {
  if (!existsSync(PLAN_FILE)) {
    throw new Error('No plan found. Run `oops plan create` first.');
  }
  try {
    const raw = readFileSync(PLAN_FILE, 'utf-8');
    return JSON.parse(raw) as OopsPlan;
  } catch (err) {
    throw new Error(`Failed to parse ${PLAN_FILE}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function writePlan(plan: OopsPlan): void {
  ensureOopsDir();

  // Atomic write: temp file + write
  const tempFile = join(tmpdir(), `oops-plan-${process.pid}.json`);
  writeFileSync(tempFile, JSON.stringify(plan, null, 2) + '\n');
  writeFileSync(PLAN_FILE, readFileSync(tempFile, 'utf-8'));
  unlinkSync(tempFile);
}

export function createPlan(goal: string, subtaskDefs: { name: string; description: string }[]): OopsPlan {
  const plan: OopsPlan = {
    ...DEFAULT_PLAN,
    goal,
    createdAt: new Date().toISOString(),
    status: 'planning',
    currentSubtask: null,
    subtasks: subtaskDefs.map((def, index) => ({
      id: index + 1,
      name: def.name,
      description: def.description,
      status: 'pending' as SubtaskStatus,
      oopsCount: 0,
      cycles: 0,
    })),
  };

  writePlan(plan);
  return plan;
}

export function getNextSubtask(plan: OopsPlan): Subtask | null {
  return plan.subtasks.find((s) => s.status === 'pending') ?? null;
}

export function isAllCompleted(plan: OopsPlan): boolean {
  return plan.subtasks.every((s) => s.status === 'completed' || s.status === 'skipped');
}

export function updateSubtask(id: number, updater: (subtask: Subtask) => Subtask): OopsPlan {
  const plan = readPlan();
  const index = plan.subtasks.findIndex((s) => s.id === id);

  if (index === -1) {
    throw new Error(`Subtask with id ${id} not found.`);
  }

  plan.subtasks[index] = updater(plan.subtasks[index]);
  writePlan(plan);
  return plan;
}

export function addSubtask(name: string, description: string): OopsPlan {
  const plan = readPlan();
  const maxId = plan.subtasks.length > 0
    ? Math.max(...plan.subtasks.map((s) => s.id))
    : 0;

  plan.subtasks.push({
    id: maxId + 1,
    name,
    description,
    status: 'pending',
    oopsCount: 0,
    cycles: 0,
  });

  writePlan(plan);
  return plan;
}

export function deletePlan(): void {
  if (existsSync(PLAN_FILE)) {
    unlinkSync(PLAN_FILE);
  }
}
