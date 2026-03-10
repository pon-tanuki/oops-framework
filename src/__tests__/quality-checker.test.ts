import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type OopsConfig } from '../types.js';
import { checkTestQuality, runQualityCommand } from '../core/quality-checker.js';

// --- Test fixtures ---

const TEST_DIR = '.oops-test-quality';
const OOPS_DIR = '.oops';
const CONFIG_FILE = join(OOPS_DIR, 'config.json');

function writeConfig(overrides: Partial<OopsConfig> = {}): void {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function setupTestFiles(files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    const dir = fullPath.split('/').slice(0, -1).join('/');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content);
  }
}

function cleanup(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
}

// --- Tests ---

describe('checkTestQuality', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeConfig();
  });

  beforeEach(() => cleanup());
  after(() => cleanup());

  it('should count test cases from it() and test() calls', () => {
    setupTestFiles({
      'math.test.ts': `
        describe('Math', () => {
          it('should add numbers', () => { expect(1+1).toBe(2); });
          it('should subtract numbers', () => { expect(2-1).toBe(1); });
          test('multiplication works', () => { expect(2*3).toBe(6); });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.equal(result.testCaseCount, 3);
  });

  it('should count assertions from expect() and assert calls', () => {
    setupTestFiles({
      'math.test.ts': `
        describe('Math', () => {
          it('should add', () => {
            expect(1+1).toBe(2);
            expect(1+2).toBe(3);
          });
          it('should subtract', () => {
            assert.equal(2-1, 1);
          });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.equal(result.assertionCount, 3);
    assert.equal(result.assertionsPerTest, 1.5);
  });

  it('should detect error/edge case tests', () => {
    setupTestFiles({
      'user.test.ts': `
        describe('UserService', () => {
          it('should create user', () => { expect(true).toBe(true); });
          it('should reject invalid email', () => { expect(true).toBe(true); });
          it('should throw on empty password', () => { expect(true).toBe(true); });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.equal(result.hasErrorCases, true);
  });

  it('should detect missing error cases', () => {
    setupTestFiles({
      'user.test.ts': `
        describe('UserService', () => {
          it('should create user', () => { expect(true).toBe(true); });
          it('should list users', () => { expect(true).toBe(true); });
          it('should update user', () => { expect(true).toBe(true); });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.equal(result.hasErrorCases, false);
  });

  it('should report issues when test count is below minimum', () => {
    setupTestFiles({
      'calc.test.ts': `
        describe('Calc', () => {
          it('should add', () => { expect(1+1).toBe(2); });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.ok(result.issues.length > 0);
    assert.ok(result.issues.some(i => /test case/.test(i)));
  });

  it('should report issue when no assertions found', () => {
    setupTestFiles({
      'empty.test.ts': `
        describe('Empty', () => {
          it('test 1', () => {});
          it('test 2', () => {});
          it('test 3', () => {});
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.ok(result.issues.some(i => /assertion/i.test(i)));
  });

  it('should report issue when error cases are missing and required', () => {
    setupTestFiles({
      'happy.test.ts': `
        describe('Happy', () => {
          it('should work correctly', () => { expect(true).toBe(true); });
          it('should return data', () => { expect(true).toBe(true); });
          it('should handle request', () => { expect(true).toBe(true); });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.ok(result.issues.some(i => /error|edge/i.test(i)));
  });

  it('should pass with no issues for well-written tests', () => {
    setupTestFiles({
      'good.test.ts': `
        describe('UserService', () => {
          it('should create user with valid data', () => {
            expect(user.name).toBe('John');
            expect(user.email).toBeDefined();
          });
          it('should reject invalid email format', () => {
            expect(result.error).toContain('invalid');
          });
          it('should handle empty name', () => {
            expect(result.error).toBeTruthy();
          });
          it('should update existing user', () => {
            expect(updated.name).toBe('Jane');
          });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);
    assert.equal(result.issues.length, 0);
    assert.equal(result.testCaseCount, 4);
    assert.equal(result.hasErrorCases, true);
  });
});

describe('runQualityCommand', () => {
  it('should return passed=true when command succeeds', () => {
    const result = runQualityCommand('echo "all good"');
    assert.equal(result.passed, true);
    assert.ok(result.output.includes('all good'));
  });

  it('should return passed=false when command fails', () => {
    const result = runQualityCommand('exit 1');
    assert.equal(result.passed, false);
  });

  it('should return passed=false when command not found', () => {
    const result = runQualityCommand('nonexistent-command-xyz 2>/dev/null');
    assert.equal(result.passed, false);
  });
});

describe('TestQualityResult type', () => {
  before(() => {
    mkdirSync(OOPS_DIR, { recursive: true });
    writeConfig();
  });

  after(() => cleanup());

  it('should have all required fields', () => {
    setupTestFiles({
      'type-check.test.ts': `
        describe('Types', () => {
          it('test 1', () => { expect(true).toBe(true); });
          it('test 2', () => { expect(true).toBe(true); });
          it('test 3 should fail on error', () => { expect(true).toBe(true); });
        });
      `,
    });

    const result = checkTestQuality(TEST_DIR);

    // Verify all fields exist and have correct types
    assert.equal(typeof result.testCaseCount, 'number');
    assert.equal(typeof result.assertionCount, 'number');
    assert.equal(typeof result.assertionsPerTest, 'number');
    assert.equal(typeof result.hasErrorCases, 'boolean');
    assert.ok(Array.isArray(result.issues));
  });
});

describe('QualityGate config defaults', () => {
  it('should have qualityGate in DEFAULT_CONFIG', () => {
    assert.ok(DEFAULT_CONFIG.qualityGate);
    assert.equal(DEFAULT_CONFIG.qualityGate.mode, 'warn');
    assert.equal(typeof DEFAULT_CONFIG.qualityGate.minTestCases, 'number');
    assert.equal(typeof DEFAULT_CONFIG.qualityGate.minAssertionsPerTest, 'number');
    assert.equal(typeof DEFAULT_CONFIG.qualityGate.requireErrorCases, 'boolean');
  });

  it('should have qualityGate feature flag in DEFAULT_CONFIG', () => {
    assert.equal(typeof DEFAULT_CONFIG.features.qualityGate, 'boolean');
    assert.equal(DEFAULT_CONFIG.features.qualityGate, true);
  });
});
