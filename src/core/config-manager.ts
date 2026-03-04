import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type OopsConfig, DEFAULT_CONFIG } from '../types.js';

const OOPS_DIR = '.oops';
const CONFIG_FILE = join(OOPS_DIR, 'config.json');

export function readConfig(): OopsConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(CONFIG_FILE, 'utf-8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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
