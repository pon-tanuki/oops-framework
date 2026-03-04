import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { type OopsState, DEFAULT_STATE } from '../types.js';

const OOPS_DIR = '.oops';
const STATE_FILE = join(OOPS_DIR, 'state.json');
const LOCK_FILE = join(OOPS_DIR, 'state.lock');
const LOCK_TIMEOUT_MS = 3000;
const STALE_LOCK_AGE_S = 5;

function ensureOopsDir(): void {
  if (!existsSync(OOPS_DIR)) {
    mkdirSync(OOPS_DIR, { recursive: true });
  }
}

export function acquireLock(): void {
  const start = Date.now();

  while (existsSync(LOCK_FILE) && Date.now() - start < LOCK_TIMEOUT_MS) {
    const lockStat = statSync(LOCK_FILE, { throwIfNoEntry: false });
    if (lockStat) {
      const ageS = (Date.now() - lockStat.mtimeMs) / 1000;
      if (ageS > STALE_LOCK_AGE_S) {
        unlinkSync(LOCK_FILE);
        break;
      }
    }
    // Busy wait briefly
    const waitUntil = Date.now() + 100;
    while (Date.now() < waitUntil) { /* spin */ }
  }

  if (existsSync(LOCK_FILE)) {
    throw new Error('Failed to acquire lock: concurrent operation in progress');
  }

  writeFileSync(LOCK_FILE, `${process.pid}:${Date.now()}`);
}

export function releaseLock(): void {
  if (existsSync(LOCK_FILE)) {
    unlinkSync(LOCK_FILE);
  }
}

export function readState(): OopsState {
  if (!existsSync(STATE_FILE)) {
    return { ...DEFAULT_STATE };
  }
  const raw = readFileSync(STATE_FILE, 'utf-8');
  return JSON.parse(raw) as OopsState;
}

export function writeState(state: OopsState): void {
  ensureOopsDir();
  state.metadata.lastUpdate = new Date().toISOString();

  // Atomic write: temp file + rename
  const tempFile = join(tmpdir(), `oops-state-${process.pid}.json`);
  writeFileSync(tempFile, JSON.stringify(state, null, 2) + '\n');
  writeFileSync(STATE_FILE, readFileSync(tempFile, 'utf-8'));
  unlinkSync(tempFile);
}

export function updateState(updater: (state: OopsState) => OopsState): OopsState {
  acquireLock();
  try {
    const state = readState();
    const newState = updater(state);
    writeState(newState);
    return newState;
  } finally {
    releaseLock();
  }
}

export function stateExists(): boolean {
  return existsSync(STATE_FILE);
}
