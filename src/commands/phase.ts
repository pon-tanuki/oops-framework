import chalk from 'chalk';
import { getCurrentPhase, transitionPhase, parsePhase } from '../core/phase-manager.js';
import { readConfig } from '../core/config-manager.js';
import { checkGate } from '../core/gate-checker.js';
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

const GATED_TRANSITIONS: [Phase, Phase][] = [
  ['RED', 'GREEN'],
  ['GREEN', 'REFACTOR'],
  ['REFACTOR', 'RED'],
];

export function showPhase(): void {
  const phase = getCurrentPhase();
  const color = PHASE_COLORS[phase];
  const emoji = PHASE_EMOJI[phase];
  console.log(`${emoji} Current phase: ${color(phase)}`);
}

export function setPhase(target: string, options: { force?: boolean; skipGate?: boolean }): void {
  const to = parsePhase(target);
  const from = getCurrentPhase();

  // Run gate check with detailed output before transition
  const config = readConfig();
  const shouldGate = config.features.autoGateCheck && !options.force && !options.skipGate;
  const isGated = GATED_TRANSITIONS.some(([f, t]) => f === from && t === to);

  if (shouldGate && isGated) {
    const result = checkGate(from, to);
    if (!result.passed) {
      console.log(chalk.red(`\n  ❌ Gate check failed: ${from} → ${to}`));
      console.log(chalk.red(`     ${result.reason}`));
      if (result.details) {
        for (const d of result.details) {
          console.log(chalk.gray(`     ${d}`));
        }
      }
      if (result.testOutput) {
        console.log(chalk.gray(`\n     Test output:\n     ${result.testOutput.split('\n').join('\n     ')}`));
      }
      console.log(chalk.gray(`\n  Use --skip-gate to bypass.`));
      return;
    }
    console.log(chalk.green(`  ✓ Gate check passed`));
  }

  transitionPhase(to, { ...options, skipGate: true });
  const fromColor = PHASE_COLORS[from];
  const toColor = PHASE_COLORS[to];
  const emoji = PHASE_EMOJI[to];
  console.log(`${emoji} Phase: ${fromColor(from)} -> ${toColor(to)}`);

  if (to === 'RED') {
    console.log(chalk.red('\n  Only test files can be modified.'));
    console.log(chalk.gray('  Write a failing test, then: oops phase green'));
  } else if (to === 'GREEN') {
    console.log(chalk.green('\n  Only implementation files can be modified.'));
    console.log(chalk.gray('  Make the test pass, then: oops phase refactor'));
  } else if (to === 'REFACTOR') {
    console.log(chalk.blue('\n  Both test and implementation files can be modified.'));
    console.log('');
    console.log(chalk.bold('  🔵 Refactoring checklist:'));
    console.log(chalk.gray('    • マジックナンバー/文字列を定数に抽出'));
    console.log(chalk.gray('    • 変数名・関数名をより明確に'));
    console.log(chalk.gray('    • 長い関数を小さく分割'));
    console.log(chalk.gray('    • コードの重複を除去'));
    console.log('');
    console.log(chalk.yellow('  ⚠️  テストは常にグリーンを維持すること'));
    console.log(chalk.gray('  ✓  完了したら: oops feature complete'));
  } else {
    console.log(chalk.gray('\n  All restrictions lifted.'));
  }
}
