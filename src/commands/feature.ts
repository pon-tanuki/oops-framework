import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { readState, updateState } from '../core/state-manager.js';
import { showStats } from './stats.js';

export function startFeature(name: string): void {
  const state = readState();

  if (state.phase !== 'NONE') {
    console.error(chalk.red(`Error: Cannot start feature while in ${state.phase} phase.`));
    console.error(chalk.red('Run `oops feature complete` or `oops phase none` first.'));
    process.exit(1);
  }

  const sessionId = `session-${randomUUID().slice(0, 8)}`;

  updateState((s) => ({
    ...s,
    phase: 'RED',
    sessionId,
    featureName: name,
    oopsCount: 0,
    lastOops: null,
    startedAt: new Date().toISOString(),
    testResults: { passed: 0, failed: 0, total: 0 },
  }));

  console.log(chalk.bold(`\n🚀 Starting feature: ${chalk.cyan(name)}`));
  console.log(`   Session: ${sessionId}`);
  console.log(chalk.red('\n🔴 Phase: RED - Write tests first!'));
  console.log(chalk.gray('   Only test files can be modified.\n'));
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
    console.error(chalk.red('Error: No active feature to complete.'));
    process.exit(1);
  }

  const name = state.featureName;
  const oopsCount = state.oopsCount;

  updateState((s) => ({
    ...s,
    phase: 'NONE',
    sessionId: '',
    featureName: undefined,
    startedAt: undefined,
  }));

  console.log(chalk.bold(`\n✅ Feature completed: ${chalk.cyan(name)}`));
  console.log(`   Oops prevented: ${oopsCount === 0 ? chalk.green('0 🎉') : chalk.yellow(String(oopsCount))}`);

  if (oopsCount === 0) {
    console.log(chalk.green('\n   Perfect TDD cycle! No oops! 🎉\n'));
  } else {
    console.log(chalk.yellow(`\n   ${oopsCount} oops prevented by hooks.\n`));
  }
}
