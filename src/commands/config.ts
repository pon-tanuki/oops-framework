import chalk from 'chalk';
import { readConfig, writeConfig } from '../core/config-manager.js';
import { DEFAULT_CONFIG, type OopsConfig } from '../types.js';
import { CONFIG_FILE } from '../core/paths.js';

export function showConfig(): void {
  const config = readConfig();

  console.log(chalk.bold('\n  OOPS Configuration\n'));
  console.log(chalk.gray(`  File: ${CONFIG_FILE}`));

  // Show env var overrides
  const envOverrides: string[] = [];
  if (process.env.OOPS_TEST_COMMAND) envOverrides.push('OOPS_TEST_COMMAND');
  if (process.env.OOPS_DEBUG) envOverrides.push('OOPS_DEBUG');
  if (process.env.OOPS_NO_COLOR) envOverrides.push('OOPS_NO_COLOR');
  if (process.env.OOPS_DATA_DIR) envOverrides.push('OOPS_DATA_DIR');

  if (envOverrides.length > 0) {
    console.log(chalk.yellow(`  Env overrides: ${envOverrides.join(', ')}`));
  }
  console.log();

  console.log(`  testCommand:          ${chalk.cyan(config.testCommand)}`);
  console.log(`  testFilePattern:      ${chalk.cyan(config.testFilePattern)}`);
  console.log(`  debug:                ${config.debug ? chalk.yellow('true') : chalk.gray('false')}`);
  console.log(`  autoGateCheck:        ${config.features.autoGateCheck ? chalk.green('true') : chalk.gray('false')}`);
  console.log(`  postToolUseTestRunner: ${config.features.postToolUseTestRunner ? chalk.green('true') : chalk.gray('false')}`);
  console.log();
}

export function setConfig(key: string, value: string): void {
  const config = readConfig();

  switch (key) {
    case 'testCommand':
      config.testCommand = value;
      break;
    case 'testFilePattern':
      config.testFilePattern = value;
      break;
    case 'debug':
      config.debug = parseBool(value, key);
      break;
    case 'autoGateCheck':
      config.features.autoGateCheck = parseBool(value, key);
      break;
    case 'postToolUseTestRunner':
      config.features.postToolUseTestRunner = parseBool(value, key);
      break;
    default:
      console.error(chalk.red(`Error: Unknown config key "${key}".`));
      console.error(chalk.gray('  Available: testCommand, testFilePattern, debug, autoGateCheck, postToolUseTestRunner'));
      process.exit(1);
  }

  writeConfig(config);
  console.log(chalk.green(`  ${key} = ${value}`));
}

export function resetConfig(): void {
  writeConfig({ ...DEFAULT_CONFIG });
  console.log(chalk.green('  Configuration reset to defaults.'));
}

function parseBool(value: string, key: string): boolean {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  console.error(chalk.red(`Error: "${key}" must be true/false (got "${value}").`));
  process.exit(1);
}
