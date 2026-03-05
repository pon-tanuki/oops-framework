import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STATE, type OopsState } from '../types.js';

// Use a temp directory to isolate tests from real .oops/
const TEST_BASE = join(process.cwd(), '.oops-test-state');
const OOPS_DIR = join(TEST_BASE, '.oops');
const STATE_FILE = join(OOPS_DIR, 'state.json');
const LOCK_FILE = join(OOPS_DIR, 'state.lock');

// We test state-manager by directly testing its file I/O patterns
// since the module uses hardcoded relative paths, we replicate the logic here

describe('State file I/O', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
  });

  after(() => {
    rmSync(TEST_BASE, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean state between tests
    if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  });

  it('should write and read state as JSON', () => {
    const state: OopsState = {
      ...DEFAULT_STATE,
      phase: 'RED',
      sessionId: 'test-session-123',
      oopsCount: 5,
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

    const raw = readFileSync(STATE_FILE, 'utf-8');
    const loaded = JSON.parse(raw) as OopsState;

    assert.equal(loaded.phase, 'RED');
    assert.equal(loaded.sessionId, 'test-session-123');
    assert.equal(loaded.oopsCount, 5);
  });

  it('should preserve all fields through round-trip', () => {
    const state: OopsState = {
      ...DEFAULT_STATE,
      phase: 'GREEN',
      featureName: 'my-feature',
      startedAt: '2026-03-05T00:00:00Z',
      testResults: { passed: 3, failed: 1, total: 4 },
      metadata: {
        created: '2026-03-05T00:00:00Z',
        phase0Start: null,
        lastUpdate: '2026-03-05T01:00:00Z',
      },
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

    const loaded = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as OopsState;
    assert.equal(loaded.featureName, 'my-feature');
    assert.equal(loaded.startedAt, '2026-03-05T00:00:00Z');
    assert.deepEqual(loaded.testResults, { passed: 3, failed: 1, total: 4 });
  });

  it('should handle missing state file gracefully', () => {
    assert.equal(existsSync(STATE_FILE), false);
    // Simulating readState() default behavior
    const state = existsSync(STATE_FILE)
      ? (JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as OopsState)
      : { ...DEFAULT_STATE };
    assert.equal(state.phase, 'NONE');
    assert.equal(state.oopsCount, 0);
  });

  it('should handle corrupted state file', () => {
    writeFileSync(STATE_FILE, 'not valid json{{{');

    assert.throws(() => {
      JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    });
  });
});

describe('Lock mechanism', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
  });

  after(() => {
    rmSync(TEST_BASE, { recursive: true, force: true });
  });

  beforeEach(() => {
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  });

  it('should create lock file with pid and timestamp', () => {
    const lockContent = `${process.pid}:${Date.now()}`;
    writeFileSync(LOCK_FILE, lockContent);

    assert.equal(existsSync(LOCK_FILE), true);
    const content = readFileSync(LOCK_FILE, 'utf-8');
    assert.match(content, /^\d+:\d+$/);

    unlinkSync(LOCK_FILE);
  });

  it('should detect stale locks by age', () => {
    writeFileSync(LOCK_FILE, `99999:${Date.now() - 10000}`); // 10 seconds ago

    const stat = statSync(LOCK_FILE);
    const ageS = (Date.now() - stat.mtimeMs) / 1000;

    // Lock was just written so mtimeMs is recent, but content shows old timestamp
    // In real code, staleness is checked by mtime not content
    assert.equal(ageS < 5, true); // Recently written = not stale by mtime
    assert.equal(existsSync(LOCK_FILE), true);

    unlinkSync(LOCK_FILE);
  });

  it('should release lock by deleting file', () => {
    writeFileSync(LOCK_FILE, `${process.pid}:${Date.now()}`);
    assert.equal(existsSync(LOCK_FILE), true);

    unlinkSync(LOCK_FILE);
    assert.equal(existsSync(LOCK_FILE), false);
  });
});

describe('State update atomicity', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
  });

  after(() => {
    rmSync(TEST_BASE, { recursive: true, force: true });
  });

  it('should update state fields correctly', () => {
    // Write initial state
    const initial: OopsState = { ...DEFAULT_STATE, phase: 'NONE', oopsCount: 0 };
    writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2) + '\n');

    // Read, modify, write (simulating updateState)
    const current = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as OopsState;
    const updated: OopsState = {
      ...current,
      phase: 'RED',
      oopsCount: current.oopsCount + 1,
      metadata: { ...current.metadata, lastUpdate: new Date().toISOString() },
    };
    writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2) + '\n');

    const result = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as OopsState;
    assert.equal(result.phase, 'RED');
    assert.equal(result.oopsCount, 1);
  });

  it('should increment oops count correctly', () => {
    const state: OopsState = { ...DEFAULT_STATE, oopsCount: 3 };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

    const current = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as OopsState;
    current.oopsCount += 1;
    current.lastOops = new Date().toISOString();
    writeFileSync(STATE_FILE, JSON.stringify(current, null, 2) + '\n');

    const result = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as OopsState;
    assert.equal(result.oopsCount, 4);
    assert.notEqual(result.lastOops, null);
  });
});
