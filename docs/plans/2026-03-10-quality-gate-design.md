# OOPS Framework v1.3: 品質ゲート機能 設計ドキュメント

## 背景

OOPS FrameworkはTDDプロセス（RED→GREEN→REFACTOR）の強制には成功しているが、以下の品質問題が未対処：

1. **テスト品質**: LLMが書くテストが浅い（happy pathのみ、アサーション不足、異常系なし）
2. **非機能品質**: 実装コードのリンター違反やコード品質問題が検出されない

## 変更概要

既存のゲートチェックに2つの品質ゲートを追加：

1. **テスト品質ゲート**（RED → GREEN）: テストコードの静的解析 + オプションでカバレッジ
2. **非機能品質ゲート**（GREEN → REFACTOR）: 外部リンターコマンドの実行

品質ゲートは `mode: 'warn' | 'block'` で切替可能（デフォルト: warn）。

## 設計詳細

### Config拡張

```typescript
qualityGate: {
  mode: 'warn' | 'block';
  minTestCases: number;               // デフォルト: 3
  minAssertionsPerTest: number;        // デフォルト: 1
  requireErrorCases: boolean;          // デフォルト: true
  coverageCommand?: string;            // オプション
  minCoverage?: number;                // デフォルト: 80
  qualityCommand?: string;             // 外部リンターコマンド
}
```

### テスト品質チェック（RED → GREEN ゲート）

テストファイルを正規表現で静的解析：
- `it(`/`test(` の出現数 → テストケース数
- `expect(`/`assert` の出現数 → アサーション密度
- テスト名にエラー関連キーワード → 異常系テストの有無

### 非機能品質チェック（GREEN → REFACTOR ゲート）

configの `qualityCommand` を実行し、exit code で判定。
`oops init` 時にリンター設定を自動検出（ESLint, Biome, ruff, clippy等）。

### 対象ファイル

| ファイル | 変更 |
|---------|------|
| `src/types.ts` | 型追加 |
| `src/core/quality-checker.ts` | 新規作成 |
| `src/core/gate-checker.ts` | 品質チェック統合 |
| `src/core/project-detector.ts` | リンター自動検出追加 |
| `src/commands/init.ts` | init時のリンター検出 |
| `src/commands/phase.ts` | 品質警告表示 |
