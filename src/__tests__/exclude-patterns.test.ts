import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isExcludedFile } from '../types.js';

const DEFAULT_PATTERNS = [
  '*.md',
  '*.yml',
  '*.yaml',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.github/**',
  '.oops/**',
  '.claude/**',
];

describe('isExcludedFile', () => {
  it('should exclude files matching extension patterns (*.md)', () => {
    assert.equal(isExcludedFile('README.md', DEFAULT_PATTERNS), true);
    assert.equal(isExcludedFile('docs/guide.md', DEFAULT_PATTERNS), true);
  });

  it('should exclude files matching *.yml and *.yaml', () => {
    assert.equal(isExcludedFile('.github/workflows/ci.yml', DEFAULT_PATTERNS), true);
    assert.equal(isExcludedFile('config.yaml', DEFAULT_PATTERNS), true);
  });

  it('should exclude exact filename matches', () => {
    assert.equal(isExcludedFile('package.json', DEFAULT_PATTERNS), true);
    assert.equal(isExcludedFile('package-lock.json', DEFAULT_PATTERNS), true);
    assert.equal(isExcludedFile('tsconfig.json', DEFAULT_PATTERNS), true);
  });

  it('should exclude directory patterns (dir/**)', () => {
    assert.equal(isExcludedFile('.oops/state.json', DEFAULT_PATTERNS), true);
    assert.equal(isExcludedFile('.claude/settings.json', DEFAULT_PATTERNS), true);
    assert.equal(isExcludedFile('.github/workflows/ci.yml', DEFAULT_PATTERNS), true);
  });

  it('should NOT exclude implementation files', () => {
    assert.equal(isExcludedFile('src/index.ts', DEFAULT_PATTERNS), false);
    assert.equal(isExcludedFile('src/commands/phase.ts', DEFAULT_PATTERNS), false);
  });

  it('should NOT exclude test files', () => {
    assert.equal(isExcludedFile('src/__tests__/phase.test.ts', DEFAULT_PATTERNS), false);
  });

  it('should handle leading ./ in paths', () => {
    assert.equal(isExcludedFile('./package.json', DEFAULT_PATTERNS), true);
    assert.equal(isExcludedFile('./src/index.ts', DEFAULT_PATTERNS), false);
  });

  it('should return false for empty patterns', () => {
    assert.equal(isExcludedFile('package.json', []), false);
  });

  it('should match nested exact filenames', () => {
    assert.equal(isExcludedFile('sub/package.json', DEFAULT_PATTERNS), true);
  });
});
