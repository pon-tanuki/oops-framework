import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type OopsConfig } from '../types.js';

const TEST_BASE = join(process.cwd(), '.oops-test-config');
const OOPS_DIR = join(TEST_BASE, '.oops');
const CONFIG_FILE = join(OOPS_DIR, 'config.json');

describe('Config file I/O', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
  });

  after(() => {
    rmSync(TEST_BASE, { recursive: true, force: true });
  });

  beforeEach(() => {
    if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE);
  });

  it('should write and read config as JSON', () => {
    const config: OopsConfig = {
      ...DEFAULT_CONFIG,
      testCommand: 'npx vitest',
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');

    const loaded = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as OopsConfig;
    assert.equal(loaded.testCommand, 'npx vitest');
    assert.equal(loaded.version, '1.0.0');
  });

  it('should merge with defaults for partial config', () => {
    // Simulating readConfig() merge behavior
    const partial = { testCommand: 'yarn test' };
    writeFileSync(CONFIG_FILE, JSON.stringify(partial, null, 2) + '\n');

    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    const merged = { ...DEFAULT_CONFIG, ...raw };

    assert.equal(merged.testCommand, 'yarn test');
    assert.equal(merged.version, '1.0.0'); // From default
    assert.equal(merged.debug, false); // From default
    assert.equal(merged.features.autoGateCheck, true); // From default
  });

  it('should return defaults when no config file exists', () => {
    assert.equal(existsSync(CONFIG_FILE), false);
    const config = existsSync(CONFIG_FILE)
      ? { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) }
      : { ...DEFAULT_CONFIG };

    assert.equal(config.testCommand, 'npm test');
    assert.equal(config.debug, false);
    assert.deepEqual(config.features, {
      autoGateCheck: true,
      postToolUseTestRunner: false,
    });
  });

  it('should preserve feature flags through round-trip', () => {
    const config: OopsConfig = {
      ...DEFAULT_CONFIG,
      features: {
        autoGateCheck: false,
        postToolUseTestRunner: true,
      },
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');

    const loaded = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as OopsConfig;
    assert.equal(loaded.features.autoGateCheck, false);
    assert.equal(loaded.features.postToolUseTestRunner, true);
  });

  it('should handle corrupted config file', () => {
    writeFileSync(CONFIG_FILE, '{ broken json');

    assert.throws(() => {
      JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    });
  });
});

describe('Config defaults', () => {
  it('should have sensible default values', () => {
    assert.equal(DEFAULT_CONFIG.testCommand, 'npm test');
    assert.equal(DEFAULT_CONFIG.version, '1.0.0');
    assert.equal(DEFAULT_CONFIG.debug, false);
    assert.equal(DEFAULT_CONFIG.features.autoGateCheck, true);
    assert.equal(DEFAULT_CONFIG.features.postToolUseTestRunner, false);
  });

  it('should have a valid test file pattern', () => {
    const pattern = new RegExp(DEFAULT_CONFIG.testFilePattern);
    assert.equal(pattern.test('src/app.test.ts'), true);
    assert.equal(pattern.test('src/app.spec.js'), true);
    assert.equal(pattern.test('src/__tests__/app.js'), true);
    assert.equal(pattern.test('src/app.js'), false);
  });
});
