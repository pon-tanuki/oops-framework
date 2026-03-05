import chalk from 'chalk';
import { readState } from '../core/state-manager.js';
import { checkGate } from '../core/gate-checker.js';
import type { Phase } from '../types.js';
import { CliError } from '../core/errors.js';

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
      throw new CliError('No gate to check in NONE phase.');
    }
  }

  const gate = GATE_MAP[gateName];
  if (!gate) {
    throw new CliError(`Unknown gate "${gateName}".\n  Available: ${Object.keys(GATE_MAP).join(', ')}`);
  }

  const [from, to] = gate;

  if (state.phase !== from) {
    throw new CliError(`Gate "${gateName}" requires ${from} phase, but current phase is ${state.phase}.`);
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
    throw new CliError(result.reason);
  }
}
