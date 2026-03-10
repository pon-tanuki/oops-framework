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

const QUALITY_TMP = '.oops-quality-detect-tmp';

describe('detectQualityCommand', () => {
  before(() => {
    mkdirSync(QUALITY_TMP, { recursive: true });
  });

  after(() => {
    rmSync(QUALITY_TMP, { recursive: true, force: true });
  });

  beforeEach(() => {
    for (const f of ['.eslintrc.json', 'eslint.config.js', 'biome.json', 'biome.jsonc', 'pyproject.toml', 'Cargo.toml', '.golangci.yml']) {
      const p = join(QUALITY_TMP, f);
      if (existsSync(p)) rmSync(p);
    }
  });

  it('should detect ESLint from .eslintrc.json', async () => {
    writeFileSync(join(QUALITY_TMP, '.eslintrc.json'), '{}');
    const { detectQualityCommand } = await import('../core/project-detector.js');
    assert.equal(detectQualityCommand(QUALITY_TMP), 'npx eslint src/ --max-warnings 0');
  });

  it('should detect ESLint from eslint.config.js', async () => {
    writeFileSync(join(QUALITY_TMP, 'eslint.config.js'), 'export default [];');
    const { detectQualityCommand } = await import('../core/project-detector.js');
    assert.equal(detectQualityCommand(QUALITY_TMP), 'npx eslint src/ --max-warnings 0');
  });

  it('should detect Biome from biome.json', async () => {
    writeFileSync(join(QUALITY_TMP, 'biome.json'), '{}');
    const { detectQualityCommand } = await import('../core/project-detector.js');
    assert.equal(detectQualityCommand(QUALITY_TMP), 'npx biome check src/');
  });

  it('should detect ruff from pyproject.toml with tool.ruff', async () => {
    writeFileSync(join(QUALITY_TMP, 'pyproject.toml'), '[tool.ruff]\nselect = ["E"]');
    const { detectQualityCommand } = await import('../core/project-detector.js');
    assert.equal(detectQualityCommand(QUALITY_TMP), 'ruff check .');
  });

  it('should not detect ruff from pyproject.toml without tool.ruff', async () => {
    writeFileSync(join(QUALITY_TMP, 'pyproject.toml'), '[tool.pytest]');
    const { detectQualityCommand } = await import('../core/project-detector.js');
    // May still detect cargo clippy if Cargo.toml exists, so just check it's not ruff
    const result = detectQualityCommand(QUALITY_TMP);
    assert.notEqual(result, 'ruff check .');
  });

  it('should detect cargo clippy from Cargo.toml', async () => {
    writeFileSync(join(QUALITY_TMP, 'Cargo.toml'), '[package]\nname = "test"');
    const { detectQualityCommand } = await import('../core/project-detector.js');
    assert.equal(detectQualityCommand(QUALITY_TMP), 'cargo clippy -- -D warnings');
  });

  it('should detect golangci-lint from .golangci.yml', async () => {
    writeFileSync(join(QUALITY_TMP, '.golangci.yml'), 'linters: {}');
    const { detectQualityCommand } = await import('../core/project-detector.js');
    assert.equal(detectQualityCommand(QUALITY_TMP), 'golangci-lint run');
  });

  it('should return null when no linter config found', async () => {
    const { detectQualityCommand } = await import('../core/project-detector.js');
    assert.equal(detectQualityCommand(QUALITY_TMP), null);
  });
});
