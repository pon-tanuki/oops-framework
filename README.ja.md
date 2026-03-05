# 🙊 OOPS Framework

**No more "Oops, I broke it again!" 💥**

LLMにコードを書かせたら、テストも書かずにいきなり実装を始めた。
動かしてみたら壊れてた。

> 「Oops...😅」

そんな経験、ありませんか？

OOPS Frameworkは、**LLM（Claude Code）にTDDの規律を物理的に強制する**フレームワークです。
「テストを先に書いてね🙏」とお願いするんじゃなくて、**書かないと実装ファイルを触れなくする**。お願いじゃない、強制だ 🔒

---

## 🔧 How It Works

Claude Code Hooksを使って、ファイル編集を**フェーズに応じてブロック**します。

```
  🔴 RED Phase           🟢 GREEN Phase         🔄 REFACTOR Phase
  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐
  │ Test files   │    │ Impl files   │    │ Both files     │
  │ ✅ ALLOWED   │    │ ✅ ALLOWED   │    │ ✅ ALLOWED     │
  │              │    │              │    │                │
  │ Impl files   │    │ Test files   │    │ (tests must    │
  │ 🚫 BLOCKED  │    │ 🚫 BLOCKED  │    │  stay passing) │
  └─────────────┘    └──────────────┘    └────────────────┘
```

LLMが「ちょっとだけ実装も...😏」と思っても：

```
  🤖 Claude: Edit src/calculator.js
  🚨 Hook: Phase: RED - Only test files allowed. Cannot modify: src/calculator.js
```

**Oops! 🙊** ブロックされちゃいました。テストを先に書きましょ！

---

## 🚀 Quick Start

```bash
# インストール 📦
npm install -g oops-framework

# プロジェクトで初期化
cd your-project
oops init

# 機能開発を開始（自動でREDフェーズ 🔴）
oops feature start add-login

# テストを書く ✍️（REDフェーズ：テストファイルのみ編集可能）
# ... テストを書く ...

# GREENフェーズに遷移 🟢（実装ファイルのみ編集可能）
oops phase green

# 最小限の実装を書く 💻
# ... 実装を書く ...

# REFACTORフェーズに遷移 🔄（両方編集可能）
oops phase refactor

# リファクタリング ✨（テストが通り続けることを確認）
# ... リファクタ ...

# 機能完了！🎉
oops feature complete
```

---

## 📊 The "Oops" Counter

フェーズに反するファイル編集を試みるたびに、Oopsカウンターが増えちゃいます 😱

```
$ oops stats

📊 OOPS Framework Statistics
===================================
  Phase:     GREEN 🟢
  Oops Count: 3  💀💀💀
  Last Oops:  2026-03-05T01:23:45.000Z
```

Oops 0で機能を完了すると... 🏆

```
$ oops feature complete

  ✅ Feature completed: add-login
  🙊 Oops prevented: 0

  🎉 Perfect TDD cycle! No oops!
```

やったね！✨

---

## 🧩 Task Decomposition

「販売管理システムを作って」みたいな大きなタスクだって大丈夫 💪

OOPSが自動でサブタスクに分解して、それぞれにTDDサイクルを適用するよ！

```bash
# タスクを分解 📋
oops plan create \
  --goal "販売管理システム" \
  --subtask "商品モデル: Product型とバリデーション" \
  --subtask "商品CRUD: APIエンドポイント" \
  --subtask "在庫管理: 入出庫ロジック"

# サブタスクを順番にこなしていく 🏃‍♂️
oops plan next    # → 商品モデル (RED 🔴 phase)
# ... RED → GREEN → REFACTOR ...
oops plan done    # → 完了！次へ ✅

oops plan next    # → 商品CRUD (RED 🔴 phase)
# ...
oops plan done    # ✅

oops plan next    # → 在庫管理 (RED 🔴 phase)
# ...
oops plan done    # ✅

oops plan complete  # 🎉 全体完了！
```

各サブタスクがOOPSサイクルでガッチリ保護されます 🛡️

---

## 📖 Commands

| Command | Description |
|---------|-------------|
| `oops init` | 🏗️ フレームワークを初期化 |
| `oops phase` | 👀 現在のフェーズを表示 |
| `oops phase red\|green\|refactor\|none` | 🔀 フェーズを遷移 |
| `oops feature start <name>` | 🚀 機能開発を開始（→ RED 🔴） |
| `oops feature complete` | 🎉 機能を完了（→ NONE） |
| `oops gate` | 🚦 ゲートチェック（遷移条件の確認） |
| `oops stats` | 📊 統計を表示 |
| `oops plan create` | 📋 タスク分解計画を作成 |
| `oops plan show` | 🗺️ 計画を表示 |
| `oops plan next` | ▶️ 次のサブタスクを開始 |
| `oops plan done` | ✅ サブタスクを完了 |
| `oops plan complete` | 🏆 計画全体を完了 |

---

## 🤖 Claude Code Integration

OOPS Frameworkは[Claude Code Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)で動作します。
人間がやることは今まで通り — Claude Codeに「○○作って」って言うだけ！
あとはOOPSがClaude CodeにTDDの規律を叩き込みます 🥋

### Hooks 🪝

- **PreToolUse** — Edit/Write/NotebookEditをインターセプト。フェーズに反したら即ブロック 🚫
- **PostToolUse** — ファイル変更後にテストを自動実行 🧪（オプション）

### Skills 📚

`.claude/skills/`に3つのスキルが入ってます：

- **oops-orchestrator** 🎭 — TDDセッション全体の指揮者
- **oops-test-writer** ✍️ — REDフェーズでのテスト作成をサポート
- **oops-implementation** 💻 — GREENフェーズでの最小実装をガイド

---

## 🤔 Why "OOPS"?

**O**rchestrated **O**bligatory **P**rocess **S**ystem

「義務的プロセスをオーケストレーションするシステム」...なんてカッコいい名前だけど、本当の意味は：

> 🙊 LLMが「Oops」と言わなくて済むようにするフレームワーク。

テストなしでコードを書いて壊す「Oops」を、hookが防いでくれます。
それでもルール破りしようとしたら？カウンターがしっかり記録してますよ 👀

**Oops 0を目指せ！** 🏆

---

## 📄 License

MIT
