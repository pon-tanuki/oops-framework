import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stateExists, writeState } from '../core/state-manager.js';
import { configExists, writeConfig } from '../core/config-manager.js';
import { DEFAULT_STATE, DEFAULT_CONFIG } from '../types.js';
import { PACKAGE_ROOT } from '../cli/index.js';
import { detectTestCommand } from '../core/project-detector.js';

// --- Hook script content ---

const PRE_HOOK_SCRIPT = `#!/usr/bin/env bash
exec oops hook-pre
`;

const POST_HOOK_SCRIPT = `#!/usr/bin/env bash
exec oops hook-post
`;

// --- Settings.json template ---

const OOPS_HOOKS_SETTINGS = {
  hooks: {
    PreToolUse: [
      { matcher: 'Edit', hooks: [{ type: 'command', command: '.claude/hooks/oops-gate-ts.sh' }] },
      { matcher: 'Write', hooks: [{ type: 'command', command: '.claude/hooks/oops-gate-ts.sh' }] },
      { matcher: 'NotebookEdit', hooks: [{ type: 'command', command: '.claude/hooks/oops-gate-ts.sh' }] },
    ],
    PostToolUse: [
      { matcher: 'Edit', hooks: [{ type: 'command', command: '.claude/hooks/oops-post-tool-ts.sh' }] },
      { matcher: 'Write', hooks: [{ type: 'command', command: '.claude/hooks/oops-post-tool-ts.sh' }] },
      { matcher: 'NotebookEdit', hooks: [{ type: 'command', command: '.claude/hooks/oops-post-tool-ts.sh' }] },
    ],
  },
};

// --- CLAUDE.md template ---

const CLAUDE_MD_CONTENT = `# OOPS Framework - Development Rules

## TDD開発ルール

このプロジェクトでは OOPS Framework によるTDD規律を使用する。

### 機能開発時のフロー

1. **小さなタスク**: \`oops feature start <name>\` → RED → GREEN → REFACTOR → \`oops feature complete\`
2. **大きなタスク**: \`oops plan create\` でサブタスクに分解 → \`oops plan next\` で逐次実行

### フェーズルール

- **RED**: テストファイルのみ編集可能。失敗するテストを書く
- **GREEN**: 実装ファイルのみ編集可能。最小限のコードでテストを通す
- **REFACTOR**: 両方編集可能。テストが通り続けることを確認しながらリファクタ

### REFACTORフェーズでのコードレビュー

REFACTORフェーズに入ったら、サブエージェント（Agent tool）を使ってコードレビューを実施すること:
- RED/GREENフェーズで変更したファイルを対象にレビューサブエージェントを起動
- リファクタリング候補（命名改善、重複除去、関数分割など）を特定
- レビュー結果に基づいてリファクタリングを実施
- テストがグリーンを維持していることを確認してから \`oops feature complete\`

### TDDが不要なタスク

ドキュメント作成・統合テスト・設定変更などTDDサイクルが不適切なタスクには:
\`oops feature start --no-tdd <name>\` で非TDDモードを使用する。

### コマンド

\`\`\`bash
oops phase              # 現在のフェーズ確認
oops feature start <n>  # 機能開発開始（小さなタスク）
oops plan create        # タスク分解（大きなタスク）
oops plan next          # 次のサブタスク開始
oops plan done          # サブタスク完了
oops plan show          # 計画表示
oops stats              # 統計表示
\`\`\`

### 注意事項

- hookがフェーズに反するファイル編集をブロックする
- ブロックされたら \`oops phase\` で現在のフェーズを確認
- テストコマンド: \`npm test\`
`;

// --- Helper functions ---

function writeExecutable(filePath: string, content: string, label: string, force: boolean): void {
  if (!existsSync(filePath) || force) {
    writeFileSync(filePath, content);
    chmodSync(filePath, 0o755);
    console.log(chalk.green(`  ✅ Created ${label}`));
  } else {
    console.log(chalk.gray(`  ✓ ${label} exists`));
  }
}

function ensureDir(dirPath: string, label: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(chalk.green(`  ✅ Created ${label}`));
  } else {
    console.log(chalk.gray(`  ✓ ${label} exists`));
  }
}

