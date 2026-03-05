#!/usr/bin/env npx tsx
import { Command } from 'commander';
import { showPhase, setPhase } from '../commands/phase.js';
import { startFeature, showFeatureStatus, completeFeature } from '../commands/feature.js';
import { runGateCheck } from '../commands/gate.js';
import { showStats } from '../commands/stats.js';
import { initOops } from '../commands/init.js';

const program = new Command();

program
  .name('oops')
  .description('OOPS Framework - No more "Oops, I broke it again!"')
  .version('0.1.0');

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

program.parse();
