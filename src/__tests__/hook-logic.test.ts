import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTestFile, WRITE_TOOLS } from '../types.js';

describe('Test file detection', () => {
  it('should detect .test. files', () => {
    assert.equal(isTestFile('src/calculator.test.js'), true);
    assert.equal(isTestFile('calculator.test.ts'), true);
    assert.equal(isTestFile('/root/repos/project/src/utils.test.js'), true);
  });

  it('should detect .spec. files', () => {
    assert.equal(isTestFile('src/calculator.spec.js'), true);
    assert.equal(isTestFile('calculator.spec.ts'), true);
  });

  it('should detect /tests/ directory', () => {
    assert.equal(isTestFile('src/tests/calculator.js'), true);
    assert.equal(isTestFile('/root/repos/project/tests/utils.js'), true);
  });

  it('should detect /test/ directory', () => {
    assert.equal(isTestFile('src/test/calculator.js'), true);
  });

  it('should detect /__tests__/ directory', () => {
    assert.equal(isTestFile('src/__tests__/calculator.js'), true);
    assert.equal(isTestFile('src/__tests__/utils.js'), true);
  });

  it('should NOT detect regular implementation files', () => {
    assert.equal(isTestFile('src/calculator.js'), false);
    assert.equal(isTestFile('src/utils.ts'), false);
    assert.equal(isTestFile('lib/helper.js'), false);
  });

  it('should NOT false-positive on "test" in directory names', () => {
    assert.equal(isTestFile('test-files/example.js'), false);
    assert.equal(isTestFile('latest-code.js'), false);
    assert.equal(isTestFile('contest/entry.js'), false);
  });

  it('should handle absolute paths', () => {
    assert.equal(isTestFile('/root/repos/language_for_ai/test-files/src/calculator.js'), false);
    assert.equal(isTestFile('/root/repos/language_for_ai/test-files/tests/calculator.test.js'), true);
  });
});

describe('Phase rules', () => {
  it('should intercept Edit, Write, NotebookEdit', () => {
    assert.equal(WRITE_TOOLS.has('Edit'), true);
    assert.equal(WRITE_TOOLS.has('Write'), true);
    assert.equal(WRITE_TOOLS.has('NotebookEdit'), true);
  });

  it('should NOT intercept Read, Bash, Glob, Grep', () => {
    assert.equal(WRITE_TOOLS.has('Read'), false);
    assert.equal(WRITE_TOOLS.has('Bash'), false);
    assert.equal(WRITE_TOOLS.has('Glob'), false);
    assert.equal(WRITE_TOOLS.has('Grep'), false);
  });
});
