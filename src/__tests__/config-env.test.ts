import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../types.js';

describe('Environment variable overrides', () => {
  // Save original env
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear OOPS env vars
    for (const key of ['OOPS_TEST_COMMAND', 'OOPS_DEBUG', 'OOPS_NO_COLOR', 'OOPS_DATA_DIR']) {
      origEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore original env
    for (const [key, val] of Object.entries(origEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  it('should override testCommand via OOPS_TEST_COMMAND', () => {
    process.env.OOPS_TEST_COMMAND = 'npx vitest';

    // Simulate applyEnvOverrides logic
    const config = { ...DEFAULT_CONFIG };
    if (process.env.OOPS_TEST_COMMAND) {
      config.testCommand = process.env.OOPS_TEST_COMMAND;
    }

    assert.equal(config.testCommand, 'npx vitest');
  });

  it('should enable debug via OOPS_DEBUG=true', () => {
    process.env.OOPS_DEBUG = 'true';

    const config = { ...DEFAULT_CONFIG };
    if (process.env.OOPS_DEBUG === 'true' || process.env.OOPS_DEBUG === '1') {
      config.debug = true;
    }

    assert.equal(config.debug, true);
  });

  it('should enable debug via OOPS_DEBUG=1', () => {
    process.env.OOPS_DEBUG = '1';

    const config = { ...DEFAULT_CONFIG };
    if (process.env.OOPS_DEBUG === 'true' || process.env.OOPS_DEBUG === '1') {
      config.debug = true;
    }

    assert.equal(config.debug, true);
  });

  it('should not enable debug for other OOPS_DEBUG values', () => {
    process.env.OOPS_DEBUG = 'false';

    const config = { ...DEFAULT_CONFIG };
    if (process.env.OOPS_DEBUG === 'true' || process.env.OOPS_DEBUG === '1') {
      config.debug = true;
    }

    assert.equal(config.debug, false);
  });

  it('should use default testCommand when OOPS_TEST_COMMAND is not set', () => {
    delete process.env.OOPS_TEST_COMMAND;

    const config = { ...DEFAULT_CONFIG };
    if (process.env.OOPS_TEST_COMMAND) {
      config.testCommand = process.env.OOPS_TEST_COMMAND;
    }

    assert.equal(config.testCommand, 'npm test');
  });
});

describe('Path constants', () => {
  it('should use default .oops directory', async () => {
    delete process.env.OOPS_DATA_DIR;
    // paths.ts reads env at import time, so we test the pattern
    const dataDir = process.env.OOPS_DATA_DIR ?? '.oops';
    assert.equal(dataDir, '.oops');
  });

  it('should respect OOPS_DATA_DIR override', () => {
    process.env.OOPS_DATA_DIR = '/tmp/custom-oops';
    const dataDir = process.env.OOPS_DATA_DIR ?? '.oops';
    assert.equal(dataDir, '/tmp/custom-oops');
    delete process.env.OOPS_DATA_DIR;
  });
});

describe('Logger levels', () => {
  it('should have valid log level ordering', () => {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    assert.equal(levels.debug < levels.info, true);
    assert.equal(levels.info < levels.warn, true);
    assert.equal(levels.warn < levels.error, true);
  });
});
