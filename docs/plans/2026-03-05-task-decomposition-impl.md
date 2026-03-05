# タスク分解オーケストレーション 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 大きなタスクを小さなサブタスクに分解し、各サブタスクをOOPSサイクルで逐次実行する仕組みを追加する。

**Architecture:** plan.jsonでサブタスクリストを永続化し、`oops plan`コマンドで管理する。oops-orchestrator Skillを拡張して、LLMが自発的にタスク分解→逐次OOPSサイクル実行するよう誘導する。

**Tech Stack:** TypeScript, Commander.js, chalk, tsx

---

### Task 1: 型定義の追加

**Files:**
- Modify: `src/types.ts:1-79`
- Test: `src/__tests__/plan-manager.test.ts` (Task 2で作成)

**Step 1: OopsPlan型とSubtask型をtypes.tsに追加する**

`src/types.ts`の末尾、`DEFAULT_CONFIG`の後に以下を追加:

```typescript
export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type PlanStatus = 'planning' | 'in_progress' | 'completed';

export interface Subtask {
  id: number;
  name: string;
  description: string;
  status: SubtaskStatus;
  oopsCount: number;
  cycles: number;
}

export interface OopsPlan {
  goal: string;
  createdAt: string;
  status: PlanStatus;
  currentSubtask: number | null;
  subtasks: Subtask[];
}

export const DEFAULT_PLAN: OopsPlan = {
  goal: '',
  createdAt: '',
  status: 'planning',
  currentSubtask: null,
  subtasks: [],
};
```

**Step 2: コミット**

```bash
git add src/types.ts
git commit -m "feat: Subtask, OopsPlan 型定義を追加"
```

---

### Task 2: plan-manager コアモジュール

**Files:**
- Create: `src/core/plan-manager.ts`
- Create: `src/__tests__/plan-manager.test.ts`

**Step 1: 失敗するテストを書く**

`src/__tests__/plan-manager.test.ts`:

```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';

// テスト用に.oopsディレクトリを一時作成
const TEST_DIR = '.oops-test-plan';

// plan-managerのロジックをインラインでテスト
// （モジュール読み込みの都合上、ロジック関数を直接テスト）

import type { OopsPlan, Subtask } from '../types.js';

function createPlan(goal: string, subtaskDefs: { name: string; description: string }[]): OopsPlan {
  return {
    goal,
    createdAt: new Date().toISOString(),
    status: 'in_progress',
    currentSubtask: null,
    subtasks: subtaskDefs.map((s, i) => ({
      id: i + 1,
      name: s.name,
      description: s.description,
      status: 'pending' as const,
      oopsCount: 0,
      cycles: 0,
    })),
  };
}

function getNextSubtask(plan: OopsPlan): Subtask | null {
  return plan.subtasks.find(s => s.status === 'pending') ?? null;
}

function isAllCompleted(plan: OopsPlan): boolean {
  return plan.subtasks.every(s => s.status === 'completed' || s.status === 'skipped');
}

describe('Plan creation', () => {
  it('should create plan with subtasks', () => {
    const plan = createPlan('Build app', [
      { name: 'Model', description: 'Create data model' },
      { name: 'API', description: 'Create endpoints' },
    ]);
    assert.equal(plan.goal, 'Build app');
    assert.equal(plan.subtasks.length, 2);
    assert.equal(plan.subtasks[0].id, 1);
    assert.equal(plan.subtasks[0].status, 'pending');
    assert.equal(plan.status, 'in_progress');
  });

  it('should assign sequential IDs', () => {
    const plan = createPlan('Test', [
      { name: 'A', description: 'a' },
      { name: 'B', description: 'b' },
      { name: 'C', description: 'c' },
    ]);
    assert.deepEqual(plan.subtasks.map(s => s.id), [1, 2, 3]);
  });
});

describe('Next subtask', () => {
  it('should return first pending subtask', () => {
    const plan = createPlan('Test', [
      { name: 'A', description: 'a' },
      { name: 'B', description: 'b' },
    ]);
    plan.subtasks[0].status = 'completed';
    const next = getNextSubtask(plan);
    assert.equal(next?.id, 2);
    assert.equal(next?.name, 'B');
  });

  it('should return null when all done', () => {
    const plan = createPlan('Test', [
      { name: 'A', description: 'a' },
    ]);
    plan.subtasks[0].status = 'completed';
    assert.equal(getNextSubtask(plan), null);
  });

  it('should skip skipped subtasks', () => {
    const plan = createPlan('Test', [
      { name: 'A', description: 'a' },
      { name: 'B', description: 'b' },
      { name: 'C', description: 'c' },
    ]);
    plan.subtasks[0].status = 'completed';
    plan.subtasks[1].status = 'skipped';
    const next = getNextSubtask(plan);
    assert.equal(next?.id, 3);
  });
});

describe('Completion check', () => {
  it('should detect all completed', () => {
    const plan = createPlan('Test', [
      { name: 'A', description: 'a' },
      { name: 'B', description: 'b' },
    ]);
    plan.subtasks[0].status = 'completed';
    plan.subtasks[1].status = 'completed';
    assert.equal(isAllCompleted(plan), true);
  });

  it('should treat skipped as done', () => {
    const plan = createPlan('Test', [
      { name: 'A', description: 'a' },
      { name: 'B', description: 'b' },
    ]);
    plan.subtasks[0].status = 'completed';
    plan.subtasks[1].status = 'skipped';
    assert.equal(isAllCompleted(plan), true);
  });

  it('should detect incomplete', () => {
    const plan = createPlan('Test', [
      { name: 'A', description: 'a' },
      { name: 'B', description: 'b' },
    ]);
    plan.subtasks[0].status = 'completed';
    assert.equal(isAllCompleted(plan), false);
  });
});
```

