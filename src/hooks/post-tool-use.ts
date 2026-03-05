#!/usr/bin/env npx tsx
/**
 * OOPS Framework - PostToolUse Hook (TypeScript)
 * Auto-runs tests after file modifications to provide immediate feedback.
 *
 * Claude Code passes tool result as JSON via stdin.
 * Output JSON to stdout (currently no decision needed for PostToolUse).
 * Feedback is written to stderr (visible to Claude).
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { WRITE_TOOLS, isTestFile } from '../types.js';
import { readConfig } from '../core/config-manager.js';
import { readState } from '../core/state-manager.js';
import { extractTestSummary } from '../core/gate-checker.js';
import { STATE_FILE, CONFIG_FILE } from '../core/paths.js';

// --- Main ---

function main(): void {
  // Read stdin
  let rawInput = '';
  try {
    rawInput = readFileSync(0, 'utf-8');
  } catch {
    return; // Silently exit if no stdin
  }

  let input: { tool_name?: string; tool_input?: { file_path?: string } };
  try {
    input = JSON.parse(rawInput);
  } catch {
    return; // Silently exit on parse error
  }

  const toolName = input.tool_name ?? '';
  const filePath = input.tool_input?.file_path ?? '';

  // Only trigger on write tools
  if (!WRITE_TOOLS.has(toolName)) return;

  // Check OOPS is initialized
  if (!existsSync(STATE_FILE) || !existsSync(CONFIG_FILE)) return;

  // Check feature flag
  const config = readConfig();
  if (!config.features.postToolUseTestRunner) return;

  // Check we're in an active phase
  const state = readState();
  if (state.phase === 'NONE') return;

  // Determine what kind of file was modified
  const testFile = isTestFile(filePath);
  const phase = state.phase;

  // Run tests based on phase context
  let shouldRunTests = false;
  let context = '';

  switch (phase) {
    case 'RED':
      // In RED phase, run tests after test file changes (expect failures)
      if (testFile) {
        shouldRunTests = true;
        context = 'RED phase - expecting test failures';
      }
      break;

    case 'GREEN':
      // In GREEN phase, run tests after impl changes (working toward passing)
      if (!testFile) {
        shouldRunTests = true;
        context = 'GREEN phase - checking if tests pass';
      }
      break;

    case 'REFACTOR':
      // In REFACTOR phase, always run tests (must stay passing)
      shouldRunTests = true;
      context = 'REFACTOR phase - tests must stay passing';
      break;
  }

  if (!shouldRunTests) return;

  // Run tests
  process.stderr.write(`\n🧪 Auto-running tests (${context})...\n`);

  try {
    const output = execSync(config.testCommand, {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Tests passed
    const summary = extractTestSummary(output);
    switch (phase) {
      case 'RED':
        process.stderr.write(`⚠️  Tests PASSED in RED phase - tests should be failing!\n`);
        process.stderr.write(`   ${summary}\n`);
        process.stderr.write(`   Write tests that fail for the feature you want to implement.\n\n`);
        break;
      case 'GREEN':
        process.stderr.write(`✅ Tests PASSED! Ready to transition to REFACTOR.\n`);
        process.stderr.write(`   ${summary}\n`);
        process.stderr.write(`   Run: oops phase refactor\n\n`);
        break;
      case 'REFACTOR':
        process.stderr.write(`✅ Tests still passing. Safe to continue refactoring.\n`);
        process.stderr.write(`   ${summary}\n\n`);
        break;
    }
  } catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string; stderr?: string };
    const output = (execErr.stdout ?? '') + (execErr.stderr ?? '');
    const summary = extractTestSummary(output);

    switch (phase) {
      case 'RED':
        process.stderr.write(`✅ Tests FAILING as expected in RED phase.\n`);
        process.stderr.write(`   ${summary}\n`);
        process.stderr.write(`   Ready to transition to GREEN: oops phase green\n\n`);
        break;
      case 'GREEN':
        process.stderr.write(`🔧 Tests still failing. Keep implementing.\n`);
        process.stderr.write(`   ${summary}\n\n`);
        break;
      case 'REFACTOR':
        process.stderr.write(`🚫 Tests BROKE during refactoring! Undo last change.\n`);
        process.stderr.write(`   ${summary}\n`);
        process.stderr.write(`   Refactoring must not change behavior.\n\n`);
        break;
    }
  }
}

// Fail-safe: catch all errors and silently exit
// PostToolUse hooks should never block the workflow
try {
  main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`PostToolUse hook error: ${msg}\n`);
}
