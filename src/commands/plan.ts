import chalk from 'chalk';
import { startFeature, completeFeature } from './feature.js';
import {
  planExists,
  readPlan,
  writePlan,
  createPlan,
  getNextSubtask,
  isAllCompleted,
  updateSubtask,
  addSubtask,
  deletePlan,
} from '../core/plan-manager.js';
import type { SubtaskStatus } from '../types.js';
import { CliError } from '../core/errors.js';

const STATUS_ICONS: Record<SubtaskStatus, string> = {
  pending: '\u2B1C',
  in_progress: '\uD83D\uDD04',
  completed: '\u2705',
  skipped: '\u23ED\uFE0F',
};

function parseSubtaskArg(arg: string): { name: string; description: string } {
  const colonIndex = arg.indexOf(':');
  if (colonIndex === -1) {
    return { name: arg.trim(), description: '' };
  }
  return {
    name: arg.slice(0, colonIndex).trim(),
    description: arg.slice(colonIndex + 1).trim(),
  };
}

export function createPlanCommand(goal: string, subtaskArgs: string[]): void {
  if (planExists()) {
    throw new CliError('A plan already exists. Run `oops plan complete` or delete it first.');
  }

  const subtaskDefs = subtaskArgs.map(parseSubtaskArg);
  const plan = createPlan(goal, subtaskDefs);

  console.log(chalk.bold(`\n\uD83D\uDCCB Plan created: ${chalk.cyan(goal)}`));
  if (plan.subtasks.length > 0) {
    console.log(`   ${plan.subtasks.length} subtask(s):\n`);
    for (const st of plan.subtasks) {
      console.log(`   ${STATUS_ICONS[st.status]} ${st.id}. ${chalk.bold(st.name)}${st.description ? ` - ${st.description}` : ''}`);
    }
  } else {
    console.log(chalk.gray('   No subtasks yet. Add with: oops plan add "name: description"'));
  }
  console.log('');
}

export function showPlan(): void {
  if (!planExists()) {
    console.log(chalk.gray('No plan found. Run `oops plan create` to start.'));
    return;
  }

  const plan = readPlan();

  console.log(chalk.bold(`\n\uD83D\uDCCB Plan: ${chalk.cyan(plan.goal)}`));
  console.log(`   Status: ${plan.status}`);
  console.log(`   Created: ${plan.createdAt}\n`);

  if (plan.subtasks.length === 0) {
    console.log(chalk.gray('   No subtasks.'));
  } else {
    for (const st of plan.subtasks) {
      const icon = STATUS_ICONS[st.status];
      const name = st.status === 'in_progress' ? chalk.yellow(st.name) : st.name;
      const desc = st.description ? chalk.gray(` - ${st.description}`) : '';
      const stats = st.oopsCount > 0 || st.cycles > 0
        ? chalk.gray(` (oops: ${st.oopsCount}, cycles: ${st.cycles})`)
        : '';
      console.log(`   ${icon} ${st.id}. ${chalk.bold(name)}${desc}${stats}`);
    }
  }

  console.log('');
}

export function nextSubtask(): void {
  if (!planExists()) {
    throw new CliError('No plan found. Run `oops plan create` first.');
  }

  const plan = readPlan();
  const next = getNextSubtask(plan);

  if (!next) {
    console.log(chalk.green('All subtasks are done! Run `oops plan complete` to finish.'));
    return;
  }

  // Mark subtask as in_progress and update plan state in a single write
  const updated = readPlan();
  const idx = updated.subtasks.findIndex((s) => s.id === next.id);
  updated.subtasks[idx] = { ...updated.subtasks[idx], status: 'in_progress' };
  updated.status = 'in_progress';
  updated.currentSubtask = next.id;
  writePlan(updated);

  console.log(chalk.bold(`\n\u25B6\uFE0F Starting subtask ${next.id}: ${chalk.cyan(next.name)}`));
  if (next.description) {
    console.log(`   ${chalk.gray(next.description)}`);
  }
  console.log('');

  // Start feature with subtask name
  startFeature(next.name);
}

export function doneSubtask(): void {
  if (!planExists()) {
    throw new CliError('No plan found.');
  }

  const plan = readPlan();
  const current = plan.subtasks.find((s) => s.status === 'in_progress');

  if (!current) {
    throw new CliError('No subtask in progress. Run `oops plan next` first.');
  }

  // Complete the feature first
  completeFeature();

  // Mark subtask as completed and clear current in a single write
  const updated = readPlan();
  const idx = updated.subtasks.findIndex((s) => s.id === current.id);
  updated.subtasks[idx] = { ...updated.subtasks[idx], status: 'completed' };
  updated.currentSubtask = null;
  writePlan(updated);

  console.log(chalk.green(`\n\u2705 Subtask ${current.id} completed: ${chalk.cyan(current.name)}`));

  const next = getNextSubtask(updated);
  if (next) {
    console.log(chalk.gray(`   Next up: ${next.id}. ${next.name}`));
  } else if (isAllCompleted(updated)) {
    console.log(chalk.green('   All subtasks done! Run `oops plan complete` to finish the plan.'));
  }
  console.log('');
}

export function completePlan(): void {
  if (!planExists()) {
    throw new CliError('No plan found.');
  }

  const plan = readPlan();

  if (!isAllCompleted(plan)) {
    const remaining = plan.subtasks.filter((s) => s.status === 'pending' || s.status === 'in_progress');
    throw new CliError(`${remaining.length} subtask(s) still remaining.\nComplete or skip all subtasks first.`);
  }

  plan.status = 'completed';
  writePlan(plan);

  const completed = plan.subtasks.filter((s) => s.status === 'completed').length;
  const skipped = plan.subtasks.filter((s) => s.status === 'skipped').length;
  const totalOops = plan.subtasks.reduce((sum, s) => sum + s.oopsCount, 0);

  console.log(chalk.bold(`\n\uD83C\uDF89 Plan completed: ${chalk.cyan(plan.goal)}`));
  console.log(`   Completed: ${completed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total oops: ${totalOops === 0 ? chalk.green('0') : chalk.yellow(String(totalOops))}`);
  console.log('');

  deletePlan();
}

export function skipSubtask(idStr: string): void {
  if (!planExists()) {
    throw new CliError('No plan found.');
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    throw new CliError(`Invalid subtask ID: ${idStr}`);
  }

  const plan = readPlan();
  const subtask = plan.subtasks.find((s) => s.id === id);

  if (!subtask) {
    throw new CliError(`Subtask ${id} not found.`);
  }

  if (subtask.status === 'completed') {
    throw new CliError(`Subtask ${id} is already completed.`);
  }

  updateSubtask(id, (s) => ({ ...s, status: 'skipped' }));
  console.log(chalk.yellow(`\u23ED\uFE0F Skipped subtask ${id}: ${subtask.name}`));
}

export function addSubtaskCommand(subtaskArg: string): void {
  if (!planExists()) {
    throw new CliError('No plan found. Run `oops plan create` first.');
  }

  const { name, description } = parseSubtaskArg(subtaskArg);
  const plan = addSubtask(name, description);
  const added = plan.subtasks[plan.subtasks.length - 1];

  console.log(chalk.green(`\u2795 Added subtask ${added.id}: ${chalk.bold(name)}${description ? ` - ${description}` : ''}`));
}
