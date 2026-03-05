import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STATE, DEFAULT_CONFIG } from '../types.js';

const OOPS_DIR = '.oops';
const STATE_FILE = join(OOPS_DIR, 'state.json');
const CONFIG_FILE = join(OOPS_DIR, 'config.json');

describe('runDoctor', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    mkdirSync('.claude/hooks', { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  after(() => {
    // Restore state
    writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

  it('should not throw when all checks pass', async () => {
    // Ensure hook scripts exist and are executable
    const hookPre = '.claude/hooks/oops-gate-ts.sh';
    const hookPost = '.claude/hooks/oops-post-tool-ts.sh';
    if (!existsSync(hookPre)) {
      writeFileSync(hookPre, '#!/bin/bash\n');
      chmodSync(hookPre, 0o755);
    }
    if (!existsSync(hookPost)) {
      writeFileSync(hookPost, '#!/bin/bash\n');
      chmodSync(hookPost, 0o755);
    }
    // Ensure settings.json
    const settingsPath = '.claude/settings.json';
    if (!existsSync(settingsPath)) {
      writeFileSync(
        settingsPath,
        JSON.stringify({
          hooks: {
            PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '.claude/hooks/oops-gate-ts.sh' }] }],
            PostToolUse: [
              { matcher: 'Edit', hooks: [{ type: 'command', command: '.claude/hooks/oops-post-tool-ts.sh' }] },
            ],
          },
        }),
      );
    }

    const { runDoctor } = await import('../commands/doctor.js');
    assert.doesNotThrow(() => runDoctor());
  });

  it('should not throw with invalid state.json', async () => {
    writeFileSync(STATE_FILE, 'not json');
    const { runDoctor } = await import('../commands/doctor.js');
    assert.doesNotThrow(() => runDoctor());
    // Restore
    writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  });

  it('should not throw with missing config.json', async () => {
    const backup = existsSync(CONFIG_FILE) ? JSON.stringify(DEFAULT_CONFIG) : null;
    rmSync(CONFIG_FILE, { force: true });
    const { runDoctor } = await import('../commands/doctor.js');
    assert.doesNotThrow(() => runDoctor());
    // Restore
    if (backup) writeFileSync(CONFIG_FILE, backup);
  });
});
