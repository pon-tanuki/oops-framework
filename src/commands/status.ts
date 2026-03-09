import chalk from 'chalk';
import { readState } from '../core/state-manager.js';
import { planExists, readPlan } from '../core/plan-manager.js';
import type { Phase } from '../types.js';

const PHASE_COLORS: Record<Phase, (s: string) => string> = {
  NONE: chalk.gray,
  RED: chalk.red,
  GREEN: chalk.green,
  REFACTOR: chalk.blue,
};

const PHASE_EMOJI: Record<Phase, string> = {
  NONE: '⚪',
  RED: '🔴',
  GREEN: '🟢',
  REFACTOR: '🔵',
};

export function showStatus(): void {
  const state = readState();
  const phaseColor = PHASE_COLORS[state.phase];
  const emoji = PHASE_EMOJI[state.phase];

  console.log(chalk.bold('\n📊 OOPS Status'));
  console.log('─'.repeat(35));

  // Phase
  const noTddLabel = state.noTdd ? chalk.gray(' (no-TDD)') : '';
  console.log(`  Phase:   ${emoji} ${phaseColor(state.phase)}${noTddLabel}`);

  // Feature
  if (state.featureName) {
    console.log(`  Feature: ${chalk.cyan(state.featureName)}`);
    if (state.startedAt) {
      const elapsed = getElapsed(state.startedAt);
      console.log(`  Started: ${chalk.gray(elapsed + ' ago')}`);
    }
  }

  // Oops
  console.log(`  Oops:    ${state.oopsCount === 0 ? chalk.green('0') : chalk.yellow(String(state.oopsCount))}`);

  // Test results
  const { passed, failed, total } = state.testResults;
  if (total > 0) {
    console.log(`  Tests:   ${chalk.green(String(passed))} passed, ${chalk.red(String(failed))} failed (${total} total)`);
  }

  // Plan
  if (planExists()) {
    const plan = readPlan();
    const done = plan.subtasks.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
    const totalSubs = plan.subtasks.length;
    const current = plan.subtasks.find((s) => s.status === 'in_progress');

    console.log();
    console.log(chalk.bold(`  📋 Plan: ${chalk.cyan(plan.goal)}`));
    console.log(`  Progress: ${done}/${totalSubs} subtasks`);
    if (current) {
      console.log(`  Current:  ${chalk.yellow(current.name)}`);
    }
  }

  // Hints
  console.log();
  if (state.phase === 'NONE' && !state.featureName) {
    console.log(chalk.gray('  Run: oops feature start <name>'));
  } else if (state.phase === 'RED') {
    console.log(chalk.gray('  Write tests, then: oops phase green'));
  } else if (state.phase === 'GREEN') {
    console.log(chalk.gray('  Implement code, then: oops phase refactor'));
  } else if (state.phase === 'REFACTOR') {
    console.log(chalk.gray('  Refactor, then: oops feature complete'));
  }
  console.log();
}

export function getElapsed(isoDate: string): string {
  return formatDuration(Date.now() - new Date(isoDate).getTime());
}

export function getElapsedBetween(startIso: string, endIso: string): string {
  return formatDuration(new Date(endIso).getTime() - new Date(startIso).getTime());
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
