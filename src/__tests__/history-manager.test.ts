import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CompletedSession, DEFAULT_STATE, DEFAULT_CONFIG } from '../types.js';

const OOPS_DIR = '.oops';
const STATE_FILE = join(OOPS_DIR, 'state.json');
const CONFIG_FILE = join(OOPS_DIR, 'config.json');
const HISTORY_FILE = join(OOPS_DIR, 'history.json');

function makeSession(overrides: Partial<CompletedSession> = {}): CompletedSession {
  return {
    featureName: 'test-feature',
    sessionId: 'session-abc123',
    startedAt: '2025-01-01T00:00:00.000Z',
    completedAt: '2025-01-01T01:00:00.000Z',
    oopsCount: 0,
    testResults: { passed: 5, failed: 0, total: 5 },
    ...overrides,
  };
}

describe('history-manager', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    if (existsSync(HISTORY_FILE)) rmSync(HISTORY_FILE);
  });

  beforeEach(() => {
    if (existsSync(HISTORY_FILE)) rmSync(HISTORY_FILE);
  });

  it('readHistory should return empty array when no file exists', async () => {
    const { readHistory } = await import('../core/history-manager.js');
    const history = readHistory();
    assert.deepEqual(history, []);
  });

  it('appendSession should create history file and add session', async () => {
    const { appendSession, readHistory } = await import('../core/history-manager.js');
    const session = makeSession();
    appendSession(session);

    assert.equal(existsSync(HISTORY_FILE), true);
    const history = readHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].featureName, 'test-feature');
  });

  it('appendSession should append to existing history', async () => {
    const { appendSession, readHistory } = await import('../core/history-manager.js');
    appendSession(makeSession({ featureName: 'first' }));
    appendSession(makeSession({ featureName: 'second', oopsCount: 3 }));

    const history = readHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].featureName, 'first');
    assert.equal(history[1].featureName, 'second');
    assert.equal(history[1].oopsCount, 3);
  });

  it('readHistory should return empty array for invalid JSON', async () => {
    writeFileSync(HISTORY_FILE, 'not json');
    const { readHistory } = await import('../core/history-manager.js');
    const history = readHistory();
    assert.deepEqual(history, []);
  });
});

describe('showHistory', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    if (existsSync(HISTORY_FILE)) rmSync(HISTORY_FILE);
  });

  it('should not throw with no history', async () => {
    if (existsSync(HISTORY_FILE)) rmSync(HISTORY_FILE);
    const { showHistory } = await import('../commands/history.js');
    assert.doesNotThrow(() => showHistory());
  });

  it('should not throw with history entries', async () => {
    const { appendSession } = await import('../core/history-manager.js');
    appendSession(makeSession({ featureName: 'feat-1' }));
    appendSession(makeSession({ featureName: 'feat-2', oopsCount: 2 }));

    const { showHistory } = await import('../commands/history.js');
    assert.doesNotThrow(() => showHistory());
  });

  it('should respect --limit option', async () => {
    const { showHistory } = await import('../commands/history.js');
    assert.doesNotThrow(() => showHistory({ limit: 1 }));
  });
});

describe('completeFeature saves history', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    if (existsSync(HISTORY_FILE)) rmSync(HISTORY_FILE);
  });

  it('should save session to history on feature complete', async () => {
    // Set up active feature
    writeFileSync(
      STATE_FILE,
      JSON.stringify({
        ...DEFAULT_STATE,
        phase: 'REFACTOR',
        featureName: 'my-feature',
        sessionId: 'session-xyz',
        oopsCount: 2,
        startedAt: '2025-06-01T00:00:00.000Z',
        testResults: { passed: 10, failed: 0, total: 10 },
      }),
    );

    if (existsSync(HISTORY_FILE)) rmSync(HISTORY_FILE);

    const { completeFeature } = await import('../commands/feature.js');
    completeFeature();

    const raw = readFileSync(HISTORY_FILE, 'utf-8');
    const history: CompletedSession[] = JSON.parse(raw);
    assert.equal(history.length, 1);
    assert.equal(history[0].featureName, 'my-feature');
    assert.equal(history[0].sessionId, 'session-xyz');
    assert.equal(history[0].oopsCount, 2);
    assert.equal(history[0].testResults.passed, 10);
  });
});
