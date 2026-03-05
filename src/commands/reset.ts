import chalk from 'chalk';
import { readState, writeState } from '../core/state-manager.js';
import { DEFAULT_STATE } from '../types.js';
import { planExists, deletePlan } from '../core/plan-manager.js';
import { releaseLock } from '../core/state-manager.js';

export function resetOops(options: { hard?: boolean } = {}): void {
  const state = readState();

  // Release any stale lock
  releaseLock();

  if (options.hard) {
    // Hard reset: wipe everything back to defaults
    writeState({
      ...DEFAULT_STATE,
      metadata: { ...DEFAULT_STATE.metadata, created: state.metadata.created },
    });

    if (planExists()) {
      deletePlan();
      console.log(chalk.yellow('  Deleted active plan.'));
    }

    console.log(chalk.bold('\n🔄 Hard reset complete.'));
    console.log(chalk.gray('  Phase: NONE, oops count: 0, plan: cleared\n'));
    return;
  }

  // Soft reset: just return to NONE phase, preserve stats
  const prevPhase = state.phase;

  if (prevPhase === 'NONE') {
    console.log(chalk.gray('Already in NONE phase. Use --hard to wipe all state.'));
    return;
  }

  writeState({
    ...state,
    phase: 'NONE',
    sessionId: '',
    featureName: undefined,
    startedAt: undefined,
  });

  console.log(chalk.bold(`\n🔄 Reset: ${chalk.red(prevPhase)} → ${chalk.gray('NONE')}`));
  console.log(chalk.gray(`  Oops count preserved: ${state.oopsCount}`));
  console.log(chalk.gray('  Use --hard to wipe all state.\n'));
}
