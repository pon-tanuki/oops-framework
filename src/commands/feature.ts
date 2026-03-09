import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { readState, updateState } from '../core/state-manager.js';
import { appendSession } from '../core/history-manager.js';
import { planExists, readPlan, writePlan, getNextSubtask, isAllCompleted } from '../core/plan-manager.js';
import { showStats } from './stats.js';
import { CliError } from '../core/errors.js';

export function startFeature(name: string, options: { noTdd?: boolean } = {}): void {
  const state = readState();

  if (state.phase !== 'NONE') {
    throw new CliError(
      `Cannot start feature while in ${state.phase} phase.\nRun \`oops feature complete\` or \`oops phase none\` first.`
    );
  }

  const sessionId = `session-${randomUUID().slice(0, 8)}`;
  const noTdd = options.noTdd ?? false;

  updateState((s) => ({
    ...s,
    phase: noTdd ? 'NONE' : 'RED',
    sessionId,
    featureName: name,
    oopsCount: 0,
    lastOops: null,
    startedAt: new Date().toISOString(),
    testResults: { passed: 0, failed: 0, total: 0 },
    noTdd,
  }));

  if (noTdd) {
    console.log(chalk.bold(`\n🚀 Starting feature (no-TDD): ${chalk.cyan(name)}`));
    console.log(`   Session: ${sessionId}`);
    console.log(chalk.gray('\n⚪ Phase: NONE - No TDD restrictions.'));
    console.log(chalk.gray('   All file types can be modified freely.'));
    console.log(chalk.gray('   Complete with: oops feature complete\n'));
  } else {
    console.log(chalk.bold(`\n🚀 Starting feature: ${chalk.cyan(name)}`));
    console.log(`   Session: ${sessionId}`);
    console.log(chalk.red('\n🔴 Phase: RED - Write tests first!'));
    console.log(chalk.gray('   Only test files can be modified.\n'));
  }
}

export function showFeatureStatus(): void {
  const state = readState();

  if (!state.featureName) {
    console.log(chalk.gray('No active feature. Run `oops feature start <name>` to begin.'));
    return;
  }

  showStats();
}

export function completeFeature(): void {
  const state = readState();

  if (!state.featureName) {
    throw new CliError('No active feature to complete.');
  }

  const name = state.featureName;
  const oopsCount = state.oopsCount;

  // Save session to history before clearing state
  appendSession({
    featureName: name,
    sessionId: state.sessionId,
    startedAt: state.startedAt ?? state.metadata.created,
    completedAt: new Date().toISOString(),
    oopsCount,
    testResults: { ...state.testResults },
  });

  updateState((s) => ({
    ...s,
    phase: 'NONE',
    sessionId: '',
    featureName: undefined,
    startedAt: undefined,
    noTdd: undefined,
  }));

  // Auto-sync plan subtask if plan is active
  if (planExists()) {
    const plan = readPlan();
    const inProgressIdx = plan.subtasks.findIndex((s) => s.status === 'in_progress');
    if (inProgressIdx !== -1) {
      const subtask = plan.subtasks[inProgressIdx];
      plan.subtasks[inProgressIdx] = {
        ...subtask,
        status: 'completed',
        oopsCount: oopsCount,
        completedAt: new Date().toISOString(),
      };
      plan.currentSubtask = null;
      writePlan(plan);

      console.log(chalk.green(`\n✅ Plan subtask completed: ${chalk.cyan(subtask.name)}`));
      const updatedPlan = readPlan();
      const next = getNextSubtask(updatedPlan);
      if (next) {
        console.log(chalk.gray(`   Next: ${next.id}. ${next.name}`));
        console.log(chalk.gray(`   Run: oops plan next`));
      } else if (isAllCompleted(updatedPlan)) {
        console.log(chalk.green(`   All subtasks done! Run: oops plan complete`));
      }
    }
  }

  console.log(chalk.bold(`\n✅ Feature completed: ${chalk.cyan(name)}`));
  console.log(`   Oops prevented: ${oopsCount === 0 ? chalk.green('0 🎉') : chalk.yellow(String(oopsCount))}`);

  if (oopsCount === 0) {
    console.log(chalk.green('\n   Perfect TDD cycle! No oops! 🎉\n'));
  } else {
    console.log(chalk.yellow(`\n   ${oopsCount} oops prevented by hooks.\n`));
  }
}
