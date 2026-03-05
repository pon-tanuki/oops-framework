#!/usr/bin/env npx tsx
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import { showPhase, setPhase } from '../commands/phase.js';
import { startFeature, showFeatureStatus, completeFeature } from '../commands/feature.js';
import { runGateCheck } from '../commands/gate.js';
import { showStats } from '../commands/stats.js';
import { initOops } from '../commands/init.js';
import { showConfig, setConfig, resetConfig } from '../commands/config.js';
import {
  createPlanCommand,
  showPlan,
  nextSubtask,
  doneSubtask,
  completePlan,
  skipSubtask,
  addSubtaskCommand,
} from '../commands/plan.js';
import { setLogLevel, setColorsEnabled, setQuietMode } from '../core/logger.js';
import { CliError } from '../core/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const PACKAGE_ROOT = join(__dirname, '..', '..');

const program = new Command();

program
  .name('oops')
  .description('OOPS Framework - No more "Oops, I broke it again!"')
  .version('0.6.0')
  .option('--debug', 'Enable debug output')
  .option('--no-color', 'Disable colored output')
  .option('--quiet', 'Suppress non-error output')
  .hook('preAction', (_thisCommand, _actionCommand) => {
    const opts = program.opts();
    if (opts.debug) {
      setLogLevel('debug');
    }
    if (opts.color === false || process.env.OOPS_NO_COLOR === 'true' || process.env.OOPS_NO_COLOR === '1' || process.env.NO_COLOR) {
      setColorsEnabled(false);
      chalk.level = 0;
    }
    if (opts.quiet) {
      setQuietMode(true);
    }
  });

// oops init
program
  .command('init')
  .description('Initialize OOPS Framework in current project')
  .option('--force', 'Overwrite existing files')
  .action((options) => initOops(options));

// oops phase [target]
program
  .command('phase [target]')
  .alias('p')
  .description('Show or set the current TDD phase')
  .option('--force', 'Force phase transition')
  .option('--skip-gate', 'Skip gate check')
  .action((target, options) => {
    if (target) {
      setPhase(target, options);
    } else {
      showPhase();
    }
  });

// oops feature <action> [name]
const feature = program
  .command('feature')
  .alias('f')
  .description('Manage feature development sessions');

feature
  .command('start <name>')
  .description('Start a new feature (begins RED phase)')
  .action((name) => startFeature(name));

feature
  .command('status')
  .description('Show current feature status')
  .action(() => showFeatureStatus());

feature
  .command('complete')
  .description('Complete the current feature')
  .action(() => completeFeature());

// oops gate [name]
program
  .command('gate [name]')
  .alias('g')
  .description('Run gate check (auto-detects or specify: red-to-green, green-to-refactor)')
  .action((name) => runGateCheck(name));

// oops stats
program
  .command('stats')
  .alias('s')
  .description('Show OOPS statistics')
  .action(() => showStats());

// oops config <action>
const config = program
  .command('config')
  .alias('c')
  .description('View or modify OOPS configuration');

config
  .command('show')
  .description('Display current configuration (with env var overrides)')
  .action(() => showConfig());

config
  .command('set <key> <value>')
  .description('Set a configuration value (e.g., testCommand, debug, autoGateCheck)')
  .action((key, value) => setConfig(key, value));

config
  .command('reset')
  .description('Reset configuration to defaults')
  .action(() => resetConfig());

// oops plan <action>
const plan = program
  .command('plan')
  .description('Manage task decomposition plans');

plan
  .command('create')
  .description('Create a new plan with subtasks')
  .requiredOption('--goal <goal>', 'The goal of the plan')
  .option('--subtask <subtasks...>', 'Subtasks in "name: description" format')
  .action((options) => createPlanCommand(options.goal, options.subtask || []));

plan
  .command('show')
  .description('Show the current plan')
  .action(() => showPlan());

plan
  .command('next')
  .description('Start the next pending subtask')
  .action(() => nextSubtask());

plan
  .command('done')
  .description('Complete the current subtask')
  .action(() => doneSubtask());

plan
  .command('complete')
  .description('Mark the entire plan as completed')
  .action(() => completePlan());

plan
  .command('skip <id>')
  .description('Skip a subtask by ID')
  .action((id) => skipSubtask(id));

plan
  .command('add')
  .description('Add a subtask to the existing plan')
  .requiredOption('--subtask <subtask>', 'Subtask in "name: description" format')
  .action((options) => addSubtaskCommand(options.subtask));

// oops hook-pre (internal: called by Claude Code PreToolUse hook)
program
  .command('hook-pre')
  .description('Run PreToolUse hook (internal)')
  .action(() => {
    const hookScript = join(PACKAGE_ROOT, 'src', 'hooks', 'pre-tool-use.ts');
    const stdin = readFileSync(0, 'utf-8');
    try {
      const result = execFileSync('npx', ['tsx', hookScript], {
        input: stdin,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      process.stdout.write(result);
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string };
      if (execErr.stdout) process.stdout.write(execErr.stdout);
      if (execErr.stderr) process.stderr.write(execErr.stderr);
    }
  });

// oops hook-post (internal: called by Claude Code PostToolUse hook)
program
  .command('hook-post')
  .description('Run PostToolUse hook (internal)')
  .action(() => {
    const hookScript = join(PACKAGE_ROOT, 'src', 'hooks', 'post-tool-use.ts');
    const stdin = readFileSync(0, 'utf-8');
    try {
      execFileSync('npx', ['tsx', hookScript], {
        input: stdin,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    } catch (err: unknown) {
      const execErr = err as { stderr?: string };
      if (execErr.stderr) process.stderr.write(execErr.stderr);
    }
  });

// Commander catches errors in action handlers and re-throws them.
// We catch CliError to display clean error messages without stack traces.
program.exitOverride(); // Prevent commander from calling process.exit directly

try {
  program.parse();
} catch (err: unknown) {
  if (err instanceof CliError) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(err.exitCode);
  }
  // Commander throws CommanderError for --help, --version, etc.
  // Re-throw unexpected errors.
  const commanderErr = err as { code?: string; exitCode?: number };
  if (commanderErr.code === 'commander.helpDisplayed' || commanderErr.code === 'commander.version') {
    process.exit(0);
  }
  if (commanderErr.exitCode !== undefined) {
    process.exit(commanderErr.exitCode);
  }
  throw err;
}
