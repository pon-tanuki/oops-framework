import chalk from 'chalk';
import { getCurrentPhase, transitionPhase, parsePhase } from '../core/phase-manager.js';
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

export function showPhase(): void {
  const phase = getCurrentPhase();
  const color = PHASE_COLORS[phase];
  const emoji = PHASE_EMOJI[phase];
  console.log(`${emoji} Current phase: ${color(phase)}`);
}

export function setPhase(target: string, options: { force?: boolean; skipGate?: boolean }): void {
  const to = parsePhase(target);
  const from = getCurrentPhase();

  transitionPhase(to, options);
  const fromColor = PHASE_COLORS[from];
  const toColor = PHASE_COLORS[to];
  const emoji = PHASE_EMOJI[to];
  console.log(`${emoji} Phase: ${fromColor(from)} -> ${toColor(to)}`);

  if (to === 'RED') {
    console.log(chalk.red('\n  Only test files can be modified.'));
  } else if (to === 'GREEN') {
    console.log(chalk.green('\n  Only implementation files can be modified.'));
  } else if (to === 'REFACTOR') {
    console.log(chalk.blue('\n  Both test and implementation files can be modified.'));
  } else {
    console.log(chalk.gray('\n  All restrictions lifted.'));
  }
}
