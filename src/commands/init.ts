import chalk from 'chalk';
import { existsSync, mkdirSync } from 'node:fs';
import { stateExists, writeState, readState } from '../core/state-manager.js';
import { configExists, writeConfig, readConfig } from '../core/config-manager.js';
import { DEFAULT_STATE, DEFAULT_CONFIG } from '../types.js';

export function initOops(options: { force?: boolean } = {}): void {
  console.log(chalk.bold('\n🎉 Initializing OOPS Framework'));
  console.log(chalk.gray('   "No more \'Oops, I broke it again!\'"'));
  console.log();

  // 1. Create .oops/ directory
  if (!existsSync('.oops')) {
    mkdirSync('.oops', { recursive: true });
    console.log(chalk.green('  ✓ Created .oops/ directory'));
  } else {
    console.log(chalk.gray('  ✓ .oops/ directory exists'));
  }

  // 2. Create state.json
  if (!stateExists() || options.force) {
    writeState({ ...DEFAULT_STATE, metadata: { ...DEFAULT_STATE.metadata, created: new Date().toISOString() } });
    console.log(chalk.green('  ✓ Created .oops/state.json'));
  } else {
    console.log(chalk.gray('  ✓ .oops/state.json exists'));
  }

  // 3. Create config.json
  if (!configExists() || options.force) {
    writeConfig({ ...DEFAULT_CONFIG });
    console.log(chalk.green('  ✓ Created .oops/config.json'));
  } else {
    console.log(chalk.gray('  ✓ .oops/config.json exists'));
  }

  // 4. Check hooks
  if (existsSync('.claude/hooks/oops-gate.sh')) {
    console.log(chalk.green('  ✓ Hook script exists: .claude/hooks/oops-gate.sh'));
  } else {
    console.log(chalk.yellow('  ⚠ Hook script not found: .claude/hooks/oops-gate.sh'));
  }

  // 5. Check settings.json
  if (existsSync('.claude/settings.json')) {
    console.log(chalk.green('  ✓ .claude/settings.json exists'));
  } else {
    console.log(chalk.yellow('  ⚠ .claude/settings.json not found'));
  }

  console.log(chalk.bold.green('\n✅ OOPS Framework ready!'));
  console.log(chalk.gray('   Run: oops feature start <name>\n'));
}
