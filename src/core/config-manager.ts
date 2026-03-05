import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { type OopsConfig, DEFAULT_CONFIG } from '../types.js';
import { OOPS_DIR, CONFIG_FILE } from './paths.js';
import { logger } from './logger.js';

/**
 * Environment variable overrides (highest priority):
 *   OOPS_TEST_COMMAND  - Override testCommand
 *   OOPS_DEBUG         - Enable debug mode (true/1)
 *   OOPS_NO_COLOR      - Disable colored output (true/1)
 *   OOPS_DATA_DIR      - Override .oops directory (handled in paths.ts)
 */
function applyEnvOverrides(config: OopsConfig): OopsConfig {
  const result = { ...config, features: { ...config.features } };

  if (process.env.OOPS_TEST_COMMAND) {
    result.testCommand = process.env.OOPS_TEST_COMMAND;
  }

  if (process.env.OOPS_DEBUG === 'true' || process.env.OOPS_DEBUG === '1') {
    result.debug = true;
  }

  return result;
}

export function readConfig(): OopsConfig {
  let config: OopsConfig;

  if (!existsSync(CONFIG_FILE)) {
    config = { ...DEFAULT_CONFIG };
  } else {
    try {
      const raw = readFileSync(CONFIG_FILE, 'utf-8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (err) {
      logger.warn(`Failed to parse ${CONFIG_FILE}, using defaults: ${err instanceof Error ? err.message : String(err)}`);
      config = { ...DEFAULT_CONFIG };
    }
  }

  return applyEnvOverrides(config);
}

export function writeConfig(config: OopsConfig): void {
  if (!existsSync(OOPS_DIR)) {
    mkdirSync(OOPS_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

export function configExists(): boolean {
  return existsSync(CONFIG_FILE);
}
