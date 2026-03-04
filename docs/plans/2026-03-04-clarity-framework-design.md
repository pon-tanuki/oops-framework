# Clarity Framework 設計ドキュメント

## 概要

**Clarity Framework**は、LLM（大規模言語モデル）によるコード生成の品質と信頼性を向上させるためのTypeScript/Python向けフレームワークです。TDD（テスト駆動開発）の強制、コンテキスト汚染の防止、コード品質の保証を通じて、LLMが生成するコードの実用性を大幅に改善します。

## プロジェクトの背景

### 当初の目標

当初は「LLMに適した新しいプログラミング言語」の開発を検討していました。しかし、議論を深める中で以下の重要な気づきがありました：

1. **問題の本質は構文ではなくプロセス**: LLMのコード生成における課題は、言語の構文ではなく開発プロセスとガバナンスの問題
2. **実用性の優先**: 新言語の開発には数年かかり、エコシステムがゼロから始まる
3. **既存資産の活用**: TypeScript/Pythonなど既存言語のエコシステムを活用する方が現実的

### 方針転換

**新言語の開発** → **既存言語向けフレームワークの開発**

---

## LLMのコード生成における問題点（2025-2026年の研究結果）

### 学術研究からの知見

2025-2026年の最新研究により、以下の問題が明らかになっています：

#### 1. セマンティックエラー（意味的エラー）

| エラータイプ | 発生頻度 | 説明 |
|---|---|---|
| **条件エラー** | 最も一般的 | 条件の欠落や誤った条件分岐 |
| **定数値エラー** | 非常に多い | 関数引数、代入文などでの誤った定数値 |
| **参照エラー** | 頻繁 | 未定義変数/関数の参照 |
| **論理/数学演算エラー** | 多い | 演算子の誤用や計算ミス |
| **重要なステップの欠落** | 深刻 | タスク完了に必要な処理の省略 |

#### 2. シンタックスエラーより深刻な問題

**重要な発見**: LLMは小さなエラーより、**複数行にわたる非自明なエラー**を起こしやすい

#### 3. ハルシネーション vs 実行時エラー

- **ハルシネーション**（存在しないメソッド/ライブラリの発明）は、実は最も害が少ない
  - 理由: コンパイラ/インタープリターが即座に検出
- **本当に危険**: コンパイラで検出されず、実行時に問題を起こすエラー

#### 4. 非機能品質の問題

- LLM生成コードは機能的には正しくても、**品質が低い**ことが多い
- リファクタリングしたコードは信頼性が低い
- 既存研究は「テストが通るか」に集中し、「品質が高いか」を見ていない

#### 5. プロンプトの影響

- **短いプロンプト（<50語）の方が成功率が高い**
- 長いプロンプトは無意味なコードを生成する可能性が高まる

#### 6. 修正コストの問題

- LLM生成コードは正解と大きく異なることが多い
- **小さな修正では済まず、大規模な書き直しが必要**

### TDDがLLM開発で効果的な理由（実証結果）

#### 1. コンテキスト汚染の防止

**重要**: **LLMは動作するコードと壊れたコードを区別できない** - すべてコンテキストとして扱う

- テストが失敗したら、前回の動作するコミットにハードリセット
- 壊れたコードがコンテキストに混入するのを防ぐ

#### 2. 要件の明確化

- テストケースが**命令と検証の両方**として機能
- テストが「ユーザー定義のガードレール」として、LLMを正しい方向に誘導
- ハルシネーションを緩和

#### 3. 実証された効果

- テストケースを含めると、プログラミング課題の成功率が**一貫して向上**
- 「テストファースト」手法が技術的制約と認知的足場の両方を提供

### RED-GREEN-REFACTORサイクルの重要性

#### 課題

Claude CodeなどのLLMは**実装ファースト**がデフォルト - テストを後回しにする傾向

#### 解決策（2026年の実践例より）

マルチエージェントシステムで**厳格なRED-GREEN-REFACTORサイクルを強制**：

