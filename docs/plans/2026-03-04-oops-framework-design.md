# OOPS Framework 設計ドキュメント
## Orchestrated Obligatory Process System
### マルチエージェント・アーキテクチャによるLLM向けTDD強制フレームワーク

**タグライン**: "No more 'Oops, I broke it again'"

---

## エグゼクティブサマリー

**OOPS (Orchestrated Obligatory Process System)** は、LLM（大規模言語モデル）に**RED-GREEN-REFACTORサイクルを強制**するマルチエージェント・フレームワークです。

### 名前の由来

**OOPS**には二重の意味があります：

1. **Orchestrated Obligatory Process System**（正式名称）
   - エージェントによってオーケストレーションされた
   - 義務的な（強制された）
   - プロセス管理システム

2. **"Oops!"**（感嘆詞）
   - LLMが失敗した時の「おっと！」
   - 「また壊しちゃった」を防ぐ
   - ブラックユーモア：名前は「失敗」だが、実際は失敗を防ぐ

### コアコンセプト

> **LLMに「一度に全部やらせない」**
> 役割を分離した専門エージェントが、段階的に開発を進める

### 従来の問題

```
❌ 事後対処型
LLM → 大量のコード生成 → エラー発生 → "Oops!" → revert
```

### OOPSのアプローチ

```
✓ 事前防止型
LLM → 小さなステップ → 検証 → 次のステップ
      ↑各ステップで専門エージェントが担当
      → No more "Oops!"
```

---

## 目次

