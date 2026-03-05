import { join } from 'node:path';

/**
 * Centralized path constants for the OOPS Framework.
 * All modules should import paths from here instead of defining locally.
 *
 * Supports OOPS_DATA_DIR environment variable to override the default .oops/ directory.
 */

export const OOPS_DIR = process.env.OOPS_DATA_DIR ?? '.oops';
export const STATE_FILE = join(OOPS_DIR, 'state.json');
export const CONFIG_FILE = join(OOPS_DIR, 'config.json');
export const LOCK_FILE = join(OOPS_DIR, 'state.lock');
export const PLAN_FILE = join(OOPS_DIR, 'plan.json');
export const HISTORY_FILE = join(OOPS_DIR, 'history.json');