```
🔴 RED: 失敗するテストを書く
   ↓ (Do NOT proceed until...)
🟢 GREEN: 最小限のコードで通す
   ↓ (Do NOT proceed until...)
🔵 REFACTOR: クリーンアップ・改善
```

**各フェーズに明示的な「次に進むな」ゲートを設ける** - LLMには明確な境界が必要

### 実務上の追加問題

ユーザーヒアリングにより、以下の問題も判明：

1. **大量のコード生成 → エラーだらけ**
   - 一度に大きすぎる変更
   - インクリメンタルの欠如
   - 途中での検証がない

2. **ビジネスロジックが不完全**
   - 暗黙の前提を理解できない
   - エッジケース・例外処理の見落とし
   - ドメイン知識の欠如

3. **前日と今日のコードで一貫性がない**
   - LLMはステートレス（前回の判断を覚えていない）
   - プロジェクト全体の設計意図を理解していない
   - スタイルガイドの記憶がない

---

## Clarity Framework の設計

### 設計原則

1. **テストファースト強制**: テストなしでは実装できない
2. **インクリメンタル開発**: 小さなステップでの開発を強制
3. **一貫性の保証**: プロジェクト全体で規約を統一
4. **ドメイン知識の明示**: ビジネスルールを記述可能に
5. **コンテキスト汚染の防止**: 壊れたコードがLLMの参照に入らない
6. **品質の保証**: 機能だけでなく非機能品質も重視

### 対象言語

**Phase 1**: TypeScript（最優先）
**Phase 2**: Python

理由：
- LLMが最も得意とする言語
- 強力なエコシステム
- 型システムのサポート（TypeScript）

---

## コア機能

### 1. プロジェクト設定 (`clarity.config.ts`)

プロジェクト全体の規約とパターンを定義：

```typescript
export default {
  // アーキテクチャパターン
  architecture: "layered", // or "hexagonal", "clean", etc.

  // 命名規則
  namingConventions: {
    classes: "PascalCase",
    functions: "camelCase",
    constants: "UPPER_SNAKE_CASE",
    serviceSuffix: "Service",
    repositorySuffix: "Repository"
  },

  // 開発プロセス
  development: {
    testStrategy: "test-first-mandatory",
    commitStrategy: "each-red-green-refactor-cycle",
    maxLinesPerFunction: 50
  },

  // エラー処理
  errorHandling: {
    pattern: "Result",  // or "Exception"
    validation: "class-validator"
  }
}
```

### 2. TDD強制機構

RED-GREEN-REFACTORサイクルを強制：

```typescript
import { clarityTest, clarityImplement, clarityRefactor } from 'clarity-framework'

// 🔴 RED: まずテストを書く
clarityTest('UserService', 'createUser', () => {
  const service = new UserService()
  const result = service.createUser('test@example.com', 'password123')

  expect(result.isOk()).toBe(true)
  expect(result.value.email).toBe('test@example.com')
})

// 🟢 GREEN: テストが存在しないと実装できない
clarityImplement('UserService', 'createUser', () => {
  createUser(email: string, password: string): Result<User, Error> {
    return Ok(new User(email, password))
  }
})

// 🔵 REFACTOR: リファクタリング
clarityRefactor('UserService', 'createUser', () => {
  // 改善版
})
```

### 3. 実行時検証（Runtime Contracts）

コンパイルで検出できないエラー対策：

```typescript
import { runtimeGuard, RuntimeContract } from 'clarity-framework'

// 実行時契約を定義
const divideContract = RuntimeContract.define({
  preconditions: [
    { check: (a, b) => typeof a === 'number', message: 'a must be number' },
    { check: (a, b) => typeof b === 'number', message: 'b must be number' },
    { check: (a, b) => b !== 0, message: 'Division by zero' },
    { check: (a, b) => !isNaN(a) && !isNaN(b), message: 'NaN not allowed' }
  ],
  postconditions: [
    { check: (result) => !isNaN(result), message: 'Result cannot be NaN' },
    { check: (result) => isFinite(result), message: 'Result must be finite' }
  ]
})

@runtimeGuard(divideContract)
function divide(a: number, b: number): number {
  return a / b
}
```