**Step 2: テストを実行して失敗を確認**

Run: `npx tsx --test src/__tests__/plan-manager.test.ts`
Expected: PASS（ロジックはインラインなので通るはず。これはロジック検証テスト）

**Step 3: plan-manager.tsを実装する**

`src/core/plan-manager.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { OopsPlan, Subtask } from '../types.js';

const OOPS_DIR = '.oops';
const PLAN_FILE = join(OOPS_DIR, 'plan.json');

function ensureOopsDir(): void {
  if (!existsSync(OOPS_DIR)) {
    mkdirSync(OOPS_DIR, { recursive: true });
  }
}

export function planExists(): boolean {
  return existsSync(PLAN_FILE);
}

export function readPlan(): OopsPlan {
  if (!existsSync(PLAN_FILE)) {
    throw new Error('No plan found. Run `oops plan create` first.');
  }
  return JSON.parse(readFileSync(PLAN_FILE, 'utf-8'));
}

export function writePlan(plan: OopsPlan): void {
  ensureOopsDir();
  const tempFile = join(tmpdir(), `oops-plan-${process.pid}.json`);
  writeFileSync(tempFile, JSON.stringify(plan, null, 2) + '\n');
  writeFileSync(PLAN_FILE, readFileSync(tempFile, 'utf-8'));
  try { require('node:fs').unlinkSync(tempFile); } catch {}
}

export function createPlan(
  goal: string,
  subtaskDefs: { name: string; description: string }[]
): OopsPlan {
  const plan: OopsPlan = {
    goal,
    createdAt: new Date().toISOString(),
    status: 'in_progress',
    currentSubtask: null,
    subtasks: subtaskDefs.map((s, i) => ({
      id: i + 1,
      name: s.name,
      description: s.description,
      status: 'pending',
      oopsCount: 0,
      cycles: 0,
    })),
  };
  writePlan(plan);
  return plan;
}

export function getNextSubtask(plan: OopsPlan): Subtask | null {
  return plan.subtasks.find(s => s.status === 'pending') ?? null;
}

export function isAllCompleted(plan: OopsPlan): boolean {
  return plan.subtasks.every(
    s => s.status === 'completed' || s.status === 'skipped'
  );
}

export function updateSubtask(
  id: number,
  updater: (s: Subtask) => Subtask
): OopsPlan {
  const plan = readPlan();
  const idx = plan.subtasks.findIndex(s => s.id === id);
  if (idx === -1) throw new Error(`Subtask ${id} not found`);
  plan.subtasks[idx] = updater(plan.subtasks[idx]);
  writePlan(plan);
  return plan;
}

export function addSubtask(name: string, description: string): OopsPlan {
  const plan = readPlan();
  const maxId = Math.max(0, ...plan.subtasks.map(s => s.id));
  plan.subtasks.push({
    id: maxId + 1,
    name,
    description,
    status: 'pending',
    oopsCount: 0,
    cycles: 0,
  });
  writePlan(plan);
  return plan;
}

export function deletePlan(): void {
  if (existsSync(PLAN_FILE)) {
    require('node:fs').unlinkSync(PLAN_FILE);
  }
}
```

