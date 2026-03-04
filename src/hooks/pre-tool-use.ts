#!/usr/bin/env npx tsx
/**
 * OOPS Framework - PreToolUse Hook (TypeScript)
 * Enforces TDD phases by controlling file access.
 *
 * Claude Code passes tool request as JSON via stdin.
 * Output JSON with permissionDecision to stdout.
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// --- Types ---

interface HookInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
    [key: string]: unknown;
  };
}

interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    permissionDecision: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
  };
}

type Phase = 'NONE' | 'RED' | 'GREEN' | 'REFACTOR';

interface OopsState {
  phase: Phase;
  oopsCount: number;
  lastOops: string | null;
  metadata: {
    lastUpdate: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// --- Config ---

const STATE_FILE = '.oops/state.json';
const LOCK_FILE = '.oops/state.lock';
const LOCK_TIMEOUT_MS = 3000;
const STALE_LOCK_AGE_S = 5;
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);
const TEST_FILE_PATTERN = /\.test\.|\.spec\.|\/test\/|\/tests\/|\/spec\/|\/__tests__\//;

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

function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/^\.\//, '');
  return TEST_FILE_PATTERN.test(normalized);
}

// --- Lock ---

function acquireLock(): void {
  const start = Date.now();
  while (existsSync(LOCK_FILE) && Date.now() - start < LOCK_TIMEOUT_MS) {
    const stat = statSync(LOCK_FILE, { throwIfNoEntry: false });
    if (stat) {
      const ageS = (Date.now() - stat.mtimeMs) / 1000;
      if (ageS > STALE_LOCK_AGE_S) {
        unlinkSync(LOCK_FILE);
        break;
      }
    }
    // Brief busy wait
    const waitUntil = Date.now() + 50;
    while (Date.now() < waitUntil) { /* spin */ }
  }
  if (existsSync(LOCK_FILE)) {
    deny('Concurrent operation detected. Lock timeout.');
  }
  writeFileSync(LOCK_FILE, `${process.pid}:${Date.now()}`);
}

function releaseLock(): void {
  if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
}

// --- Oops Counter ---

function incrementOops(reason: string, filePath: string): void {
  acquireLock();
  try {
    const state: OopsState = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    state.oopsCount += 1;
    state.lastOops = new Date().toISOString();
    state.metadata.lastUpdate = new Date().toISOString();

    const tempFile = join(tmpdir(), `oops-state-${process.pid}.json`);
    writeFileSync(tempFile, JSON.stringify(state, null, 2) + '\n');
    const content = readFileSync(tempFile, 'utf-8');
    writeFileSync(STATE_FILE, content);
    unlinkSync(tempFile);

    process.stderr.write(`🚫 Oops #${state.oopsCount}: ${reason}\n   File: ${filePath}\n`);
  } finally {
    releaseLock();
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

  let input: HookInput;
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
  let state: OopsState;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    deny('Failed to read state.json');
  }

  const phase: Phase = state.phase ?? 'NONE';

  // NONE phase - unrestricted
  if (phase === 'NONE') {
    allow('Phase: NONE (unrestricted)');
  }

  const testFile = isTestFile(filePath);

  // Phase rules
  switch (phase) {
    case 'RED':
      if (testFile) {
        allow(`Phase: RED - Test file allowed: ${filePath}`);
      } else {
        incrementOops('Attempted to modify implementation during RED phase', filePath);
        deny(`🚫 Phase: RED - Only test files allowed. Cannot modify: ${filePath}`);
      }
      break;

    case 'GREEN':
      if (!testFile) {
        allow(`Phase: GREEN - Implementation file allowed: ${filePath}`);
      } else {
        incrementOops('Attempted to modify tests during GREEN phase', filePath);
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