### 4. 条件網羅性チェック

条件の欠落を検出：

```typescript
import { conditionCoverage } from 'clarity-framework'

@conditionCoverage({
  mustHandle: ['null', 'undefined', 'empty', 'negative', 'overflow']
})
function processUserAge(age: number | null | undefined): Result<string, Error> {
  if (age === null || age === undefined) {
    return Error("Age is required")
  }

  if (age < 0) {
    return Error("Age cannot be negative")
  }

  if (age > 150) {
    return Error("Age too large")
  }

  return Ok(`Age is ${age}`)
}
```

### 5. マジックナンバー検出

定数値エラー対策：

```typescript
import { noMagicNumbers } from 'clarity-framework'

@noMagicNumbers({
  allowed: [0, 1, -1, 100],
  requireConstants: true
})
function calculateDiscount(price: number): number {
  const DISCOUNT_THRESHOLD = 1000
  const DISCOUNT_RATE = 0.1

  if (price > DISCOUNT_THRESHOLD) {
    return price * DISCOUNT_RATE
  }

  return 0
}
```

### 6. 実行パストレース

重要なステップの欠落検出：

```typescript
import { requireSteps } from 'clarity-framework'

@requireSteps([
  'validate_input',
  'check_authorization',
  'database_transaction',
  'send_notification',
  'log_action'
])
async function processPayment(payment: Payment): Promise<Result<Receipt, Error>> {
  await step('validate_input', async () => {
    if (payment.amount <= 0) throw new Error("Invalid amount")
  })

  await step('check_authorization', async () => {
    if (!payment.user.isAuthorized()) throw new Error("Unauthorized")
  })

  await step('database_transaction', async () => {
    await db.payments.save(payment)
  })

  await step('send_notification', async () => {
    await emailService.send(payment.user.email, "Payment received")
  })

  await step('log_action', async () => {
    logger.info('Payment processed', payment.id)
  })

  return Ok(new Receipt(payment))
}
```

### 7. ドメインルール定義

ビジネスルールとエッジケースを明示：

```typescript
import { defineDomain, Rule, EdgeCase } from 'clarity-framework'

const UserRegistrationDomain = defineDomain({
  name: 'UserRegistration',

  rules: [
    Rule.unique('email', {
      message: 'Email must be unique',
      check: async (email) => !(await db.users.exists({ email }))
    }),

    Rule.pattern('email', {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Invalid email format'
    }),

    Rule.minLength('password', 8, {
      message: 'Password must be at least 8 characters'
    }),

    Rule.custom('passwordStrength', {
      validate: (pwd) => /[A-Za-z]/.test(pwd) && /[0-9]/.test(pwd),
      message: 'Password must contain letters and numbers'
    })
  ],

  edgeCases: [
    EdgeCase.nullInput({ expectError: 'ValidationError' }),
    EdgeCase.emptyString({ expectError: 'ValidationError' }),
    EdgeCase.duplicate({ expectError: 'Email already exists' }),
    EdgeCase.networkTimeout({ retry: 3, thenFail: true })
  ]
})

@enforcesDomain(UserRegistrationDomain)
async function registerUser(email: string, password: string): Promise<Result<User, Error>> {
  const user = new User(email, password)
  await db.users.save(user)
  return Ok(user)
}
```

### 8. 例示駆動開発（Example-Driven Development）

期待する動作を例で示す：

```typescript
import { defineExamples } from 'clarity-framework'

defineExamples('processOrder', {
  // 正常系
  given: { order: validOrder, amount: 100 },
  when: 'processOrder is called',
  then: { returns: 'Ok(receipt)', where: 'receipt.total === 100' },

  // 異常系
  examples: [
    {
      given: { amount: -10 },
      expect: 'Error("Invalid amount")'
    },
    {
      given: { items: [] },
      expect: 'Error("Order must contain items")'
    },
    {
      given: { items: Array(1001).fill(item) },
      expect: 'Error("Order too large")'
    }
  ]
})
```

