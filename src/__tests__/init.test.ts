import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TMP_DIR = '.oops-init-test-tmp';

describe('detectTestCommand', () => {
  before(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  after(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    for (const f of ['package.json', 'pyproject.toml', 'pytest.ini', 'Cargo.toml', 'go.mod', 'Makefile']) {
      const p = join(TMP_DIR, f);
      if (existsSync(p)) rmSync(p);
    }
  });

  it('should detect npm test for Node.js projects', async () => {
    writeFileSync(join(TMP_DIR, 'package.json'), '{}');
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), 'npm test');
  });

  it('should detect pytest for Python projects', async () => {
    writeFileSync(join(TMP_DIR, 'pyproject.toml'), '');
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), 'pytest');
  });

  it('should detect pytest for pytest.ini projects', async () => {
    writeFileSync(join(TMP_DIR, 'pytest.ini'), '');
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), 'pytest');
  });

  it('should detect cargo test for Rust projects', async () => {
    writeFileSync(join(TMP_DIR, 'Cargo.toml'), '');
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), 'cargo test');
  });

  it('should detect go test for Go projects', async () => {
    writeFileSync(join(TMP_DIR, 'go.mod'), '');
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), 'go test ./...');
  });

  it('should detect make test for Makefile projects', async () => {
    writeFileSync(join(TMP_DIR, 'Makefile'), 'test:\n\techo "testing"');
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), 'make test');
  });

  it('should not detect make test when Makefile has no test target', async () => {
    writeFileSync(join(TMP_DIR, 'Makefile'), 'build:\n\techo "building"');
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), null);
  });

  it('should return null when no project file detected', async () => {
    const { detectTestCommand } = await import('../core/project-detector.js');
    assert.equal(detectTestCommand(TMP_DIR), null);
  });
});