function mergeSettings(force: boolean): void {
  const settingsPath = '.claude/settings.json';

  if (!existsSync(settingsPath) || force) {
    writeFileSync(settingsPath, JSON.stringify(OOPS_HOOKS_SETTINGS, null, 2) + '\n');
    console.log(chalk.green('  ✅ Created .claude/settings.json'));
    return;
  }

  try {
    const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    if (existing.hooks?.PreToolUse && existing.hooks?.PostToolUse) {
      console.log(chalk.gray('  ✓ .claude/settings.json already has hooks'));
      return;
    }
    existing.hooks = { ...existing.hooks, ...OOPS_HOOKS_SETTINGS.hooks };
    writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n');
    console.log(chalk.green('  ✅ Merged hooks into .claude/settings.json'));
  } catch {
    writeFileSync(settingsPath, JSON.stringify(OOPS_HOOKS_SETTINGS, null, 2) + '\n');
    console.log(chalk.green('  ✅ Created .claude/settings.json (replaced invalid file)'));
  }
}

function copySkills(force: boolean): void {
  const sourceDir = join(PACKAGE_ROOT, '.claude', 'skills');
  const targetDir = '.claude/skills';

  if (!existsSync(sourceDir)) {
    console.log(chalk.yellow('  ⚠ Skills source not found in package'));
    return;
  }

  ensureDir(targetDir, '.claude/skills/');

  const files = readdirSync(sourceDir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const targetPath = join(targetDir, file);
    if (!existsSync(targetPath) || force) {
      copyFileSync(join(sourceDir, file), targetPath);
      console.log(chalk.green(`  ✅ Copied skill: ${file}`));
    } else {
      console.log(chalk.gray(`  ✓ Skill exists: ${file}`));
    }
  }
}

// --- Main ---

export function initOops(options: { force?: boolean; testCommand?: string } = {}): void {
  const force = options.force ?? false;

  console.log(chalk.bold('\n🙊 Initializing OOPS Framework'));
  console.log(chalk.gray('   "No more \'Oops, I broke it again!\'"'));
  console.log();

  // 1. .oops/ directory + state + config
  console.log(chalk.bold('  📁 OOPS State'));
  ensureDir('.oops', '.oops/');

  if (!stateExists() || force) {
    writeState({ ...DEFAULT_STATE, metadata: { ...DEFAULT_STATE.metadata, created: new Date().toISOString() } });
    console.log(chalk.green('  ✅ Created .oops/state.json'));
  } else {
    console.log(chalk.gray('  ✓ .oops/state.json exists'));
  }

  if (!configExists() || force) {
    const detected = options.testCommand ?? detectTestCommand();
    const config = { ...DEFAULT_CONFIG };
    if (detected) {
      config.testCommand = detected;
    }
    writeConfig(config);
    console.log(chalk.green('  ✅ Created .oops/config.json'));
    if (detected && detected !== DEFAULT_CONFIG.testCommand) {
      console.log(chalk.cyan(`     Test command auto-detected: ${detected}`));
    }
  } else {
    console.log(chalk.gray('  ✓ .oops/config.json exists'));
  }

  console.log();

  // 2. Hook scripts
  console.log(chalk.bold('  🪝 Claude Code Hooks'));
  ensureDir('.claude/hooks', '.claude/hooks/');
  writeExecutable('.claude/hooks/oops-gate-ts.sh', PRE_HOOK_SCRIPT, '.claude/hooks/oops-gate-ts.sh', force);
  writeExecutable('.claude/hooks/oops-post-tool-ts.sh', POST_HOOK_SCRIPT, '.claude/hooks/oops-post-tool-ts.sh', force);

  console.log();

  // 3. Settings.json
  console.log(chalk.bold('  ⚙️  Claude Code Settings'));
  ensureDir('.claude', '.claude/');
  mergeSettings(force);

  console.log();

  // 4. Skills
  console.log(chalk.bold('  📚 Skills'));
  copySkills(force);

  console.log();

  // 5. CLAUDE.md
  console.log(chalk.bold('  📝 CLAUDE.md'));
  if (!existsSync('CLAUDE.md') || force) {
    writeFileSync('CLAUDE.md', CLAUDE_MD_CONTENT);
    console.log(chalk.green('  ✅ Created CLAUDE.md'));
  } else {
    console.log(chalk.yellow('  ⚠ CLAUDE.md already exists (not overwriting)'));
  }

  // Done
  console.log(chalk.bold.green('\n✅ OOPS Framework ready!'));
  console.log(chalk.gray('   Run: oops feature start <name>'));
  console.log(chalk.gray('   Or:  oops plan create --goal "..." --subtask "..."'));
  console.log();
}
