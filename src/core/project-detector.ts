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