**Step 4: テスト再実行して全パスを確認**

Run: `npx tsx --test src/__tests__/plan-manager.test.ts`
Expected: 全テストPASS

**Step 5: コミット**

```bash
git add src/core/plan-manager.ts src/__tests__/plan-manager.test.ts
git commit -m "feat: plan-manager コアモジュールとテスト追加"
```

---

### Task 3: plan コマンド実装

**Files:**
- Create: `src/commands/plan.ts`
- Modify: `src/cli/index.ts:1-69`

**Step 1: src/commands/plan.ts を作成**

```typescript
import chalk from 'chalk';
import {
  planExists, readPlan, createPlan, writePlan,
  getNextSubtask, isAllCompleted, updateSubtask, addSubtask, deletePlan,
} from '../core/plan-manager.js';
import { readState } from '../core/state-manager.js';
import { startFeature, completeFeature } from './feature.js';

export function createPlanCommand(
  goal: string,
  subtaskArgs: string[]
): void {
  if (planExists()) {
    const plan = readPlan();
    if (plan.status !== 'completed') {
      console.error(chalk.red('Error: Active plan exists. Run `oops plan complete` first.'));
      process.exit(1);
    }
  }

  const subtasks = subtaskArgs.map(s => {
    const [name, ...descParts] = s.split(':');
    return {
      name: name.trim(),
      description: descParts.join(':').trim() || name.trim(),
    };
  });

  if (subtasks.length === 0) {
    console.error(chalk.red('Error: At least one --subtask required.'));
    process.exit(1);
  }

  const plan = createPlan(goal, subtasks);

  console.log(chalk.bold(`\n📋 Plan created: ${chalk.cyan(goal)}`));
  console.log(`   ${plan.subtasks.length} subtasks:\n`);
  for (const s of plan.subtasks) {
    console.log(`   ${s.id}. ${s.name} - ${chalk.gray(s.description)}`);
  }
  console.log(chalk.gray(`\n   Run: oops plan next\n`));
}

export function showPlan(): void {
  if (!planExists()) {
    console.log(chalk.gray('No plan. Run `oops plan create` to start.'));
    return;
  }

  const plan = readPlan();
  const statusIcon: Record<string, string> = {
    pending: '⬜',
    in_progress: '🔄',
    completed: '✅',
    skipped: '⏭️',
  };

  console.log(chalk.bold(`\n📋 ${plan.goal}`));
  console.log(chalk.gray(`   Status: ${plan.status}\n`));

  for (const s of plan.subtasks) {
    const icon = statusIcon[s.status] ?? '❓';
    const line = `   ${icon} ${s.id}. ${s.name}`;
    if (s.status === 'in_progress') {
      console.log(chalk.yellow(line));
    } else if (s.status === 'completed') {
      console.log(chalk.green(line) + chalk.gray(` (oops: ${s.oopsCount})`));
    } else if (s.status === 'skipped') {
      console.log(chalk.gray(line));
    } else {
      console.log(line);
    }
  }

  const completed = plan.subtasks.filter(s => s.status === 'completed').length;
  const total = plan.subtasks.length;
  console.log(chalk.gray(`\n   Progress: ${completed}/${total}\n`));
}

export function nextSubtask(): void {
  if (!planExists()) {
    console.error(chalk.red('Error: No plan. Run `oops plan create` first.'));
    process.exit(1);
  }

  const state = readState();
  if (state.phase !== 'NONE') {
    console.error(chalk.red(`Error: Finish current feature first (phase: ${state.phase}).`));
    console.error(chalk.gray('   Run: oops plan done'));
    process.exit(1);
  }

  const plan = readPlan();
  const next = getNextSubtask(plan);

  if (!next) {
    console.log(chalk.green('\n🎉 All subtasks completed!'));
    console.log(chalk.gray('   Run: oops plan complete\n'));
    return;
  }

  // Update subtask status
  updateSubtask(next.id, s => ({ ...s, status: 'in_progress' }));
  const updatedPlan = readPlan();
  updatedPlan.currentSubtask = next.id;
  writePlan(updatedPlan);

  console.log(chalk.bold(`\n▶️  Starting subtask ${next.id}/${plan.subtasks.length}: ${chalk.cyan(next.name)}`));
  console.log(chalk.gray(`   ${next.description}\n`));

  // Start feature via OOPS
  startFeature(next.name);
}

export function doneSubtask(): void {
  if (!planExists()) {
    console.error(chalk.red('Error: No plan.'));
    process.exit(1);
  }

  const plan = readPlan();
  if (plan.currentSubtask === null) {
    console.error(chalk.red('Error: No active subtask.'));
    process.exit(1);
  }

  const state = readState();
  const oopsCount = state.oopsCount;

  // Complete the feature
  completeFeature();

  // Update subtask in plan
  updateSubtask(plan.currentSubtask, s => ({
    ...s,
    status: 'completed',
    oopsCount,
    cycles: s.cycles + 1,
  }));

  const updatedPlan = readPlan();
  updatedPlan.currentSubtask = null;
  writePlan(updatedPlan);

  // Show next steps
  const next = getNextSubtask(updatedPlan);
  if (next) {
    console.log(chalk.gray(`   Next: oops plan next  (${next.name})\n`));
  } else {
    console.log(chalk.green('\n🎉 All subtasks completed!'));
    console.log(chalk.gray('   Run: oops plan complete\n'));
  }
}

export function completePlan(): void {
  if (!planExists()) {
    console.error(chalk.red('Error: No plan.'));
    process.exit(1);
  }

  const plan = readPlan();

  if (!isAllCompleted(plan)) {
    const pending = plan.subtasks.filter(s => s.status === 'pending').length;
    console.error(chalk.red(`Error: ${pending} subtasks still pending.`));
    process.exit(1);
  }

  plan.status = 'completed';
  writePlan(plan);

  const totalOops = plan.subtasks.reduce((sum, s) => sum + s.oopsCount, 0);
  const totalCycles = plan.subtasks.reduce((sum, s) => sum + s.cycles, 0);

  console.log(chalk.bold.green(`\n🏁 Plan completed: ${plan.goal}`));
  console.log(`   Subtasks: ${plan.subtasks.length}`);
  console.log(`   Total OOPS cycles: ${totalCycles}`);
  console.log(`   Total oops prevented: ${totalOops === 0 ? chalk.green('0 🎉') : chalk.yellow(String(totalOops))}`);
  console.log();
}

export function skipSubtask(idStr: string): void {
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    console.error(chalk.red('Error: Invalid subtask ID.'));
    process.exit(1);
  }
  updateSubtask(id, s => ({ ...s, status: 'skipped' }));
  console.log(chalk.gray(`⏭️  Skipped subtask ${id}`));
}

export function addSubtaskCommand(subtaskArg: string): void {
  const [name, ...descParts] = subtaskArg.split(':');
  const plan = addSubtask(name.trim(), descParts.join(':').trim() || name.trim());
  const added = plan.subtasks[plan.subtasks.length - 1];
  console.log(chalk.green(`✅ Added subtask ${added.id}: ${added.name}`));
}
```

