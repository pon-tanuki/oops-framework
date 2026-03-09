---
name: oops-orchestrator
description: Use when starting a TDD session with the OOPS Framework. Guides the RED-GREEN-REFACTOR cycle and manages phase transitions.
---

# OOPS Orchestrator

You are managing a TDD session using the OOPS Framework. Follow these rules strictly.

## Task Decomposition (大きなタスクの場合)

機能開発の指示を受けたら、まずタスクの規模を判断する。

**小さなタスク**（1〜3ファイル変更、テスト5件以下）:
→ 直接 `./bin/oops feature start <name>` でOOPSサイクルを開始

**大きなタスク**（4ファイル以上、または複数の独立した機能）:
→ まず `./bin/oops plan create` でサブタスクに分解してから開始

### サブタスク粒度ガイドライン
- 1サブタスク = 1〜3ファイルの変更
- テスト5件以下で検証可能な範囲
- 「〜を実装」ではなく「〜関数/モジュールを作成」レベル

### 大きなタスクのフロー
1. タスクを分析し、サブタスクに分解する
2. `./bin/oops plan create --goal "目標" --subtask "名前: 説明" ...` で計画を作成
3. `./bin/oops plan next` で最初のサブタスクを開始（→ RED phase）
4. RED → GREEN → REFACTOR サイクルを実行
5. `./bin/oops plan done` で完了、次のサブタスクへ
6. 全サブタスク完了後、`./bin/oops plan complete`

## Phase Overview

| Phase | Allowed Files | Goal |
|-------|--------------|------|
| RED | Test files only | Write failing tests |
| GREEN | Implementation files only | Make tests pass (minimal code) |
| REFACTOR | Both (tests warned) | Improve code, tests must stay passing |

## Workflow

### Starting a Feature
```bash
./bin/oops feature start <feature-name>
```
This sets the phase to RED automatically.

### Starting a Non-TDD Task
ドキュメント作成・統合テスト・設定変更など、TDDサイクルが不適切なタスクには：
```bash
./bin/oops feature start --no-tdd <feature-name>
```
NONEフェーズのまま作業でき、ファイル編集の制限を受けない。

### RED Phase
1. Write test files that describe the desired behavior
2. Run tests to confirm they FAIL: `npm test`
3. When tests are failing as expected, check the gate:
   ```bash
   ./bin/oops gate red-to-green
   ```
4. Transition to GREEN:
   ```bash
   ./bin/oops phase green
   ```

### GREEN Phase
1. Write the MINIMUM implementation to make tests pass
2. Do NOT refactor yet - just make it work
3. Run tests to confirm they PASS: `npm test`
4. Check the gate:
   ```bash
   ./bin/oops gate green-to-refactor
   ```
5. Transition to REFACTOR:
   ```bash
   ./bin/oops phase refactor
   ```

### REFACTOR Phase
1. サブエージェント（Agent tool）を使ってコードレビューを実施する
   - RED/GREENフェーズで変更したファイルを対象にレビューサブエージェントを起動
   - リファクタリング候補（命名改善、重複除去、関数分割など）を特定
2. レビュー結果に基づいてリファクタリングを実施
3. Run tests after EVERY change to ensure they still pass
4. Do NOT add new functionality
5. When done, complete the feature:
   ```bash
   ./bin/oops feature complete
   ```

### Completing a Feature
```bash
./bin/oops feature complete
```
`feature complete` はplanが存在する場合、in_progressのサブタスクを自動的にcompletedにする。
`oops plan done` → `oops plan next` の代わりに、`oops feature complete` → `oops plan next` でも同じ動作になる。

## Key Rules
- NEVER skip phases. RED → GREEN → REFACTOR → RED
- The PreToolUse hook will BLOCK invalid file edits
- If blocked, check current phase: `./bin/oops phase`
- Gate checks are mandatory for transitions
- Use `--force` only as a last resort
