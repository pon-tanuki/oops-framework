# タスク分解オーケストレーション設計

## 課題

OOPSフレームワークは1つのOOPSサイクル（RED→GREEN→REFACTOR）のTDD規律を強制できるが、大きなタスク（「販売管理システムを開発して」）を受けた場合、LLMが1回の巨大なサイクルで全てを実装しようとする問題がある。

## 解決策: Skill拡張アプローチ（2層構造）

- **上位層（Skill + plan.json）**: タスク分解・進捗管理・次のサブタスクへの誘導
- **下位層（既存hook）**: 各サイクル内のRED/GREEN/REFACTORファイル制限

### フロー

```
人間: 「販売管理システムを開発して」
  ↓
Skill指示: 「oops plan create でタスクを分解せよ」
  ↓
LLM: plan.json にサブタスクリストを保存
  ↓
oops plan next → oops feature start（自動）→ RED
  ↓
RED → GREEN → REFACTOR → oops plan done
  ↓
plan.json 更新 → oops plan next → 次のサブタスク
  ↓
全完了 → oops plan complete
```

## plan.json データ構造

```jsonc
{
  "goal": "販売管理システムを開発",
  "createdAt": "2026-03-05T...",
  "status": "planning | in_progress | completed",
  "currentSubtask": 1,
  "subtasks": [
    {
      "id": 1,
      "name": "商品モデル定義",
      "description": "Product型とバリデーション関数を実装",
      "status": "pending | in_progress | completed | skipped",
      "oopsCount": 0,
      "cycles": 0
    }
  ]
}
```

### サブタスク粒度ガイドライン

- 1サブタスク = 1〜3ファイルの変更
- テスト5件以下で検証可能な範囲
- 「〜を実装」ではなく「〜関数/モジュールを作成」レベル

## CLIコマンド

```bash
oops plan create --goal "目標" --subtask "名前: 説明" ...
oops plan show          # 計画表示
oops plan next          # 次のサブタスクを開始
oops plan done          # 現在のサブタスクを完了
oops plan complete      # 全体完了
oops plan add --subtask "名前: 説明"
oops plan skip <id>
```

### plan next の動作

1. plan.jsonから次の`pending`サブタスクを取得
2. サブタスクを`in_progress`に更新
3. `oops feature start <name>` を内部で呼び出し → RED

### plan done の動作

1. `oops feature complete` を内部で呼び出し
2. サブタスクを`completed`に更新、oopsCount/cycles記録
3. 次のサブタスクがあれば表示

## 変更対象

| ファイル | 種別 | 内容 |
|---------|------|------|
| src/types.ts | 編集 | OopsPlan, Subtask 型追加 |
| src/core/plan-manager.ts | 新規 | plan.json CRUD |
| src/commands/plan.ts | 新規 | plan サブコマンド |
| src/cli/index.ts | 編集 | plan コマンド登録 |
| .claude/skills/oops-orchestrator.md | 編集 | タスク分解フロー追加 |
| CLAUDE.md | 新規 | OOPSルール記載 |
| src/__tests__/plan-manager.test.ts | 新規 | ユニットテスト |

既存のhook・state-manager・featureコマンドは変更不要。

## 設計方針

- サブタスク間の遷移はSkillの指示で誘導（hookによる強制なし）
- 各サイクル内のTDD規律は既存hookで強制
- plan.jsonに計画を永続化（セッション跨ぎ対応）