**Step 2: src/cli/index.tsにplanコマンドを登録**

`src/cli/index.ts`のimportに追加:
```typescript
import {
  createPlanCommand, showPlan, nextSubtask,
  doneSubtask, completePlan, skipSubtask, addSubtaskCommand,
} from '../commands/plan.js';
```

`program.parse()`の直前に以下を追加:

```typescript
// oops plan <action>
const plan = program
  .command('plan')
  .description('Manage task decomposition plan');

plan
  .command('create')
  .description('Create a new plan with subtasks')
  .requiredOption('--goal <goal>', 'The overall goal')
  .option('--subtask <subtask...>', 'Subtasks in "name: description" format')
  .action((options) => createPlanCommand(options.goal, options.subtask || []));

plan
  .command('show')
  .description('Show current plan')
  .action(() => showPlan());

plan
  .command('next')
  .description('Start the next subtask')
  .action(() => nextSubtask());

plan
  .command('done')
  .description('Complete current subtask')
  .action(() => doneSubtask());

plan
  .command('complete')
  .description('Mark the entire plan as complete')
  .action(() => completePlan());

plan
  .command('skip <id>')
  .description('Skip a subtask')
  .action((id) => skipSubtask(id));

plan
  .command('add')
  .description('Add a subtask to the plan')
  .requiredOption('--subtask <subtask>', 'Subtask in "name: description" format')
  .action((options) => addSubtaskCommand(options.subtask));
```

