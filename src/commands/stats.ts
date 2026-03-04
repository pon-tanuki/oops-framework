import chalk from 'chalk';
import { readState } from '../core/state-manager.js';
import type { Phase } from '../types.js';

const PHASE_COLORS: Record<Phase, (s: string) => string> = {
  NONE: chalk.gray,
  RED: chalk.red,
  GREEN: chalk.green,
  REFACTOR: chalk.blue,
};

export function showStats(): void {
  const state = readState();
  const phaseColor = PHASE_COLORS[state.phase];

  console.log(chalk.bold('\nOOPS Framework Statistics'));
  console.log('='.repeat(35));
  console.log();
  console.log(`  Phase:     ${phaseColor(state.phase)}`);

  if (state.featureName) {
    console.log(`  Feature:   ${chalk.cyan(state.featureName)}`);
  }

  if (state.startedAt) {
    console.log(`  Started:   ${state.startedAt}`);
  }

  console.log();
  console.log(`  Oops Count: ${state.oopsCount > 0 ? chalk.yellow(String(state.oopsCount)) : chalk.green('0')}`);

  if (state.lastOops) {
    console.log(`  Last Oops:  ${state.lastOops}`);
  }

  const { passed, failed, total } = state.testResults;
  if (total > 0) {
    console.log();
    console.log('  Test Results:');
    console.log(`    Passed: ${chalk.green(String(passed))} / Failed: ${chalk.red(String(failed))} / Total: ${total}`);
  }

  console.log();
}