### 9. コンテキスト汚染防止（多層防御）

壊れたコードがLLMのコンテキストに入るのを防ぐ：

```typescript
// clarity.config.ts
export default {
  contextProtection: {
    strategy: 'multi-layer',

    layers: {
      // Layer 1: ファイルシステム
      filesystem: {
        autoRevertOnFailure: true
      },

      // Layer 2: セッション管理
      session: {
        resetOnFailure: true,
        clearConversationHistory: true,
        startCleanSession: true
      },

      // Layer 3: マーキング
      marking: {
        markFailedCode: true,
        markSuccessfulCode: true,
        annotateWithMetadata: true
      },

      // Layer 4: コンテキスト選別
      contextFiltering: {
        excludeFailedCode: true,
        prioritizeGoldenExamples: true,
        maxContextAge: '7 days'
      },

      // Layer 5: 学習
      learning: {
        recordSuccessPatterns: true,
        recordFailurePatterns: true,
        applyPatternRecognition: true
      }
    }
  }
}
```

#### コンテキスト汚染防止の詳細

**問題の構造**:
1. LLMが壊れたコードを生成 → ファイルに書き込まれる → LLMのコンテキストに含まれる
2. テストが失敗
3. Git revert（ファイルは元に戻る）
4. **しかし、LLMの会話履歴には壊れたコードが残っている**

**多層防御アプローチ**:

##### Layer 1: ファイルシステム
```bash
$ clarity test run
✗ 3 tests failed

Reverting files to commit abc1234...
✓ Files reverted successfully
```

##### Layer 2: セッション管理
```bash
Actions taken:
1. ✓ Reverted files to commit abc1234
2. ✓ Reset LLM session (cleared conversation history)
3. ✓ Created new clean session

Next LLM interaction will start with clean context.
```

##### Layer 3: 明示的マーキング
```typescript
/*
 * CLARITY FRAMEWORK: INVALID CODE MARKER
 *
 * The following code failed tests and has been REVERTED:
 * - File: src/services/UserService.ts
 * - Reason: 3 unit tests failed
 *
 * This code is INVALID and should NOT be used as reference.
 */
```

```typescript
/*
 * CLARITY FRAMEWORK: VERIFIED CORRECT CODE
 *
 * The following implementation passed all tests:
 * - Tests passed: 15/15
 * - Code quality: 95/100
 *
 * This is a GOLDEN EXAMPLE of correct implementation.
 */
```

##### Layer 4: コンテキスト選別
```typescript
const context = new ClarityContext({
  excludeFiles: [
    '.clarity/failures/**',  // 失敗したコード
  ],

  priority: {
    high: ['.clarity/golden-examples/**'],  // 成功例を最優先
    medium: ['src/**'],
    low: ['.git/old-versions/**']
  }
})
```

### 10. コード品質メトリクス

非機能品質を測定：

```typescript
const codeQualityStandards = qualityMetrics.define({
  cyclomaticComplexity: { max: 10 },
  cognitiveComplexity: { max: 15 },
  maxNestingDepth: 3,
  maxFunctionLength: 50,
  duplicateThreshold: 5,
  commentRatio: { min: 0.1, max: 0.3 }
})

// チェック実行
$ clarity quality check

Analyzing code quality...

src/services/UserService.ts:
  ✗ createUser() has cyclomatic complexity of 15 (max: 10)
  ✗ createUser() has 78 lines (max: 50)

Summary: 2 quality issues found
Suggestion: Refactor createUser() into smaller functions
```

### 11. リファクタリング検証

リファクタリング前後で動作が変わらないことを保証：

```typescript
// リファクタリング前のスナップショット
await clarityRefactor.begin('UserService', 'createUser')

const behaviorSnapshot = await clarityRefactor.captureSnapshot({
  testCases: allTestCases,
  performanceMetrics: true,
  memoryUsage: true
})

// リファクタリング実行
// ... コードを変更 ...

// 検証
await clarityRefactor.verify({
  mustMatch: behaviorSnapshot,
  tolerance: {
    performance: 0.1,  // 10%の性能変動まで許容
    memory: 0.05
  }
})

// 結果
✓ All test cases still pass
✓ Performance: 98ms → 95ms (improved)
✓ Memory: 12.3MB → 12.1MB (improved)
✓ Refactoring verified successfully
```