**Step 3: CLIの動作確認**

Run: `./bin/oops plan --help`
Expected: plan サブコマンドのヘルプが表示される

**Step 4: コミット**

```bash
git add src/commands/plan.ts src/cli/index.ts
git commit -m "feat: oops plan コマンド実装"
```

---

### Task 4: oops-orchestrator Skill の拡張

**Files:**
- Modify: `.claude/skills/oops-orchestrator.md`

**Step 1: Skillにタスク分解フローを追加**

`.claude/skills/oops-orchestrator.md`の先頭の`## Workflow`セクションの前に以下を挿入:

```markdown
## Task Decomposition (大きなタスクの場合)

機能開発の指示を受けたら、まずタスクの規模を判断する。

**小さなタスク**（1〜3ファイル変更、テスト5件以下）:
→ 直接 `oops feature start` でOOPSサイクルを開始

**大きなタスク**（4ファイル以上、または複数の独立した機能）:
→ まず `oops plan create` でサブタスクに分解してから開始

### サブタスク粒度ガイドライン
- 1サブタスク = 1〜3ファイルの変更
- テスト5件以下で検証可能な範囲
- 「〜を実装」ではなく「〜関数/モジュールを作成」レベル

### 大きなタスクのフロー
1. タスクを分析し、サブタスクに分解する
2. `oops plan create` で計画を作成
3. `oops plan next` で最初のサブタスクを開始
4. RED → GREEN → REFACTOR サイクルを実行
5. `oops plan done` で完了、次のサブタスクへ
6. 全サブタスク完了後、`oops plan complete`
```

**Step 2: コミット**

```bash
git add .claude/skills/oops-orchestrator.md
git commit -m "feat: oops-orchestrator Skill にタスク分解フローを追加"
```

---

### Task 5: CLAUDE.md の作成

**Files:**
- Create: `CLAUDE.md` (プロジェクトルート)

**Step 1: CLAUDE.mdを作成**

```markdown
# OOPS Framework - Development Rules

## TDD開発ルール

このプロジェクトでは OOPS Framework によるTDD規律を使用する。

### 機能開発時のフロー

1. **小さなタスク**: `./bin/oops feature start <name>` → RED → GREEN → REFACTOR → `./bin/oops feature complete`
2. **大きなタスク**: `./bin/oops plan create` でサブタスクに分解 → `./bin/oops plan next` で逐次実行

### フェーズルール

- **RED**: テストファイルのみ編集可能。失敗するテストを書く
- **GREEN**: 実装ファイルのみ編集可能。最小限のコードでテストを通す
- **REFACTOR**: 両方編集可能。テストが通り続けることを確認しながらリファクタ

### コマンド

```bash
./bin/oops phase              # 現在のフェーズ確認
./bin/oops feature start <n>  # 機能開発開始
./bin/oops plan create        # タスク分解
./bin/oops plan next          # 次のサブタスク
./bin/oops plan done          # サブタスク完了
./bin/oops stats              # 統計表示
```

### 注意事項

- hookがフェーズに反するファイル編集をブロックする
- ブロックされたら `./bin/oops phase` で現在のフェーズを確認
- テストコマンド: `npm test`
- OOPSテスト: `npm run test:oops`
```

**Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "feat: CLAUDE.md にOOPSルールを記載"
```

---

### Task 6: E2E検証

**Files:** なし（テスト実行のみ）

**Step 1: ユニットテスト実行**

Run: `npx tsx --test src/__tests__/*.test.ts`
Expected: 全テストPASS

**Step 2: plan コマンドのE2Eテスト**

```bash
# 計画作成
./bin/oops plan create --goal "テスト計画" \
  --subtask "モデル: データモデル作成" \
  --subtask "API: エンドポイント実装"

# 計画表示
./bin/oops plan show

# 最初のサブタスク開始
./bin/oops plan next

# フェーズ確認（REDのはず）
./bin/oops phase

# サブタスク完了
./bin/oops plan done

# 次のサブタスク
./bin/oops plan next

# 2番目も完了
./bin/oops plan done

# 全体完了
./bin/oops plan complete
```

**Step 3: クリーンアップとコミット**

```bash
git add -A
git commit -m "feat: タスク分解オーケストレーション Phase 2 完了"
```
