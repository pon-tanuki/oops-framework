import chalk from 'chalk';
import { readState } from '../core/state-manager.js';
import { checkGate } from '../core/gate-checker.js';
import type { Phase } from '../types.js';

const GATE_MAP: Record<string, [Phase, Phase]> = {
  'red-to-green': ['RED', 'GREEN'],
  'green-to-refactor': ['GREEN', 'REFACTOR'],
  'refactor-done': ['REFACTOR', 'RED'],
};

export function runGateCheck(gateName?: string): void {
  const state = readState();

  // Auto-detect gate from current phase
  if (!gateName) {
    if (state.phase === 'RED') gateName = 'red-to-green';
    else if (state.phase === 'GREEN') gateName = 'green-to-refactor';
    else if (state.phase === 'REFACTOR') gateName = 'refactor-done';
    else {
      console.error(chalk.red('Error: No gate to check in NONE phase.'));
      process.exit(1);
    }
  }

  const gate = GATE_MAP[gateName];
  if (!gate) {
    console.error(chalk.red(`Error: Unknown gate "${gateName}".`));
    console.error(chalk.gray(`  Available: ${Object.keys(GATE_MAP).join(', ')}`));
    process.exit(1);
  }

  const [from, to] = gate;

  if (state.phase !== from) {
    console.error(chalk.red(`Error: Gate "${gateName}" requires ${from} phase, but current phase is ${state.phase}.`));
    process.exit(1);
  }

  console.log(chalk.bold(`\n🚦 Checking gate: ${from} -> ${to}`));
  console.log();

  const result = checkGate(from, to);

  if (result.details) {
    for (const detail of result.details) {
      const icon = detail.startsWith('  ') ? '  ' : (result.passed ? chalk.green('✓') : chalk.red('✗'));
      const text = detail.startsWith('  ') ? chalk.gray(detail) : detail;
      console.log(`  ${icon} ${text}`);
    }
    console.log();
  }

  if (result.testOutput) {
    console.log(chalk.bold('  🧪 Test Output:'));
    for (const line of result.testOutput.split('\n')) {
      console.log(chalk.gray(`     ${line}`));
    }
    console.log();
  }

  if (result.passed) {
    console.log(chalk.green(`✅ ${result.reason}`));
    console.log(chalk.gray(`\n  Run: oops phase ${to.toLowerCase()}\n`));
  } else {
    console.log(chalk.red(`❌ ${result.reason}`));
    console.log();
    process.exit(1);
  }
}
