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

### REFACTORフェーズでのコードレビュー

REFACTORフェーズに入ったら、サブエージェント（Agent tool）を使ってコードレビューを実施すること:
- RED/GREENフェーズで変更したファイルを対象にレビューサブエージェントを起動
- リファクタリング候補（命名改善、重複除去、関数分割など）を特定
- レビュー結果に基づいてリファクタリングを実施
- テストがグリーンを維持していることを確認してから `./bin/oops feature complete`

### TDDが不要なタスク

ドキュメント作成・統合テスト・設定変更などTDDサイクルが不適切なタスクには:
`./bin/oops feature start --no-tdd <name>` で非TDDモードを使用する。

### コマンド

```bash
./bin/oops phase              # 現在のフェーズ確認
./bin/oops feature start <n>  # 機能開発開始（小さなタスク）
./bin/oops feature start --no-tdd <n>  # 非TDDモードで開始
./bin/oops plan create        # タスク分解（大きなタスク）
./bin/oops plan next          # 次のサブタスク開始
./bin/oops plan done          # サブタスク完了
./bin/oops plan show          # 計画表示
./bin/oops stats              # 統計表示
```

### 注意事項

- hookがフェーズに反するファイル編集をブロックする
- ブロックされたら `./bin/oops phase` で現在のフェーズを確認
- `feature complete` はplanのサブタスクも自動的に完了させる
- テストコマンド: `npm test`
- OOPSテスト: `npm run test:oops`
