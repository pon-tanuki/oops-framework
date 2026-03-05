import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync } from 'node:fs';

// Test in isolated temp directory
const TEST_DIR = '.oops-test-tmp';

// We test the logic directly by manipulating state files
// and importing the modules

describe('Phase transitions', () => {
  before(() => {
    // Save and create temp .oops directory
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should validate NONE -> RED as valid', async () => {
    const { isValidTransition } = await import('../core/phase-manager.js');
    assert.equal(isValidTransition('NONE', 'RED'), true);
  });

  it('should validate RED -> GREEN as valid', async () => {
    const { isValidTransition } = await import('../core/phase-manager.js');
    assert.equal(isValidTransition('RED', 'GREEN'), true);
  });

  it('should reject NONE -> GREEN as invalid', async () => {
    const { isValidTransition } = await import('../core/phase-manager.js');
    assert.equal(isValidTransition('NONE', 'GREEN'), false);
  });

  it('should reject RED -> REFACTOR as invalid', async () => {
    const { isValidTransition } = await import('../core/phase-manager.js');
    assert.equal(isValidTransition('RED', 'REFACTOR'), false);
  });

  it('should allow any phase -> NONE', async () => {
    const { isValidTransition } = await import('../core/phase-manager.js');
    assert.equal(isValidTransition('RED', 'NONE'), true);
    assert.equal(isValidTransition('GREEN', 'NONE'), true);
    assert.equal(isValidTransition('REFACTOR', 'NONE'), true);
  });

  it('should parse valid phase strings', async () => {
    const { parsePhase } = await import('../core/phase-manager.js');
    assert.equal(parsePhase('red'), 'RED');
    assert.equal(parsePhase('GREEN'), 'GREEN');
    assert.equal(parsePhase('Refactor'), 'REFACTOR');
    assert.equal(parsePhase('none'), 'NONE');
  });

  it('should reject invalid phase strings', async () => {
    const { parsePhase } = await import('../core/phase-manager.js');
    assert.throws(() => parsePhase('invalid'), /Invalid phase/);
    assert.throws(() => parsePhase('BLUE'), /Invalid phase/);
  });
});