1. [プロジェクトの背景](#プロジェクトの背景)
2. [LLMのコード生成における問題点](#llmのコード生成における問題点)
3. [設計の変遷](#設計の変遷)
4. [マルチエージェント・アーキテクチャ](#マルチエージェントアーキテクチャ)
5. [各エージェントの詳細仕様](#各エージェントの詳細仕様)
6. [ゲート条件](#ゲート条件)
7. [実装方式](#実装方式)
8. [実装計画](#実装計画)
9. [成功指標](#成功指標)
10. [参考文献](#参考文献)

---

## プロジェクトの背景

### 当初の目標

**「LLMに適した新しいプログラミング言語」**の開発を検討

### 方針転換の経緯

議論を深める中で以下の重要な気づき：

1. **問題の本質は構文ではなくプロセス**
   - LLMのコード生成における課題は、言語の構文ではなく開発プロセスとガバナンスの問題

2. **実用性の優先**
   - 新言語の開発には数年かかり、エコシステムがゼロから始まる

3. **既存資産の活用**
   - TypeScript/Pythonなど既存言語のエコシステムを活用する方が現実的

### 最終的な方針

**新言語の開発** → **既存言語向けフレームワークの開発** → **OOPS Framework**

---

## LLMのコード生成における問題点

### "Oops!"が起きる理由

LLMが「おっと！」となる典型的なパターン：

1. **"Oops, I forgot to test!"** - テストを書かずに実装
2. **"Oops, I broke the tests!"** - テストを変更して壊す
3. **"Oops, I wrote too much!"** - 一度に大量のコードを生成
4. **"Oops, I misunderstood!"** - 要件を誤解して実装

### 学術研究からの知見（2025-2026年）

#### 1. セマンティックエラー（意味的エラー）が主要な問題

| エラータイプ | 発生頻度 | "Oops"の種類 |
|---|---|---|
| **条件エラー** | 最も一般的 | "Oops, I missed a condition!" |
| **定数値エラー** | 非常に多い | "Oops, wrong number!" |
| **参照エラー** | 頻繁 | "Oops, undefined variable!" |
| **論理/数学演算エラー** | 多い | "Oops, wrong operator!" |
| **重要なステップの欠落** | 深刻 | "Oops, I forgot a step!" |

**重要な発見**: LLMは小さなエラーより、**複数行にわたる非自明なエラー**を起こしやすい

#### 2. ハルシネーション vs 実行時エラー

- **ハルシネーション**（存在しないメソッド/ライブラリの発明）は、実は最も害が少ない
  - 理由: コンパイラ/インタープリターが即座に検出
  - "Oops, that doesn't exist!" → すぐわかる

- **本当に危険**: コンパイラで検出されず、実行時に問題を起こすエラー
  - "Oops, it compiled but crashed!" → 発見が遅れる

#### 3. 非機能品質の問題

- LLM生成コードは機能的には正しくても、**品質が低い**ことが多い
- "Oops, it works but it's ugly!"

#### 4. プロンプトの影響

- **短いプロンプト（<50語）の方が成功率が高い**
- 長いプロンプトは無意味なコードを生成する可能性が高まる
- "Oops, I got confused by the long instruction!"

#### 5. 修正コストの問題

- LLM生成コードは正解と大きく異なることが多い
- **小さな修正では済まず、大規模な書き直しが必要**
- "Oops, need to start over!"

### TDDがLLM開発で効果的な理由（実証結果）

#### 1. "Oops"の連鎖を防ぐ

**重要**: **LLMは動作するコードと壊れたコードを区別できない** - すべてコンテキストとして扱う

- 壊れたコードがコンテキストに混入
- → LLMが壊れたコードを参照
- → さらに壊れたコードを生成
- → "Oops, oops, oops..." の連鎖

**OOPSの解決策**:
- テストが失敗したら、前回の動作するコミットにハードリセット
- 壊れたコードがコンテキストに混入するのを防ぐ
- → "Oops"の連鎖を断ち切る

#### 2. 要件の明確化

- テストケースが**命令と検証の両方**として機能
- テストが「ユーザー定義のガードレール」として、LLMを正しい方向に誘導
- "What should I do?" → "Make these tests pass!"

#### 3. 実証された効果

- テストケースを含めると、プログラミング課題の成功率が**一貫して向上**
- 「テストファースト」手法が技術的制約と認知的足場の両方を提供

### RED-GREEN-REFACTORサイクルの重要性

#### 課題

Claude CodeなどのLLMは**実装ファースト**がデフォルト - テストを後回しにする傾向

結果：
- "Oops, I forgot to write tests!"
- "Oops, the tests don't match the implementation!"

#### 解決策（2026年の実践例より）

マルチエージェントシステムで**厳格なRED-GREEN-REFACTORサイクルを強制**：

```
🔴 RED: 失敗するテストを書く
   ↓ (Do NOT proceed until...)
   ✓ "Oops"を起こす前にテストで仕様を固める

🟢 GREEN: 最小限のコードで通す
   ↓ (Do NOT proceed until...)
   ✓ テストが成功 → "No oops here!"

🔵 REFACTOR: クリーンアップ・改善
   ↓
   ✓ テストが保護 → "Safe to refactor, no oops!"
```

**各フェーズに明示的な「次に進むな」ゲートを設ける** - LLMには明確な境界が必要

### 実務上の追加問題

ユーザーヒアリングにより、以下の"Oops"も判明：

1. **"Oops, I wrote 500 lines at once!"**
   - 一度に大きすぎる変更
   - インクリメンタルの欠如
   - 途中での検証がない

2. **"Oops, I forgot the edge cases!"**
   - 暗黙の前提を理解できない
   - エッジケース・例外処理の見落とし
   - ドメイン知識の欠如

3. **"Oops, I used a different style today!"**
   - LLMはステートレス（前回の判断を覚えていない）
   - プロジェクト全体の設計意図を理解していない

---

## 設計の変遷

### v1.0の設計（廃案・"Clarity"）

**アプローチ**: 複雑なDSL、実行時契約、多層防御など14の機能

**問題点**:
1. **事後対処型**: エラーを検出して戻すだけ（"Oops"が起きた後の対処）
2. **スコープが広すぎる**: 14機能は多すぎて焦点がぼやける
3. **実現可能性の疑問**: LLMセッションリセットなど技術的に困難な機能
4. **複雑なDSL**: 学習コストが高い → "Oops, I don't understand the framework!"

### v2.0の設計（本設計・"OOPS"）

**アプローチ**: マルチエージェント・アーキテクチャによるプロセス強制

**コアアイデア**:
- **LLMに「一度に全部やらせない」** → "Oops"を起こす余地をなくす
- 役割を分離した専門エージェントが段階的に開発
- ファイルアクセス制限とシステムプロンプトで物理的に強制

**利点**:
1. **事前防止型**: "Oops"を起こさせない
2. **焦点が明確**: TDDサイクルの強制に集中
3. **実現可能**: ファイルシステムとプロンプト生成で実装可能
4. **シンプル**: 既存のJest/TypeScriptをそのまま使用

---

## マルチエージェント・アーキテクチャ

### 全体像

```
User
  ↓ "Add user registration feature"

┌─────────────────────────────────────────┐
│  Orchestrator Agent                     │
│  - ワークフローを管理                   │
│  - 各フェーズを順番に実行               │
│  - ゲート条件をチェック                 │
│  - "Oops"を防ぐ                         │
└─────────────────────────────────────────┘
  ↓
  ├── Phase 1: RED ────────────────────┐
  │                                    │
  │  ┌──────────────────────────────┐  │
  │  │ Test Writer Agent            │  │
  │  │ Role: テストのみを書く       │  │
  │  │ Can: *.test.ts を編集        │  │
  │  │ Cannot: 実装ファイルを見る   │  │
  │  │ Prevents: "Oops, I wrote     │  │
  │  │           implementation!"   │  │
  │  └──────────────────────────────┘  │
  │                                    │
  │  Output: UserService.test.ts       │
  │  Gate: ✓ テスト存在 ✓ テスト失敗  │
  └────────────────────────────────────┘
  ↓
  ├── Phase 2: GREEN ──────────────────┐
  │                                    │
  │  ┌──────────────────────────────┐  │
  │  │ Implementation Agent         │  │
  │  │ Role: 実装のみを書く         │  │
  │  │ Can: *.ts を編集             │  │
  │  │ Cannot: テストを変更         │  │
  │  │ Prevents: "Oops, I changed   │  │
  │  │           the tests!"        │  │
  │  └──────────────────────────────┘  │
  │                                    │
  │  Output: UserService.ts            │
  │  Gate: ✓ 全テスト成功             │
  │  Result: No oops! 🎉              │
  └────────────────────────────────────┘
  ↓
  └── Phase 3: REFACTOR (Optional) ────┐
                                       │
     ┌──────────────────────────────┐  │
     │ Refactor Agent               │  │
     │ Role: コード改善             │  │
     │ Can: 実装を編集              │  │
     │ Must: テストを保つ           │  │
     │ Prevents: "Oops, I broke     │  │
     │           everything!"       │  │
     └──────────────────────────────┘  │
                                       │
     Output: Refactored code            │
     Gate: ✓ 全テスト成功（維持）      │
     Result: Still no oops! 🎉         │
     └────────────────────────────────┘
```

### 設計の要点

| 要素 | 説明 | "Oops"防止効果 |
|---|---|---|
| **エージェント分離** | 各フェーズで異なるエージェントを使用 | "Oops, I did everything at once!" を防ぐ |
| **ファイル制限** | エージェントごとに編集可能なファイルを制限 | "Oops, I changed the wrong file!" を防ぐ |
| **システムプロンプト** | 各エージェントに専用の役割を明示 | "Oops, I forgot my role!" を防ぐ |
| **ゲート条件** | フェーズ間の移行条件を厳格にチェック | "Oops, I skipped a step!" を防ぐ |
| **強制機構** | LLMの行動を物理的に制約 | "Oops, I ignored the rules!" を防ぐ |

---

## 各エージェントの詳細仕様

### 1. Orchestrator Agent（オーケストレーター）

#### 責務

- ユーザーリクエストを受け取る
- 適切なフェーズに分解
- 各フェーズのエージェントを起動
- ゲート条件をチェック
- 次のフェーズに進むか判断
- **"Oops"の発生を監視**

#### 入力

```typescript
{
  request: "Add user registration feature",
  requirements: [
    "Email validation",
    "Password strength check",
    "Duplicate email prevention"
  ]
}
```

#### プロセスフロー

```typescript
1. ユーザーリクエストを分析
2. フィーチャーを小さなタスクに分解
3. RED-GREEN-REFACTORサイクルを開始

for each task:
  Phase 1 (RED):
    - Test Writer Agentを起動
    - テストが書かれるまで待つ
    - Gate: テストが失敗することを確認
    - If gate fails: "Oops, tests are passing (shouldn't be)!"

  Phase 2 (GREEN):
    - Implementation Agentを起動
    - 実装が完了するまで待つ
    - Gate: テストが成功することを確認
    - If gate fails: "Oops, tests are still failing!"

  Phase 3 (REFACTOR - optional):
    - ユーザーに確認
    - Refactor Agentを起動
    - Gate: テストが維持されることを確認
    - If gate fails: "Oops, refactoring broke the tests!"
```

#### 出力

```typescript
{
  status: "completed",
  oopsCount: 0,  // "Oops"が発生した回数
  phases: [
    { phase: "RED", status: "passed", output: "UserService.test.ts" },
    { phase: "GREEN", status: "passed", output: "UserService.ts" },
    { phase: "REFACTOR", status: "skipped" }
  ],
  commits: [
    "abc1234: Add user registration tests (RED)",
    "def5678: Implement user registration (GREEN)"
  ],
  message: "✓ No oops! Feature completed successfully."
}
```

---

### 2. Test Writer Agent（テストライター）

#### 役割

テストのみを書く専門家

#### 制約

- **Can**: `*.test.ts`, `*.spec.ts` ファイルを作成・編集
- **Cannot**: 実装ファイル（`*.ts` 除く `*.test.ts`）を見る、編集する
- **Must**: テストは失敗する（RED フェーズ）

#### "Oops"防止メカニズム

| "Oops"の種類 | 防止方法 |
|---|---|
| "Oops, I wrote implementation!" | 実装ファイルへのアクセスをブロック |
| "Oops, tests are passing!" | ゲートで検出し、やり直しを要求 |
| "Oops, no edge cases!" | プロンプトでエッジケースを明示的に要求 |

#### システムプロンプト

```markdown
# Role: Test Writer

You are a test-first developer writing tests ONLY.

**IMPORTANT**: Prevent "Oops, I wrote implementation!" by focusing ONLY on tests.

## Your Task
Write comprehensive tests for: {{feature}}

## Requirements
{{requirements}}

## Rules (STRICT - No "Oops" allowed!)
1. Write ONLY test code
2. DO NOT write any implementation
3. Tests MUST fail (no implementation exists yet)
4. Cover happy path, edge cases, and error cases
5. Use descriptive test names

## "Oops" Prevention Checklist
- [ ] Did I write ONLY tests? (not implementation)
- [ ] Do ALL tests fail? (they should, no implementation yet)
- [ ] Did I cover edge cases? (null, empty, invalid inputs)
- [ ] Are test names descriptive? (clear intent)

## Files You Can Edit
{{testFiles}}

## Files You CANNOT See
(Implementation files are hidden from you - this prevents "Oops, I peeked!")

## Example Test Structure
```typescript
describe('UserService', () => {
  describe('registerUser', () => {
    it('should create user with valid email and password', () => {
      // Arrange
      const service = new UserService()

      // Act
      const result = service.registerUser('test@example.com', 'Password123')

      // Assert
      expect(result.isOk()).toBe(true)
      expect(result.value.email).toBe('test@example.com')
    })

    it('should reject invalid email format', () => { ... })
    it('should reject weak password', () => { ... })
    it('should prevent duplicate email', () => { ... })

    // Edge cases - prevent "Oops, I forgot edge cases!"
    it('should handle null email', () => { ... })
    it('should handle empty password', () => { ... })
  })
})
```

Begin writing tests now. Remember: No implementation, no "Oops"!
```

---

### 3. Implementation Agent（実装エージェント）

#### 役割

テストを通すための最小限の実装を書く

#### 制約

- **Can**: 実装ファイル（`*.ts`）を作成・編集
- **Can Read**: テストファイル（読み取り専用）
- **Cannot**: テストファイルを変更
- **Must**: すべてのテストを成功させる

#### "Oops"防止メカニズム

| "Oops"の種類 | 防止方法 |
|---|---|
| "Oops, I changed the tests!" | テストファイルへの書き込みをブロック |
| "Oops, I over-engineered!" | YAGNIを強調、最小実装を要求 |
| "Oops, tests still fail!" | ゲートで検出し、修正を要求 |

#### システムプロンプト

```markdown
# Role: Implementation Writer

You are implementing code to make tests pass.

**IMPORTANT**: Prevent "Oops, I changed the tests!" - tests are READ-ONLY.

## Your Task
Implement: {{feature}}

## Failed Tests
The following tests are currently failing:
{{failedTests}}

## Test File (READ-ONLY - Do NOT modify!)
```typescript
{{testFileContent}}
```

## Rules (STRICT - No "Oops" allowed!)
1. Write MINIMAL code to make tests pass
2. DO NOT modify tests (they are locked!)
3. DO NOT add features not covered by tests
4. Follow YAGNI (You Aren't Gonna Need It)
5. All tests MUST pass

## "Oops" Prevention Checklist
- [ ] Did I modify ONLY implementation files? (not tests)
- [ ] Do ALL tests pass now?
- [ ] Did I write minimal code? (not over-engineered)
- [ ] Did I follow YAGNI? (no extra features)

## Files You Can Edit
{{implementationFiles}}

## Files You CANNOT Edit
{{testFiles}} (read-only - prevent "Oops, I broke the tests!")

## Implementation Guidelines
- Start with the simplest possible implementation
- Only add complexity when tests demand it
- Focus on making ONE test pass at a time
- Refactoring comes later (REFACTOR phase)
- When in doubt, choose simpler over complex

Begin implementing now. Remember: Don't touch the tests, no "Oops"!
```

---

### 4. Refactor Agent（リファクタリングエージェント）

#### 役割

テストを保ちながらコードを改善

#### 制約

- **Can**: 実装ファイルを編集
- **Must**: テストを維持（すべて成功し続ける）
- **Focus**: コード品質、可読性、保守性

#### "Oops"防止メカニズム

| "Oops"の種類 | 防止方法 |
|---|---|
| "Oops, I broke the tests!" | 各変更後にテスト実行を要求 |
| "Oops, I changed behavior!" | テストが動作を保証 |
| "Oops, I added features!" | 機能追加を禁止、改善のみ許可 |

#### システムプロンプト

```markdown
# Role: Refactoring Specialist

You are improving code quality while maintaining test coverage.

**IMPORTANT**: Prevent "Oops, I broke it!" - ALL tests must keep passing.

## Your Task
Refactor: {{feature}}

## Current Implementation
```typescript
{{currentImplementation}}
```

## Tests (MUST remain passing - your safety net!)
```typescript
{{tests}}
```

## Refactoring Goals
- Improve readability
- Remove duplication
- Extract methods/classes
- Improve naming
- Add comments where necessary
- Improve error messages

## Rules (STRICT - No "Oops" allowed!)
1. ALL tests MUST continue to pass
2. DO NOT change behavior
3. DO NOT add new features
4. Focus on code quality
5. Verify tests pass after EACH change

## "Oops" Prevention Checklist
- [ ] Do ALL tests still pass?
- [ ] Did I change ONLY code quality? (not behavior)
- [ ] Did I add NO new features?
- [ ] Did I run tests after EACH change?

## Refactoring Techniques
- Extract Method: Pull out complex logic into named methods
- Rename: Use more descriptive names
- Simplify Conditionals: Make if/else logic clearer
- Remove Dead Code: Delete unused code
- Add Type Safety: Strengthen TypeScript types

## Safety Protocol
After EACH refactoring change:
1. Run tests
2. If any test fails → STOP and revert
3. If all pass → continue to next improvement

Begin refactoring now. Remember: Tests are your safety net, no "Oops"!
```

---

## ゲート条件

各フェーズの間に**検証ゲート**を設置し、条件を満たさない限り次に進めない。

### Gate 1: RED → GREEN

**目的**: "Oops, I didn't write tests!" と "Oops, tests are passing!" を防ぐ

```typescript
async function gateRedToGreen(context: Context): Promise<GateResult> {
  console.log("🚦 Checking RED → GREEN gate conditions...")
  console.log("    (Preventing 'Oops' before GREEN phase)")

  const oopsFound: string[] = []

  // 1. テストファイルが存在するか
  const testFiles = await findTestFiles(context.feature)
  if (testFiles.length === 0) {
    oopsFound.push("Oops, no test files found!")
    return {
      passed: false,
      oops: "Oops, no test files found!",
      reason: "No test files found",
      suggestion: "Create test file before proceeding"
    }
  }

  // 2. テストケースが十分にあるか
  const testCases = await countTestCases(testFiles)
  if (testCases < 3) {
    oopsFound.push(`Oops, only ${testCases} test cases!`)
    return {
      passed: false,
      oops: `Oops, only ${testCases} test cases!`,
      reason: `Only ${testCases} test cases found (minimum: 3)`,
      suggestion: "Add more test cases to cover edge cases"
    }
  }

  // 3. テストが失敗するか（RED確認）
  const testResult = await runTests(testFiles)

  if (testResult.passed > 0) {
    oopsFound.push("Oops, tests are passing!")
    return {
      passed: false,
      oops: "Oops, some tests are passing (they shouldn't be)!",
      reason: `${testResult.passed} tests are passing. Tests should fail in RED phase.`,
      suggestion: "Remove or fix passing tests (implementation doesn't exist yet)"
    }
  }

  if (testResult.failed === 0) {
    oopsFound.push("Oops, no failing tests!")
    return {
      passed: false,
      oops: "Oops, no failing tests found!",
      reason: "No failing tests found",
      suggestion: "Tests should fail because implementation doesn't exist"
    }
  }

  // すべての条件をクリア
  return {
    passed: true,
    oops: null,
    message: `✓ ${testResult.failed} tests failing as expected. No oops here! Proceeding to GREEN phase.`
  }
}
```

**実行例**:

```bash
$ oops gate red-to-green

🚦 Checking RED → GREEN gate conditions...
    (Preventing "Oops" before GREEN phase)

  ✓ Test file exists: src/services/UserService.test.ts
  ✓ Test cases found: 5
  ✓ Tests failing: 5/5 (expected)

✓ Gate passed. No oops! Ready for GREEN phase.

Run: oops phase green
```

**失敗例（"Oops"発生）**:

```bash
$ oops gate red-to-green

🚦 Checking RED → GREEN gate conditions...

  ✓ Test file exists: src/services/UserService.test.ts
  ✓ Test cases found: 5
  ✗ Tests status: 3 passing, 2 failing

❌ Oops, some tests are passing (they shouldn't be)!

Reason: Tests should fail because implementation doesn't exist yet.

The following tests are passing:
  - should import UserService class
  - should instantiate UserService
  - should have registerUser method

Suggestion: These tests are too simple. Remove them or make them test actual behavior.

Cannot proceed to GREEN phase until this "Oops" is fixed.
```

---

### Gate 2: GREEN → REFACTOR

**目的**: "Oops, tests are still failing!" を防ぐ

```typescript
async function gateGreenToRefactor(context: Context): Promise<GateResult> {
  console.log("🚦 Checking GREEN → REFACTOR gate conditions...")
  console.log("    (Preventing 'Oops' before REFACTOR phase)")

  const oopsFound: string[] = []

  // 1. すべてのテストが成功するか
  const testResult = await runTests()

  if (testResult.failed > 0) {
    oopsFound.push(`Oops, ${testResult.failed} tests still failing!`)
    return {
      passed: false,
      oops: `Oops, ${testResult.failed} tests still failing!`,
      reason: `${testResult.failed} tests failing`,
      failedTests: testResult.failedTests,
      suggestion: "Fix failing tests before proceeding to refactor"
    }
  }

  // 2. コードカバレッジは十分か（警告のみ）
  const coverage = await getCoverage()
  const warnings = []

  if (coverage < 80) {
    warnings.push(`⚠️ Coverage is ${coverage}% (recommended: 80%+). Consider adding more tests.`)
  }

  // 3. コード品質チェック（警告のみ）
  const qualityIssues = await checkCodeQuality()
  if (qualityIssues.length > 0) {
    warnings.push(`⚠️ ${qualityIssues.length} code quality issues found. Refactoring recommended.`)
  }

  // 4. ユーザーに確認（オプション）
  if (context.interactive) {
    const userConfirm = await askUser(
      "All tests are passing. No oops! Proceed to refactor phase?",
      ["Yes, refactor", "No, commit as is", "Review code first"]
    )

    if (userConfirm === "No, commit as is") {
      return {
        passed: false,
        oops: null,
        reason: "User chose to skip refactoring",
        action: "commit",
        message: "✓ No oops! Committing code as is."
      }
    }

    if (userConfirm === "Review code first") {
      return {
        passed: false,
        oops: null,
        reason: "User wants to review code",
        action: "review"
      }
    }
  }

  // すべての条件をクリア
  return {
    passed: true,
    oops: null,
    message: "✓ All tests passing. No oops! Proceeding to REFACTOR phase.",
    warnings
  }
}
```

**実行例**:

```bash
$ oops gate green-to-refactor

🚦 Checking GREEN → REFACTOR gate conditions...
    (Preventing "Oops" before REFACTOR phase)

  ✓ All 5 tests passing
  ⚠ Coverage is 75% (recommended: 80%+)
  ⚠ 2 code quality issues found:
    - UserService.registerUser() has complexity of 12 (max: 10)
    - Missing JSDoc comments

✓ Gate passed (with warnings). No oops! Ready for REFACTOR phase.

Proceed to refactor? (Y/n) Y

Run: oops phase refactor
```

---

## 実装方式

### Option A: Claude Code Skills + Subagents（推奨）

Claude Codeの**Skills**と**Subagent**機能を活用した実装。

#### ディレクトリ構造

```
.claude/
├── skills/
│   ├── oops-orchestrator.md      # メインオーケストレーター
│   ├── oops-test-writer.md       # テストライターエージェント
│   ├── oops-implementation.md    # 実装エージェント
│   └── oops-refactor.md          # リファクタリングエージェント
└── hooks/
    ├── before-write.ts            # ファイル書き込み前チェック
    └── after-test.ts              # テスト実行後の処理
```

#### メインスキル（oops-orchestrator.md）

```markdown
---
name: oops-orchestrator
description: OOPS Framework - No more "Oops, I broke it again!"
---

# OOPS Framework
## Orchestrated Obligatory Process System

**Tagline**: "No more 'Oops, I broke it again!'"

This skill enforces strict Test-Driven Development using subagents.
Each agent has a specific role to prevent common "Oops" moments.

## Usage

When user requests a new feature, invoke this skill to orchestrate the RED-GREEN-REFACTOR cycle.

## The "Oops" We Prevent

- 🔴 RED: "Oops, I forgot to write tests!"
- 🟢 GREEN: "Oops, I changed the tests!"
- 🔵 REFACTOR: "Oops, I broke everything!"

## Process

### Phase 1: RED (Test Writing)

**Goal**: Prevent "Oops, I wrote implementation instead of tests!"

Invoke the `oops-test-writer` subagent:

```
Task: oops-test-writer
Prompt: Write tests for {{feature}}
Requirements: {{requirements}}
Allowed Files: **/*.test.ts, **/*.spec.ts
Denied Files: **/!(*.test|*.spec).ts
```

After test writer completes:
1. Run tests → expect ALL to fail
2. Check gate conditions
3. If any test passes → "Oops, tests shouldn't pass yet!"
4. If gate passes → proceed to GREEN

### Phase 2: GREEN (Implementation)

**Goal**: Prevent "Oops, I modified the tests!"

Invoke the `oops-implementation` subagent:

```
Task: oops-implementation
Prompt: Implement {{feature}} to make tests pass
Test File: {{testFile}} (read-only)
Allowed Files: **/*.ts
Denied Files: **/*.test.ts, **/*.spec.ts
```

After implementation completes:
1. Run tests → expect ALL to pass
2. Check gate conditions
3. If any test fails → "Oops, implementation incomplete!"
4. If gate passes → ask user about REFACTOR

### Phase 3: REFACTOR (Optional)

**Goal**: Prevent "Oops, refactoring broke the tests!"

If user wants to refactor, invoke `oops-refactor` subagent:

```
Task: oops-refactor
Prompt: Refactor {{feature}} while keeping tests green
Constraint: All tests must continue to pass
Safety: Run tests after EACH change
```

## Example

User: "Add user registration with email validation"

1. Orchestrator analyzes request
2. 🔴 RED phase: Test Writer creates UserService.test.ts
3. Gate check: 5 tests failing ✓ (No oops!)
4. 🟢 GREEN phase: Implementation Agent creates UserService.ts
5. Gate check: 5 tests passing ✓ (No oops!)
6. 🔵 REFACTOR phase: (optional) Refactor Agent improves code
7. Final check: All tests still pass ✓ (No oops!)
8. Commit: "✓ Feature complete. No oops encountered!"

## Important Rules

- NEVER skip phases
- ALWAYS check gates before proceeding
- ENFORCE file access restrictions
- VERIFY tests after each phase
- COUNT "oops" occurrences (goal: 0)

## Oops Counter

Track how many "Oops" were prevented:
- RED gate failures: prevented "Oops, no tests!"
- GREEN gate failures: prevented "Oops, tests modified!"
- REFACTOR gate failures: prevented "Oops, broke it!"

Goal: **Zero oops!** 🎉
```

#### Hooks実装例（before-write.ts）

```typescript
// .claude/hooks/before-write.ts

/**
 * OOPS Framework - Before Write Hook
 *
 * Prevents "Oops, I modified the wrong file!"
 *
 * This hook runs before Claude Code writes to any file.
 * It checks the current phase and enforces restrictions.
 */

export default async function beforeWrite(context) {
  const { file, content } = context

  // Get current phase from .oops/state.json
  const phase = await getCurrentPhase()

  if (!phase) {
    // No active OOPS session
    return { allowed: true }
  }

  // Phase-specific restrictions
  switch (phase.name) {
    case 'RED':
      // In RED phase, only test files can be written
      if (!isTestFile(file)) {
        return {
          allowed: false,
          oops: "Oops, you tried to write implementation in RED phase!",
          reason: `❌ RED Phase: Cannot modify ${file}`,
          message: `
            🔴 RED Phase: Write Tests Only

            Oops! You tried to modify an implementation file.

            Current phase: RED (writing tests)
            Only test files (*.test.ts, *.spec.ts) can be modified.
            Implementation files are locked.

            This prevents: "Oops, I wrote implementation instead of tests!"

            To switch to GREEN phase:
            1. Ensure all tests are failing
            2. Run: oops gate red-to-green
            3. Run: oops phase green
          `
        }
      }
      break

    case 'GREEN':
      // In GREEN phase, test files cannot be modified
      if (isTestFile(file)) {
        return {
          allowed: false,
          oops: "Oops, you tried to modify tests in GREEN phase!",
          reason: `❌ GREEN Phase: Cannot modify test files`,
          message: `
            🟢 GREEN Phase: Write Implementation Only

            Oops! You tried to modify a test file.

            Current phase: GREEN (writing implementation)
            Test files are locked (read-only).
            Focus on making tests pass.

            This prevents: "Oops, I changed the tests to make them pass!"

            To modify tests, switch to REFACTOR phase:
            1. Ensure all tests are passing
            2. Run: oops gate green-to-refactor
            3. Run: oops phase refactor
          `
        }
      }
      break

    case 'REFACTOR':
      // In REFACTOR phase, anything can be modified
      // but tests must keep passing
      break
  }

  // Allow the write
  return {
    allowed: true,
    message: `✓ Writing to ${file} (${phase.name} phase)`
  }
}

function isTestFile(path: string): boolean {
  return path.endsWith('.test.ts') ||
         path.endsWith('.spec.ts') ||
         path.endsWith('.test.js') ||
         path.endsWith('.spec.js')
}

async function getCurrentPhase() {
  try {
    const stateFile = await readFile('.oops/state.json')
    return JSON.parse(stateFile)
  } catch {
    return null
  }
}
```

---

### Option B: 汎用フレームワーク（任意のLLMツールで動作）

Claude Code以外（ChatGPT、Cursor、GitHub Copilot等）でも動作する汎用実装。

#### アーキテクチャ

```
oops-framework/
├── cli/
│   └── oops.ts                    # メインCLI
├── core/
│   ├── orchestrator.ts            # オーケストレーター
│   ├── gate-checker.ts            # ゲート条件チェック
│   ├── phase-manager.ts           # フェーズ管理
│   └── oops-counter.ts            # "Oops"カウンター
├── prompts/
│   ├── test-writer.md             # テストライター用プロンプト
│   ├── implementation.md          # 実装エージェント用プロンプト
│   └── refactor.md                # リファクタリング用プロンプト
└── templates/
    └── oops.config.ts             # デフォルト設定
```

#### CLI コマンド

```bash
# 初期化
$ oops init

🎉 Initializing OOPS Framework
   "No more 'Oops, I broke it again!'"

Creating OOPS workspace...
  ✓ .oops/config.json
  ✓ .oops/prompts/
  ✓ .oops/state.json
  ✓ .oops/oops-counter.txt (tracking prevented "Oops")

Ready to prevent "Oops" moments!

# 新しいフィーチャー開始
$ oops feature start "user-registration" \
    --requirement "Email validation" \
    --requirement "Password strength check"

🚀 Starting RED-GREEN-REFACTOR cycle for: user-registration

Oops Prevention Goal: 0 oops! 🎯

=== Phase 1: 🔴 RED ===

Preventing: "Oops, I forgot to write tests!"

📝 Test Writer Prompt:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 RED Phase: Write Tests Only

Role: Test Writer

Write comprehensive tests for: user-registration

Requirements:
- Email validation
- Password strength check

Rules (STRICT - No "Oops" allowed!):
1. Write ONLY test code
2. DO NOT write implementation
3. Tests MUST fail (no implementation exists yet)

"Oops" Prevention Checklist:
- [ ] Did I write ONLY tests?
- [ ] Do ALL tests fail?
- [ ] Did I cover edge cases?

Files to create:
- src/services/UserService.test.ts

Begin writing tests now. No implementation, no "Oops"!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Next steps:
1. Copy the prompt above
2. Paste into your LLM (Claude, ChatGPT, Cursor, etc.)
3. Save generated tests to: src/services/UserService.test.ts
4. Run: oops gate red-to-green

# ゲートチェック
$ oops gate red-to-green

🚦 Checking RED → GREEN gate conditions...
    (Preventing "Oops" before GREEN phase)

  ✓ Test file exists: src/services/UserService.test.ts
  ✓ Test cases found: 5
  ✓ Tests failing: 5/5 (expected)

✅ Gate passed. No oops! 🎉

Oops Counter: 0 prevented

Ready for GREEN phase.
Run: oops phase green

# 統計表示
$ oops stats

📊 OOPS Framework Statistics

Session: user-registration
Started: 2026-03-04 10:00:00

Oops Counter: 0 🎉
  ✓ No "Oops, forgot tests!" (RED gate: passed)
  ✓ No "Oops, changed tests!" (GREEN gate: pending)
  ✓ No "Oops, broke refactor!" (REFACTOR gate: pending)

Current Phase: GREEN
Tests: 5 passing / 5 total
Coverage: 85%

Keep it up! Goal: Zero oops! 🎯
```

---

## 実装計画

### Phase 1: MVP（2週間）

**目標**: 基本的なワークフロー強制を実現 + "Oops"カウンター

**機能**:
1. **フェーズ管理**
   - `oops phase red|green|refactor`
   - 状態管理（`.oops/state.json`）

2. **"Oops"カウンター**
   - 各ゲートで防がれた"Oops"をカウント
   - `oops stats`で統計表示
   - 目標: ゼロ oops!

3. **プロンプト生成**
   - 各フェーズ用のプロンプトテンプレート
   - "Oops"防止チェックリスト組み込み

4. **ゲートチェック**
   - `oops gate red-to-green`
   - `oops gate green-to-refactor`
   - "Oops"検出とレポート

5. **CLI基盤**
   - `oops init`
   - `oops feature start`
   - `oops complete`

**成果物**:
- 動作するCLIツール（TypeScript製）
- "No more Oops!"をテーマにしたドキュメント
- デモ動画（3分）："From Oops to Success"

**技術スタック**:
- TypeScript
- Commander.js（CLI）
- Jest（テストランナー統合）
- chalk（カラフルなCLI出力）

---

### Phase 2: Claude Code統合（2週間）

**目標**: Claude CodeのSkillsとHooksを活用

**機能**:
1. **Skills実装**
   - `oops-orchestrator` スキル
   - `oops-test-writer` サブエージェント
   - `oops-implementation` サブエージェント
   - `oops-refactor` サブエージェント

2. **Hooks実装**
   - `before-write.ts`: "Oops, wrong file!"を防ぐ
   - `after-test.ts`: テスト実行後の自動ゲートチェック

3. **Subagent orchestration**
   - エージェント間の自動切り替え
   - ファイルアクセス制限の自動適用
   - "Oops"の自動検出

**成果物**:
- Claude Code用Skillsパッケージ
- インストールガイド："Setting up OOPS in Claude Code"
- ビデオチュートリアル："Never Say Oops Again!"

---

### Phase 3: 汎用化・エコシステム（1ヶ月）

**目標**: 他のLLMツールでも動作するようにする

**機能**:
1. **Cursor統合**
   - Cursor Rules経由でのプロンプト提供
   - `.cursorrules`ファイル生成

2. **GitHub Copilot統合**
   - コメントベースのプロンプト生成

3. **VSCode拡張**
   - サイドバーでフェーズ表示
   - "Oops"カウンター可視化
   - ワンクリックでプロンプトコピー

4. **GitHub Actions**
   - CI/CDでのゲートチェック自動化
   - PRコメントに"Oops"レポート表示

**成果物**:
- VSCode拡張（Marketplace公開）
- GitHub Actions workflow
- 包括的なドキュメント："OOPS Across All Tools"

---

### Phase 4: コミュニティ・エコシステム（継続的）

**目標**: コミュニティ駆動の発展

**機能**:
1. **"Oops"ギャラリー**
   - ユーザーが遭遇した"Oops"を共有
   - OOPSがどう防いだかを表示

2. **カスタムゲート**
   - ユーザー定義のゲート条件
   - プロジェクト固有の"Oops"を防ぐ

3. **ダッシュボード**
   - チーム全体の"Oops"統計
   - "Oops-free days"カウンター

**成果物**:
- コミュニティフォーラム
- "Oops"ギャラリーサイト
- 年次レポート："Most Common Oops of 2026"

---

## 成功指標

### 定量的指標

| 指標 | 目標値 | "Oops"との関連 |
|---|---|---|
| **"Oops"カウント** | 0 (完璧) / <3 (良好) | 防がれた"Oops"の数 |
| **テストファースト遵守率** | 90%以上 | "Oops, forgot tests!"を防ぐ |
| **テスト成功率（GREENフェーズ）** | 95%以上 | "Oops, tests still fail!"を防ぐ |
| **フェーズ順守率** | 100% | "Oops, skipped a step!"を防ぐ |
| **ゲート通過率** | 90%以上 | 1回目で"Oops"なくゲート通過 |
| **平均サイクルタイム** | <30分 | 効率的に"Oops"を防ぐ |

### 定性的指標

| 指標 | 測定方法 | "Oops"との関連 |
|---|---|---|
| **"Oops"削減体感** | 「OOPSで"Oops"が減った」と感じる開発者の割合 | アンケート |
| **開発者満足度** | 5段階評価、目標4以上 | アンケート |
| **採用率** | GitHub Stars、npmダウンロード数 | 人気度 |
| **"Oops"ミーム** | TwitterやRedditで"No more Oops!"が拡散 | バイラル度 |

---

## 参考文献

1. "Towards Understanding the Characteristics of Code Generation Errors Made by Large Language Models" (ICSE 2025)
   - LLMの"Oops"パターン分類

2. "Test-Driven Development for Code Generation" (arXiv 2024)
   - TDDがLLMの"Oops"を防ぐ理由

3. "Why Does Test-Driven Development Work So Well In AI-assisted Programming?" (2026)
   - "Oops"連鎖の防止メカニズム

4. "Forcing Claude Code to TDD: An Agentic Red-Green-Refactor Loop" (alexop.dev, 2026)
   - マルチエージェントで"Oops"を防ぐ実例

5. "My LLM coding workflow going into 2026" (Addy Osmani, Medium)
   - 実務での"Oops"体験

---

## まとめ

### OOPSの使命

**"No more 'Oops, I broke it again!'"**

### 防ぐ"Oops"の種類

| フェーズ | 防ぐ"Oops" |
|---|---|
| 🔴 RED | "Oops, I forgot to write tests!" |
| 🟢 GREEN | "Oops, I changed the tests!" |
| 🔵 REFACTOR | "Oops, I broke everything!" |
| 全体 | "Oops, I did everything at once!" |

### 設計の要点

| 要素 | 説明 |
|---|---|
| **コアアイデア** | LLMに「一度に全部やらせない」→ "Oops"を起こす余地をなくす |
| **実現方法** | 役割分離された専門エージェント |
| **強制機構** | ファイルアクセス制限 + システムプロンプト + ゲート条件 |
| **検証** | 各フェーズ間のゲート条件チェック |
| **"Oops"カウンター** | 防がれた"Oops"を記録、目標はゼロ |

### 最大の価値提案

**「LLMにTDDサイクルを物理的に強制し、"Oops"を起こさせない」**

これにより：
1. **"Oops"削減**: エラーの事前防止
2. **プロセス改善**: 一貫性のある開発フロー
3. **学習効果**: 開発者がTDDを自然に習得
4. **心理的安全性**: "Oops"を恐れない開発

---

## ロゴ・スローガン案

```
   ___   ___  ____  ____
  / _ \ / _ \|  _ \/ ___|
 | | | | | | | |_) \___ \
 | |_| | |_| |  __/ ___) |
  \___/ \___/|_|   |____/

Orchestrated Obligatory Process System

"No more 'Oops, I broke it again!'"
```

---

## 次のステップ

1. **Phase 1 MVP開発開始**（2週間）
   - CLI基盤の実装
   - "Oops"カウンター実装
   - プロンプトテンプレート作成

2. **アーリーアダプター募集**
   - オープンソース公開（GitHub）
   - "Share your Oops!"キャンペーン

3. **Claude Code統合**（Phase 2）
   - Skills/Hooks実装
   - Subagent orchestration

4. **"No Oops Day"達成を祝う**
   - コミュニティイベント
   - 成功事例の共有
