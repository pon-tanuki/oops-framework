import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { type CompletedSession } from '../types.js';
import { OOPS_DIR, HISTORY_FILE } from './paths.js';
import { logger } from './logger.js';

export function readHistory(): CompletedSession[] {
  if (!existsSync(HISTORY_FILE)) {
    return [];
  }
  try {
    const raw = readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Failed to parse ${HISTORY_FILE}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export function appendSession(session: CompletedSession): void {
  const history = readHistory();
  history.push(session);
  if (!existsSync(OOPS_DIR)) {
    mkdirSync(OOPS_DIR, { recursive: true });
  }
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
}