### 12. 一貫性チェッカー（Linter）

プロジェクト全体の一貫性を検証：

```bash
$ clarity lint

Checking naming conventions...
✗ src/services/UserManager.ts: Should be "UserService"
✗ src/utils/add_numbers.ts: Should be "addNumbers"

Checking architecture compliance...
✗ src/controllers/UserController.ts: Directly accessing database
  Should use UserRepository instead

Checking test coverage...
✗ src/services/OrderService.ts: createOrder() has no tests

Summary: 4 issues found
```

### 13. インクリメンタル開発ガード

一度に大きな変更を防ぐ：

```typescript
// clarity.config.ts
export default {
  incrementalGuards: {
    maxLinesPerCommit: 200,
    maxFilesPerCommit: 5,
    requireTestsBeforeImplementation: true,
    requirePassingTestsBeforeRefactor: true
  }
}

// コミット時
$ git commit -m "Add user service"
✗ Commit rejected: 450 lines changed (max: 200)
  Suggestion: Break this into smaller commits
```

### 14. プロンプト長の管理

短いプロンプトでLLMに生成させる：

```typescript
@llmPromptGuard({
  maxWords: 50,
  autoSplit: true
})
async function generateComplexFeature(requirements: string) {
  // requirementsが50語を超える場合、自動的に分割
}

// 実行例
$ clarity generate --feature "user-registration"
⚠️ Feature description too long (120 words)
Automatically splitting into 3 subtasks:
  1. Create User model (25 words)
  2. Add validation logic (30 words)
  3. Implement database persistence (28 words)
```

---

## アーキテクチャ

```
Clarity Framework
├── Core
│   ├── TDD Enforcer (RED-GREEN-REFACTOR)
│   ├── Project Configuration
│   └── Incremental Guards
│
├── Error Prevention
│   ├── Runtime Contracts
│   ├── Condition Coverage
│   ├── Magic Number Detection
│   ├── Execution Path Tracer
│   └── Reference Validator
│
├── Quality Assurance
│   ├── Quality Metrics
│   ├── Refactoring Verification
│   └── Code Review Automation
│
├── LLM Integration
│   ├── Context Protection (Multi-layer)
│   ├── Prompt Length Manager
│   └── Auto-Revert on Failure
│
└── Domain Modeling
    ├── Domain Rules
    ├── Example-Driven Development
    └── Consistency Checker
```

---

## 開発ワークフロー

### 典型的な開発サイクル

```bash
# 1. 新機能を開始
$ clarity feature start "user-registration"

# 2. ドメインルールを定義
$ clarity domain create UserRegistration

# 3. テストを書く（RED）
$ clarity test create UserService.registerUser

# 4. 実装（GREEN）
$ clarity implement UserService.registerUser

# 5. 一貫性チェック
$ clarity lint

# 6. テスト実行
$ clarity test run

# 7. リファクタリング（REFACTOR）
$ clarity refactor UserService.registerUser

# 8. コミット
$ git commit -m "Add user registration"
# → Clarityが自動でチェック（テスト有無、コード量、一貫性）
```

---

## 技術スタック

### 実装言語
TypeScript

### 依存ライブラリ
- **テスト**: Jest / Vitest
- **バリデーション**: class-validator, zod
- **型**: TypeScript strict mode
- **CLI**: Commander.js
- **AST解析**: ts-morph
- **Linting**: ESLint拡張

---

## 実装計画

### Phase 1: MVP（1ヶ月）

**目標**: 基本的なTDD強制とプロジェクト設定

**機能**:
- プロジェクト設定ファイル（`clarity.config.ts`）
- 基本的なTDD強制機構（RED-GREEN-REFACTOR）
- 一貫性チェッカー（命名規則）
- CLI基盤

