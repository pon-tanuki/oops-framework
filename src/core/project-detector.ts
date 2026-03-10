import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_DETECTORS: { file: string; command: string; check?: (dir: string) => boolean }[] = [
  { file: 'package.json', command: 'npm test' },
  { file: 'pyproject.toml', command: 'pytest' },
  { file: 'pytest.ini', command: 'pytest' },
  { file: 'Cargo.toml', command: 'cargo test' },
  { file: 'go.mod', command: 'go test ./...' },
  {
    file: 'Makefile',
    command: 'make test',
    check: (dir: string) => {
      try {
        const content = readFileSync(join(dir, 'Makefile'), 'utf-8');
        return /^test\s*:/m.test(content);
      } catch {
        return false;
      }
    },
  },
];

export function detectTestCommand(dir: string = '.'): string | null {
  for (const detector of PROJECT_DETECTORS) {
    if (existsSync(join(dir, detector.file))) {
      if (detector.check && !detector.check(dir)) continue;
      return detector.command;
    }
  }
  return null;
}

const QUALITY_DETECTORS: { check: (dir: string) => boolean; command: string }[] = [
  {
    check: (dir) =>
      existsSync(join(dir, '.eslintrc.js')) ||
      existsSync(join(dir, '.eslintrc.json')) ||
      existsSync(join(dir, '.eslintrc.yml')) ||
      existsSync(join(dir, '.eslintrc.yaml')) ||
      existsSync(join(dir, '.eslintrc.cjs')) ||
      existsSync(join(dir, 'eslint.config.js')) ||
      existsSync(join(dir, 'eslint.config.mjs')) ||
      existsSync(join(dir, 'eslint.config.cjs')) ||
      existsSync(join(dir, 'eslint.config.ts')),
    command: 'npx eslint src/ --max-warnings 0',
  },
  {
    check: (dir) => existsSync(join(dir, 'biome.json')) || existsSync(join(dir, 'biome.jsonc')),
    command: 'npx biome check src/',
  },
  {
    check: (dir) => {
      try {
        const content = readFileSync(join(dir, 'pyproject.toml'), 'utf-8');
        return /\[tool\.ruff\]/.test(content);
      } catch {
        return false;
      }
    },
    command: 'ruff check .',
  },
  {
    check: (dir) => existsSync(join(dir, 'Cargo.toml')),
    command: 'cargo clippy -- -D warnings',
  },
  {
    check: (dir) => existsSync(join(dir, '.golangci.yml')) || existsSync(join(dir, '.golangci.yaml')),
    command: 'golangci-lint run',
  },
];

export function detectQualityCommand(dir: string = '.'): string | null {
  for (const detector of QUALITY_DETECTORS) {
    if (detector.check(dir)) {
      return detector.command;
    }
  }
  return null;
}
