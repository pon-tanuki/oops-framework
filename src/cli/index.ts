#!/usr/bin/env npx tsx
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { showPhase, setPhase } from '../commands/phase.js';
import { startFeature, showFeatureStatus, completeFeature } from '../commands/feature.js';
import { runGateCheck } from '../commands/gate.js';
import { showStats } from '../commands/stats.js';
import { initOops } from '../commands/init.js';
import {
  createPlanCommand,
  showPlan,
  nextSubtask,
  doneSubtask,
  completePlan,
  skipSubtask,
  addSubtaskCommand,
} from '../commands/plan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const PACKAGE_ROOT = join(__dirname, '..', '..');

const program = new Command();

program
  .name('oops')
  .description('OOPS Framework - No more "Oops, I broke it again!"')
  .version('0.4.0');

// oops init
program
  .command('init')
  .description('Initialize OOPS Framework')
  .option('--force', 'Overwrite existing files')
  .action((options) => initOops(options));

// oops phase [target]
program
  .command('phase [target]')
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
  .description('Run gate check (auto-detects or specify: red-to-green, green-to-refactor)')
  .action((name) => runGateCheck(name));

// oops stats
program
  .command('stats')
  .description('Show OOPS statistics')
  .action(() => showStats());

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

program.parse();