**成果物**:
- `clarity` CLI ツール
- 基本的なドキュメント
- サンプルプロジェクト

### Phase 2: コア機能（2ヶ月）

**目標**: エラー防止と品質保証

**機能**:
- 実行時契約（Runtime Contracts）
- 条件網羅性チェック
- マジックナンバー検出
- 実行パストレース
- ドメインルール定義
- 例示駆動開発
- コード品質メトリクス
- インクリメンタル開発ガード

**成果物**:
- 完全機能のフレームワーク
- 包括的なドキュメント
- チュートリアル

### Phase 3: 統合・エコシステム（3ヶ月）

**目標**: ツール統合と普及

**機能**:
- VSCode拡張
- GitHub Actions統合
- Claude Code / Cursor統合
- コンテキスト汚染防止（多層防御）
- プロンプト長管理
- リファクタリング検証
- ダッシュボード（Web UI）

**成果物**:
- VSCode拡張パッケージ
- GitHub Marketplace への公開
- 公式ウェブサイト
- コミュニティフォーラム

---

## 成功指標

研究結果に基づく測定可能な目標：

| 指標 | 目標値 | 根拠 |
|---|---|---|
| **条件エラー削減** | 70%減 | 最も一般的なエラー |
| **実行時エラー検出率** | 90%以上 | 最も危険なエラー |
| **マジックナンバー** | ゼロ | 定数エラー対策 |
| **ステップ欠落** | ゼロ | 実行パストレースで保証 |
| **コンテキスト汚染** | ゼロ | 多層防御で防止 |
| **平均プロンプト長** | <50語 | 研究結果に基づく |
| **コード品質スコア** | 80点以上 | 非機能品質の保証 |
| **修正コスト** | 50%削減 | インクリメンタル開発の効果 |
| **テストカバレッジ** | 80%以上 | TDD強制の効果 |
| **一貫性スコア** | 90%以上 | プロジェクト規約の統一 |

---

## リスクと対策

### リスク1: 学習曲線が急

**対策**:
- 段階的な導入（既存プロジェクトに少しずつ適用）
- 豊富なサンプルとチュートリアル
- プリセット設定（デフォルトで使える設定）

### リスク2: パフォーマンスオーバーヘッド

**対策**:
- 開発時のみチェック（本番ビルドでは無効化可能）
- キャッシング機構
- 並列処理

### リスク3: 既存ツールとの競合

**対策**:
- ESLint、Prettier等との共存
- 段階的な移行パス
- 既存設定のインポート機能

### リスク4: LLMツールの進化

**対策**:
- プラグイン機構（新しいLLMツールに対応可能）
- オープンな設計
- コミュニティ駆動の開発

---

## 次のステップ

1. **実装計画の詳細化**: Phase 1の詳細なタスク分解
2. **プロトタイプ開発**: 2週間でMVPのプロトタイプ
3. **アーリーアダプターの募集**: フィードバック収集
4. **継続的改善**: ユーザーフィードバックに基づく改善

---

## 参考文献

- "Towards Understanding the Characteristics of Code Generation Errors Made by Large Language Models" (ICSE 2025)
- "Test-Driven Development for Code Generation" (arXiv 2024)
- "Why Does Test-Driven Development Work So Well In AI-assisted Programming?" (2026)
- "Claude Code and the Art of Test-Driven Development" (The New Stack, 2025)
- "My LLM coding workflow going into 2026" (Addy Osmani, Medium)

---

## まとめ

Clarity Frameworkは、LLMによるコード生成の問題を解決するための包括的なソリューションです。学術研究と実務経験に基づき、以下を実現します：

1. **品質の向上**: エラーの70%削減、品質スコア80点以上
2. **プロセスの改善**: TDD強制、インクリメンタル開発
3. **一貫性の保証**: プロジェクト全体で統一された規約
4. **コンテキストの保護**: LLMが正確なコードを生成するための環境

新しい言語を作るのではなく、既存のエコシステムを活用することで、実用的で採用しやすいフレームワークを目指します。
