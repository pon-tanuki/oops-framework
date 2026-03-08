#!/usr/bin/env npx tsx
/**
 * OOPS Framework - PreToolUse Hook (TypeScript)
 * Enforces TDD phases by controlling file access.
 *
 * Claude Code passes tool request as JSON via stdin.
 * Output JSON with permissionDecision to stdout.
 */

import { readFileSync, existsSync } from 'node:fs';
import { type HookOutput, type Phase, WRITE_TOOLS, isTestFile, isExcludedFile } from '../types.js';
import { readState, updateState } from '../core/state-manager.js';
import { readConfig } from '../core/config-manager.js';
import { STATE_FILE } from '../core/paths.js';

// --- Helpers ---

function output(decision: 'allow' | 'deny', reason?: string): void {
  const result: HookOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      ...(reason ? { permissionDecisionReason: reason } : {}),
    },
  };
  process.stdout.write(JSON.stringify(result));
}

function deny(reason: string): never {
  output('deny', reason);
  process.exit(0);
}

function allow(reason?: string): never {
  output('allow', reason);
  process.exit(0);
}

// --- Oops Counter ---

function incrementOops(reason: string, filePath: string): void {
  try {
    updateState((state) => ({
      ...state,
      oopsCount: state.oopsCount + 1,
      lastOops: new Date().toISOString(),
    }));
    const state = readState();
    process.stderr.write(`🚫 Oops #${state.oopsCount}: ${reason}\n   File: ${filePath}\n`);
  } catch {
    // Lock failure should not prevent the deny response
    process.stderr.write(`🚫 Oops: ${reason}\n   File: ${filePath}\n`);
  }
}

// --- Main ---

function main(): void {
  // Read stdin
  let rawInput = '';
  try {
    rawInput = readFileSync(0, 'utf-8');
  } catch {
    deny('Failed to read stdin');
  }

  let input: { tool_name?: string; tool_input?: { file_path?: string } };
  try {
    input = JSON.parse(rawInput);
  } catch {
    deny('Failed to parse stdin JSON');
  }

  const toolName = input.tool_name ?? '';
  const filePath = input.tool_input?.file_path ?? '';

  // Only intercept write tools
  if (!WRITE_TOOLS.has(toolName)) {
    allow();
  }

  // Check state file
  if (!existsSync(STATE_FILE)) {
    allow('OOPS not initialized');
  }

  // Read phase
  let phase: Phase;
  try {
    const state = readState();
    phase = state.phase ?? 'NONE';
  } catch {
    deny('Failed to read state.json');
  }

  // NONE phase - unrestricted
  if (phase === 'NONE') {
    allow('Phase: NONE (unrestricted)');
  }

  // Excluded files are always allowed (config files, docs, etc.)
  const config = readConfig();
  if (isExcludedFile(filePath, config.excludePatterns ?? [])) {
    allow(`Excluded file: ${filePath}`);
  }

  const testFile = isTestFile(filePath);

  // Phase rules
  switch (phase) {
    case 'RED':
      if (testFile) {
        allow(`Phase: RED - Test file allowed: ${filePath}`);
      } else {
        incrementOops('Attempted to modify implementation during RED phase', filePath);
        process.stderr.write(
          `\n   現在: RED phase（テストファイルのみ編集可）\n` +
          `   次のステップ:\n` +
          `     1. テストファイルを作成/編集して失敗するテストを書く\n` +
          `     2. テストが失敗することを確認\n` +
          `     3. oops phase green でGREENフェーズへ移行\n`,
        );
        deny(`🚫 Phase: RED - Only test files allowed. Cannot modify: ${filePath}`);
      }
      break;

    case 'GREEN':
      if (!testFile) {
        allow(`Phase: GREEN - Implementation file allowed: ${filePath}`);
      } else {
        incrementOops('Attempted to modify tests during GREEN phase', filePath);
        process.stderr.write(
          `\n   現在: GREEN phase（実装ファイルのみ編集可）\n` +
          `   次のステップ:\n` +
          `     1. テストが通る最小限の実装を書く\n` +
          `     2. テストが全て通ることを確認\n` +
          `     3. oops phase refactor でREFACTORフェーズへ移行\n`,
        );
        deny(`🚫 Phase: GREEN - Only implementation files allowed. Cannot modify: ${filePath}`);
      }
      break;

    case 'REFACTOR':
      if (testFile) {
        process.stderr.write(`⚠️  Phase: REFACTOR - Modifying test file: ${filePath}\n`);
        allow(`Phase: REFACTOR - Test modification allowed (with warning): ${filePath}`);
      } else {
        allow(`Phase: REFACTOR - Implementation file allowed: ${filePath}`);
      }
      break;

    default:
      deny(`Unknown phase: ${phase}. Blocking for safety.`);
  }
}

// Fail-safe: catch all errors and deny
try {
  main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Hook error: ${msg}. Defaulting to DENY.\n`);
  output('deny', `Hook error: ${msg}. Blocked for safety.`);
  process.exit(0);
}
