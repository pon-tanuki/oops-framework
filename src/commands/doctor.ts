import chalk from 'chalk';
import { existsSync, readFileSync, accessSync, constants } from 'node:fs';
import { execSync } from 'node:child_process';
import { OOPS_DIR, STATE_FILE, CONFIG_FILE } from '../core/paths.js';
import { DEFAULT_CONFIG } from '../types.js';
import { readConfig } from '../core/config-manager.js';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

function check(name: string, fn: () => string | null): CheckResult {
  try {
    const issue = fn();
    if (issue) {
      return { name, ok: false, detail: issue };
    }
    return { name, ok: true, detail: 'OK' };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export function runDoctor(): void {
  console.log(chalk.bold('\n  OOPS Doctor\n'));

  const results: CheckResult[] = [];

  // 1. .oops/ directory
  results.push(
    check('.oops/ directory', () => {
      if (!existsSync(OOPS_DIR)) return `Directory not found: ${OOPS_DIR}. Run: oops init`;
      return null;
    }),
  );

  // 2. state.json validity
  results.push(
    check('state.json', () => {
      if (!existsSync(STATE_FILE)) return `Not found: ${STATE_FILE}. Run: oops init`;
      try {
        const raw = readFileSync(STATE_FILE, 'utf-8');
        const state = JSON.parse(raw);
        if (!state.phase) return 'Missing "phase" field';
        if (!['NONE', 'RED', 'GREEN', 'REFACTOR'].includes(state.phase)) return `Invalid phase: ${state.phase}`;
      } catch {
        return 'Invalid JSON';
      }
      return null;
    }),
  );

  // 3. config.json validity
  results.push(
    check('config.json', () => {
      if (!existsSync(CONFIG_FILE)) return `Not found: ${CONFIG_FILE}. Run: oops init`;
      try {
        const raw = readFileSync(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(raw);
        if (!config.testCommand) return 'Missing "testCommand" field';
      } catch {
        return 'Invalid JSON';
      }
      return null;
    }),
  );

  // 4. Hook scripts exist and are executable
  const hookFiles = ['.claude/hooks/oops-gate-ts.sh', '.claude/hooks/oops-post-tool-ts.sh'];
  for (const hookFile of hookFiles) {
    const label = hookFile.split('/').pop() ?? hookFile;
    results.push(
      check(`Hook: ${label}`, () => {
        if (!existsSync(hookFile)) return `Not found: ${hookFile}. Run: oops init`;
        try {
          accessSync(hookFile, constants.X_OK);
        } catch {
          return `Not executable: ${hookFile}. Run: chmod +x ${hookFile}`;
        }
        return null;
      }),
    );
  }

  // 5. .claude/settings.json hook registration
  results.push(
    check('settings.json hooks', () => {
      const settingsPath = '.claude/settings.json';
      if (!existsSync(settingsPath)) return 'Not found: .claude/settings.json. Run: oops init';
      try {
        const raw = readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        if (!settings.hooks) return 'No "hooks" section in settings.json';
        if (!settings.hooks.PreToolUse || settings.hooks.PreToolUse.length === 0)
          return 'No PreToolUse hooks registered';
        if (!settings.hooks.PostToolUse || settings.hooks.PostToolUse.length === 0)
          return 'No PostToolUse hooks registered';
      } catch {
        return 'Invalid JSON in settings.json';
      }
      return null;
    }),
  );

  // 6. Test command works
  results.push(
    check('Test command', () => {
      const config = readConfig();
      const testCmd = config.testCommand ?? DEFAULT_CONFIG.testCommand;
      try {
        execSync(testCmd, { stdio: 'pipe', timeout: config.testTimeout ?? 60000 });
      } catch (err) {
        const execErr = err as { status?: number };
        // status !== null means command ran but tests failed — that's ok, command exists
        if (execErr.status !== null && execErr.status !== undefined) {
          return null; // Command found and ran (tests may fail, but command works)
        }
        return `Test command failed to execute: ${testCmd}`;
      }
      return null;
    }),
  );

  // Display results
  let failures = 0;
  for (const r of results) {
    if (r.ok) {
      console.log(`  ${chalk.green('✓')} ${r.name}`);
    } else {
      console.log(`  ${chalk.red('✗')} ${r.name}`);
      console.log(`    ${chalk.yellow(r.detail)}`);
      failures++;
    }
  }

  console.log();
  if (failures === 0) {
    console.log(chalk.green('  All checks passed!'));
  } else {
    console.log(chalk.yellow(`  ${failures} issue${failures > 1 ? 's' : ''} found.`));
  }
  console.log();
}
