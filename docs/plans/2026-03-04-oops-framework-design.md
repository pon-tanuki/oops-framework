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
7. [Claude Code Hooksの技術詳細](#claude-code-hooksの技術詳細)
8. [実装方式](#実装方式)
9. [実装計画](#実装計画)
10. [成功指標](#成功指標)
11. [参考文献](#参考文献)

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
3. **実現可能**: Claude Code Hooksで**物理的な強制が可能**
4. **シンプル**: 既存のJest/TypeScriptをそのまま使用

**技術的検証（2026-03-04）**:

初期のサブエージェントレビューでは「ファイルアクセス制限は実装不可能」と指摘されましたが、Claude Codeドキュメントの調査により、以下が判明：

✅ **Claude Code Hooksは実装可能**:
- `PreToolUse` hookで`Edit`/`Write`ツールをインターセプト可能
- `permissionDecision: "deny"`でファイル操作を**物理的にブロック**可能
- 20種類のライフサイクルフックが利用可能
- エラーメッセージをLLMにフィードバック可能

これにより、OOPSフレームワークの**核心的な差別化要因**（ファイルアクセス制限による強制）は**完全に実現可能**であることが確認されました。

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

- **Can Edit**: `*.test.ts`, `*.spec.ts` ファイルを作成・編集
- **Cannot Edit**: 実装ファイル（`*.ts` 除く `*.test.ts`）の編集（**物理的にブロック** - Claude Code Hooks）
- **Cannot Read**: 実装ファイル（推奨・プロンプトベース）
- **Must**: テストは失敗する（RED フェーズ）

#### ファイルアクセス制御レベル

| 操作 | テストファイル | 実装ファイル | 強制方法 |
|---|---|---|---|
| **Read** | ✅ 可能 | ⚠️ 推奨しない | プロンプト（物理的には可能） |
| **Write/Edit** | ✅ 可能 | ❌ 不可 | **物理的ブロック**（PreToolUse hook） |

**重要**:
- **書き込み制限は物理的に強制**されます（Claude Code Hooks）
- **読み取り制限はプロンプトベース**です（実装ファイルを「見ない」ようプロンプトで誘導）
- REDフェーズでは実装が存在しないため、実際には読み取りの問題は発生しにくい

#### "Oops"防止メカニズム

| "Oops"の種類 | 防止方法 | 強制レベル |
|---|---|---|
| "Oops, I wrote implementation!" | 実装ファイルへの書き込みをブロック | 🔒 **物理的** |
| "Oops, tests are passing!" | ゲートで検出し、やり直しを要求 | 🚦 ゲート |
| "Oops, no edge cases!" | プロンプトでエッジケースを明示的に要求 | 💬 プロンプト |

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

- **Can Edit**: 実装ファイル（`*.ts`）を作成・編集
- **Can Read**: テストファイル（読み取り可能）
- **Cannot Edit**: テストファイルを変更（**物理的にブロック** - Claude Code Hooks）
- **Must**: すべてのテストを成功させる

#### ファイルアクセス制御レベル

| 操作 | テストファイル | 実装ファイル | 強制方法 |
|---|---|---|---|
| **Read** | ✅ 可能 | ✅ 可能 | プロンプト（Readツールはhookでインターセプトしない） |
| **Write/Edit** | ❌ 不可 | ✅ 可能 | **物理的ブロック**（PreToolUse hook） |

**重要**:
- **書き込み制限は物理的に強制**されます（Claude Code Hooks）
- **読み取り制限はプロンプトベース**です（LLMの協力に依存）
- 実用上、読み取りは許可されても問題ありません（テストを変更できないため）

#### "Oops"防止メカニズム

| "Oops"の種類 | 防止方法 | 強制レベル |
|---|---|---|
| "Oops, I changed the tests!" | テストファイルへの書き込みをブロック | 🔒 **物理的** |
| "Oops, I over-engineered!" | YAGNIを強調、最小実装を要求 | 💬 プロンプト |
| "Oops, tests still fail!" | ゲートで検出し、修正を要求 | 🚦 ゲート |

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

## Claude Code Hooksの技術詳細

### Hooksシステムの概要

Claude Codeは**matcher-based hook architecture**を採用しており、特定のイベントに対してシェルコマンド、HTTPリクエスト、またはLLMプロンプトを実行できます。

### OOPSに関連する主要フック

#### 1. PreToolUse Hook（ツール実行前）

**用途**: ファイル操作の事前チェックと拒否

```json
{
  "hooks": {
    "PreToolUse": {
      "matcher": "Edit|Write",
      "command": ".claude/hooks/oops-gate.sh"
    }
  }
}
```

**入力形式** (stdin経由でJSON):
```json
{
  "session_id": "abc123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "old_string": "...",
    "new_string": "..."
  },
  "cwd": "/project/root"
}
```

**出力形式** (stdout):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "❌ Oops, you tried to modify tests in GREEN phase!"
  }
}
```

**ブロッキング動作**:
- `permissionDecision: "deny"` → ツールの実行を**完全にブロック**
- `permissionDecisionReason` → LLMにフィードバックされ、次のアクションを修正
- Exit code 0 + JSON出力（Exit code 2ではない点に注意）

#### 2. PostToolUse Hook（ツール実行後）

**用途**: ファイル変更後の自動テスト実行

```json
{
  "hooks": {
    "PostToolUse": {
      "matcher": "Edit|Write",
      "command": ".claude/hooks/oops-test-runner.sh"
    }
  }
}
```

**制約**:
- ツールは既に実行済み（ブロック不可）
- 情報収集とステート更新のみ可能

#### 3. SessionStart Hook

**用途**: OOPSセッションの初期化とフェーズ状態の読み込み

#### 4. UserPromptSubmit Hook

**用途**: ユーザープロンプトに現在のフェーズ情報を自動付加

### 強制機構の仕組み

```
User Request
    ↓
Orchestrator (スキル)
    ↓
【RED Phase開始】
    ↓
LLM: "UserService.tsを編集しよう..."
    ↓
Edit tool呼び出し
    ↓
🚫 PreToolUse Hook発動
    ↓
oops-gate.sh実行:
  - tool_name = "Edit"
  - file_path = "UserService.ts"
  - phase = "RED"
  - isTestFile? NO
  - → DENY!
    ↓
JSON出力: { permissionDecision: "deny", ... }
    ↓
❌ Edit toolの実行がブロック
    ↓
LLMにエラーメッセージ:
"❌ Oops, you tried to write implementation in RED phase!
 Only test files (*.test.ts) are allowed."
    ↓
LLM: "あ、テストファイルだけだった。UserService.test.tsを作成しよう"
    ↓
Edit tool呼び出し (*.test.ts)
    ↓
🚫 PreToolUse Hook発動
    ↓
oops-gate.sh実行:
  - file_path = "UserService.test.ts"
  - phase = "RED"
  - isTestFile? YES
  - → ALLOW!
    ↓
✅ Edit tool実行成功
    ↓
🧪 PostToolUse Hook発動 (自動テスト実行)
```

### Hookの利点

| 利点 | 説明 |
|---|---|
| **物理的強制** | プロンプトでの「お願い」ではなく、ファイルシステムレベルでブロック |
| **即座のフィードバック** | LLMが誤った操作をする前にエラーメッセージで修正 |
| **学習効果** | LLMがエラーから学習し、次回は正しいファイルを選択 |
| **可視性** | すべてのブロックが記録され、"Oops"カウンターに反映 |
| **柔軟性** | シェルスクリプトで任意のロジックを実装可能 |

### 制限事項

| 制限 | 影響 | 対策 |
|---|---|---|
| **Hooksはツール呼び出しのみインターセプト** | LLMの「思考」は制御できない | プロンプトエンジニアリングと併用 |
| **PostToolUseはブロック不可** | 実行後の取り消しは不可 | PreToolUseで事前防止に集中 |
| **タイムアウト（デフォルト10分）** | 長時間の処理は不可 | 簡潔なスクリプトを推奨 |
| **JSONパース必須** | `jq`コマンドへの依存 | `oops init`でインストール確認 |
| **Readツールはインターセプトしない** | 読み取り制限は物理的に不可 | プロンプトで「見ない」よう誘導 |

### フェーズ変更の権限モデル

OOPSフレームワークでは、フェーズの変更は**Orchestratorのみ**が実行できます。これにより、Subagentやユーザーが勝手にフェーズを変更して、ゲート条件をスキップすることを防ぎます。

#### 権限レベル

| ロール | フェーズ読み取り | フェーズ変更 | ゲートチェック |
|---|---|---|---|
| **Orchestrator** | ✅ 可能 | ✅ 可能 | ✅ 実行 |
| **Test Writer Agent** | ✅ 可能 | ❌ 不可 | ❌ 不可 |
| **Implementation Agent** | ✅ 可能 | ❌ 不可 | ❌ 不可 |
| **Refactor Agent** | ✅ 可能 | ❌ 不可 | ❌ 不可 |
| **User (CLI)** | ✅ 可能 | ⚠️ 制限付き | ✅ 実行可能 |

#### フェーズ変更の実装

```bash
# .oops/state.json の構造
{
  "phase": "RED",
  "sessionId": "abc123",
  "orchestratorId": "main-session-xyz",
  "locked": true,
  "lastModified": "2026-03-04T10:00:00Z"
}
```

**ロックメカニズム**:
1. Orchestratorがフェーズを変更する際、`locked: true`とsessionIdを記録
2. 他のエージェントがフェーズ変更を試みると、`oops-gate.sh`が拒否
3. ゲートチェック後のみ、Orchestratorがロックを解除して次フェーズへ

#### フェーズ変更フロー

```
Orchestrator
    ↓
1. Gate Check (red-to-green)
    ↓
2. Gate Pass?
    ↓ Yes
3. Lock state.json
    ↓
4. Update phase to "GREEN"
    ↓
5. Launch Implementation Agent
    ↓
6. Implementation completes
    ↓
7. Gate Check (green-to-refactor)
    ↓
8. Gate Pass?
    ↓ Yes
9. Update phase to "REFACTOR"
```

**不正なフェーズ変更の防止**:
```bash
# Subagentがフェーズ変更を試みた場合
$ oops phase green  # Subagentから実行

❌ Error: Phase change denied
Reason: Only Orchestrator can change phases
Current phase locked by: main-session-xyz

To change phase:
1. Complete current phase tasks
2. Pass gate check
3. Let Orchestrator manage phase transition
```

### エラーリカバリーと安定性

OOPSフレームワークは、予期しないエラーや障害からの回復メカニズムを提供します。

#### 1. Hookクラッシュ時の動作

**問題**: `.claude/hooks/oops-gate.sh`がクラッシュした場合、ファイルアクセス制限が機能しない

**対策**:

```bash
# oops-gate.sh の冒頭でエラーハンドリング
set -euo pipefail

# エラー時のフェールセーフ
trap 'handle_error $?' ERR

handle_error() {
  echo "Hook error occurred. Defaulting to DENY for safety." >&2
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Hook script error. Operation blocked for safety."
    }
  }'
  exit 0
}
```

**原則**: **Fail-safe（安全側に倒す）**
- Hookがエラーの場合 → デフォルトで`deny`
- ステートファイルが読めない場合 → フェーズなしとして扱い、すべて`deny`

#### 2. ステートファイル破損時の回復

**問題**: `.oops/state.json`が破損した場合、フェーズ管理が不能

**対策**:

```bash
# state.jsonの検証と復旧
validate_state() {
  if ! jq empty .oops/state.json 2>/dev/null; then
    echo "State file corrupted. Restoring from backup..." >&2

    # バックアップから復旧
    if [ -f .oops/state.json.backup ]; then
      cp .oops/state.json.backup .oops/state.json
      return 0
    fi

    # バックアップもない場合、初期状態に
    jq -n '{
      phase: "NONE",
      sessionId: "",
      oopsCount: 0,
      error: "State recovered from corruption"
    }' > .oops/state.json
  fi
}

# 書き込み前に必ずバックアップ
backup_state() {
  cp .oops/state.json .oops/state.json.backup
}
```

#### 3. デバッグモード

**目的**: Hooksの動作を詳細に記録し、問題のトラブルシューティングを容易にする

**実装**:

```bash
# .oops/config.json
{
  "debug": true,
  "logLevel": "verbose"
}

# oops-gate.sh でのデバッグログ
if [ "$DEBUG_MODE" = "true" ]; then
  echo "[DEBUG] Hook invoked at $(date)" >> .oops/debug.log
  echo "[DEBUG] Tool: $TOOL_NAME, File: $FILE_PATH, Phase: $PHASE" >> .oops/debug.log
fi
```

**デバッグログの出力例**:
```
.oops/
├── debug.log          # Hook実行の詳細ログ
├── state.json         # 現在の状態
├── state.json.backup  # 状態のバックアップ
└── oops-counter.json  # "Oops"の記録
```

#### 4. マルチプロジェクト対応

**問題**: 複数のOOPSセッションを同時実行した場合、ステート管理が競合

**対策**:

```bash
# セッションIDベースのステート管理
.oops/
├── sessions/
│   ├── session-abc123.json  # セッション1
│   ├── session-xyz789.json  # セッション2
│   └── active-session       # 現在アクティブなセッションへのシンボリックリンク
└── state.json -> sessions/active-session
```

**セッション分離**:
```bash
# 新しいセッション開始
$ oops feature start "user-registration" --session=abc123
Creating new session: abc123
Session directory: .oops/sessions/session-abc123.json

# セッション切り替え
$ oops session switch xyz789
Switched to session: xyz789
```

#### 5. 後方互換性とバージョン管理

**問題**: Claude Codeのアップデートでhooksの仕様が変わる可能性

**対策**:

```bash
# .oops/config.json にバージョン記録
{
  "oopsVersion": "1.0.0",
  "claudeCodeVersion": "2.5.0",
  "hooksApiVersion": "1"
}

# バージョンチェック
check_compatibility() {
  CLAUDE_VERSION=$(claude --version | grep -oP '\d+\.\d+\.\d+')

  if ! is_compatible "$CLAUDE_VERSION" "$REQUIRED_VERSION"; then
    echo "⚠️  Warning: Claude Code version mismatch"
    echo "   Current: $CLAUDE_VERSION"
    echo "   Required: $REQUIRED_VERSION"
    echo "   OOPS may not work correctly. Consider updating."
  fi
}
```

---

## 実装方式

### Option A: Claude Code Skills + Hooks（推奨）

Claude Codeの**Skills**、**Hooks**、**Subagent**機能を活用した実装。

#### Claude Code Hooksによる強制機構

Claude Codeは**20種類のライフサイクルフック**を提供しており、OOPSフレームワークに必要なファイルアクセス制限が**完全に実装可能**です。

**重要なフック**:

| フック | タイミング | OOPSでの用途 | ブロック可能 |
|---|---|---|---|
| `PreToolUse` | ツール実行前 | `Edit`/`Write`の制限 | ✅ Yes |
| `PostToolUse` | ツール実行後 | テスト自動実行 | ❌ No |
| `SessionStart` | セッション開始時 | フェーズ状態の読み込み | ❌ No |
| `UserPromptSubmit` | ユーザー入力処理前 | プロンプトの拡張 | ✅ Yes |

**ファイルアクセス制限の仕組み**:

```typescript
// PreToolUse hookでEdit/Writeツールをインターセプト
// 入力: { tool_name, tool_input: { file_path, content, ... } }
// 出力: { permissionDecision: "allow" | "deny" | "ask" }
```

これにより、LLMが特定のファイルを編集しようとする際に**物理的にブロック**できます。

#### ディレクトリ構造

```
.claude/
├── skills/
│   ├── oops-orchestrator.md      # メインオーケストレーター
│   ├── oops-test-writer.md       # テストライターエージェント
│   ├── oops-implementation.md    # 実装エージェント
│   └── oops-refactor.md          # リファクタリングエージェント
└── hooks/
    ├── oops-gate.sh               # フェーズ別ファイルアクセス制限
    └── oops-test-runner.sh        # テスト実行後の自動ゲートチェック
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

#### Hooks実装（oops-gate.sh）

```bash
#!/bin/bash
# .claude/hooks/oops-gate.sh
#
# OOPS Framework - File Access Gate
#
# Prevents "Oops, I modified the wrong file!"
#
# This hook runs BEFORE Claude Code writes/edits any file (PreToolUse event).
# It checks the current phase and enforces file access restrictions.
#
# Hook Configuration (.claude/settings.json):
# {
#   "hooks": {
#     "PreToolUse": {
#       "matcher": "Edit|Write",
#       "command": ".claude/hooks/oops-gate.sh"
#     }
#   }
# }

# Error handling and fail-safe
set -euo pipefail
trap 'handle_error $?' ERR

handle_error() {
  echo "Hook error occurred. Defaulting to DENY for safety." >&2
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Hook script error. Operation blocked for safety."
    }
  }'
  exit 0
}

# Read hook input from stdin
INPUT=$(cat)

# Extract tool name and file path
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Acquire lock to prevent race conditions
LOCK_FILE=".oops/state.lock"
LOCK_TIMEOUT=5

acquire_lock() {
  local waited=0
  while [ -f "$LOCK_FILE" ] && [ $waited -lt $LOCK_TIMEOUT ]; do
    sleep 0.1
    waited=$((waited + 1))
  done

  if [ -f "$LOCK_FILE" ]; then
    echo "Warning: Lock timeout. Proceeding anyway." >&2
  fi

  # Create lock with PID
  echo $$ > "$LOCK_FILE"
}

release_lock() {
  rm -f "$LOCK_FILE"
}

# Ensure lock is released on exit
trap release_lock EXIT

# Acquire lock before reading state
acquire_lock

# Get current OOPS phase from state file (with lock protection)
PHASE=$(jq -r '.phase // "NONE"' .oops/state.json 2>/dev/null || echo "NONE")

# If no active OOPS session, allow everything
if [ "$PHASE" = "NONE" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow"
    }
  }'
  exit 0
fi

# Check if file is a test file
is_test_file() {
  [[ "$1" =~ \.(test|spec)\.(ts|js|tsx|jsx)$ ]]
}

# Atomic update of Oops counter (protected by existing lock)
update_oops_counter() {
  # Create backup before modification
  cp .oops/state.json .oops/state.json.backup 2>/dev/null || true

  # Read current count
  OOPS_COUNT=$(jq -r '.oopsCount // 0' .oops/state.json)
  OOPS_COUNT=$((OOPS_COUNT + 1))

  # Atomic write with temp file
  jq --arg count "$OOPS_COUNT" \
     --arg timestamp "$(date -Iseconds)" \
     '.oopsCount = ($count | tonumber) | .lastOops = $timestamp' \
     .oops/state.json > .oops/state.json.tmp

  # Atomic rename
  mv .oops/state.json.tmp .oops/state.json
}

# Phase-specific restrictions
case "$PHASE" in
  RED)
    # RED phase: Only test files can be modified
    if ! is_test_file "$FILE_PATH"; then
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "❌ Oops, you tried to write implementation in RED phase!\n\n🔴 RED Phase: Write Tests Only\n\nYou attempted to modify: \($file)\n\nIn RED phase:\n- ✓ Test files (*.test.ts, *.spec.ts) are ALLOWED\n- ✗ Implementation files are LOCKED\n\nThis prevents: \"Oops, I wrote implementation instead of tests!\"\n\nTo switch to GREEN phase:\n1. Ensure all tests are failing\n2. Run: oops gate red-to-green\n3. Run: oops phase green"
        }
      }'

      # Update Oops counter (atomic operation with lock)
      update_oops_counter

      exit 0
    fi
    ;;

  GREEN)
    # GREEN phase: Test files cannot be modified
    if is_test_file "$FILE_PATH"; then
      jq -n --arg file "$FILE_PATH" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "❌ Oops, you tried to modify tests in GREEN phase!\n\n🟢 GREEN Phase: Write Implementation Only\n\nYou attempted to modify: \($file)\n\nIn GREEN phase:\n- ✓ Implementation files (*.ts, *.js) are ALLOWED\n- ✗ Test files are LOCKED (read-only)\n\nThis prevents: \"Oops, I changed the tests to make them pass!\"\n\nFocus on making existing tests pass WITHOUT modifying them.\n\nTo modify tests, switch to REFACTOR phase:\n1. Ensure all tests are passing\n2. Run: oops gate green-to-refactor\n3. Run: oops phase refactor"
        }
      }'

      # Update Oops counter (atomic operation with lock)
      update_oops_counter

      exit 0
    fi
    ;;

  REFACTOR)
    # REFACTOR phase: Both test and implementation files can be modified
    # but tests must continue to pass (verified by post-tool hook)
    ;;
esac

# Allow the operation
jq -n --arg phase "$PHASE" --arg file "$FILE_PATH" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow"
  }
}'

exit 0
```

**重要な実装ポイント**:

1. **Exit Code 0 + JSON output**: フックは常にexit 0で終了し、決定はJSON内の`permissionDecision`で表現
2. **permissionDecision**: `"allow"` / `"deny"` / `"ask"` の3つの値
3. **Fail-safe error handling**: エラー発生時はデフォルトで`deny`（安全側に倒す）
4. **Lock mechanism**: `.oops/state.lock`でrace conditionを防止（タイムアウト5秒）
5. **Atomic updates**: ステートファイル更新はtemp file + mvで原子性を保証
6. **Backup before write**: 更新前に`.oops/state.json.backup`を作成
7. **Oops Counter**: `deny`の場合、カウンターをアトミックに増加
8. **詳細なエラーメッセージ**: LLMにフィードバックし、次の行動を修正させる

**競合対策の仕組み**:

```
Hook A                    Hook B
  ↓                         ↓
acquire_lock()          acquire_lock()
  ↓ (success)              ↓ (wait...)
read state.json             ↓ (wait...)
  ↓                         ↓ (wait...)
update counter              ↓ (wait...)
  ↓                         ↓ (wait...)
atomic write                ↓ (wait...)
  ↓                         ↓ (wait...)
release_lock()              ↓ (success)
                            ↓
                        read state.json
                            ↓
                        update counter
                            ↓
                        atomic write
                            ↓
                        release_lock()
```

これにより、複数のhookが同時実行されても、カウンターの更新が失われることはありません。

#### テスト実行フック（oops-test-runner.sh）

```bash
#!/bin/bash
# .claude/hooks/oops-test-runner.sh
#
# OOPS Framework - Automatic Test Runner
#
# Runs tests after file changes and updates phase state.
#
# Hook Configuration (.claude/settings.json):
# {
#   "hooks": {
#     "PostToolUse": {
#       "matcher": "Edit|Write",
#       "command": ".claude/hooks/oops-test-runner.sh"
#     }
#   }
# }

# Read hook input
INPUT=$(cat)

# Get current phase
PHASE=$(jq -r '.phase // "NONE"' .oops/state.json 2>/dev/null || echo "NONE")

# Only run in active OOPS sessions
if [ "$PHASE" = "NONE" ]; then
  exit 0
fi

# Run tests
echo "🧪 Running tests..." >&2
npm test -- --json --outputFile=.oops/test-results.json 2>&1 >/dev/null

# Parse test results
TEST_RESULTS=$(cat .oops/test-results.json 2>/dev/null || echo '{}')
NUM_PASSED=$(echo "$TEST_RESULTS" | jq -r '.numPassedTests // 0')
NUM_FAILED=$(echo "$TEST_RESULTS" | jq -r '.numFailedTests // 0')

# Update state
jq --arg passed "$NUM_PASSED" --arg failed "$NUM_FAILED" \
  '.testResults = {passed: ($passed | tonumber), failed: ($failed | tonumber)}' \
  .oops/state.json > .oops/state.json.tmp
mv .oops/state.json.tmp .oops/state.json

echo "  ✓ Tests: $NUM_PASSED passed, $NUM_FAILED failed" >&2

exit 0
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

### Phase 0: Claude Code Hooks実証実験（5-7日間）

**目標**: Claude Code Hooksで実際にファイルアクセス制限ができることを検証

#### Day 1-2: 基本機能の実装と検証

1. **PreToolUse hookの実装**
   - `.claude/hooks/oops-gate.sh`プロトタイプ作成
   - `.oops/state.json`ステート管理の実装
   - `Edit`/`Write`ツールのインターセプト確認
   - `permissionDecision: "deny"`でブロック確認

2. **基本動作の確認**
   - RED phase: 実装ファイルへの書き込みがブロックされるか
   - GREEN phase: テストファイルへの書き込みがブロックされるか
   - Oopsカウンターが正しく記録されるか

#### Day 3-4: LLM応答パターンの観察

3. **LLMの学習効果テスト（10回実施）**
   - エラーメッセージから修正するか観察
   - 繰り返しエラーの頻度測定
   - 修正成功率の計測

4. **エラーメッセージの最適化**
   - 短文 vs 詳細 vs JSON形式でA/Bテスト
   - LLMが最も反応する形式を特定
   - エラーメッセージテンプレートの改善

#### Day 5: Subagentとの統合テスト

5. **Subagentコンテキストでの動作確認**
   - Orchestrator → Subagent起動 → Hooks発動の流れ
   - フェーズ状態（`.oops/state.json`）の共有確認
   - Subagentがhooksをバイパスできないことを確認

6. **権限モデルの検証**
   - Orchestratorのみがフェーズ変更できることを確認
   - Subagentによる不正なフェーズ変更を防ぐ

#### Day 6-7: パフォーマンスと安定性

7. **パフォーマンステスト**
   - 100回連続のEdit操作でタイムアウトなし確認
   - Hook実行時間の測定（平均・最大）
   - ボトルネックの特定

8. **ステート管理の競合テスト**
   - 並行アクセス時のrace condition確認
   - ロックメカニズムの必要性評価

9. **PostToolUse hookのテスト**
   - ファイル変更後の自動テスト実行
   - テスト結果の自動収集と状態更新

#### 成功基準（定量）

**P0（必須）**:
- [ ] PreToolUse hookインターセプト率: **100%**
- [ ] ブロッキング成功率: **100%**
- [ ] LLMの修正成功率: **≥70%**（10回中7回以上）
- [ ] Subagentとhooksの正常動作: **100%**

**P1（重要）**:
- [ ] Oopsカウンター精度: **100%**
- [ ] タイムアウト発生率: **0%**
- [ ] ステート競合発生率: **0%**
- [ ] Hook実行時間: **<500ms平均**

#### 失敗基準

以下のいずれかに該当する場合、実験を失敗と判断：
- ❌ LLMが3回連続で同じエラーを繰り返す
- ❌ Hookタイムアウト発生率 >10%
- ❌ Subagentでhooksが動作しない
- ❌ ステート管理で頻繁に競合が発生（>5%）

#### 成果物

1. **動作するプロトタイプ**
   - `.claude/hooks/oops-gate.sh`
   - `.claude/hooks/oops-test-runner.sh`
   - `.oops/state.json`スキーマ

2. **実証実験レポート**
   - 成功/失敗の記録（定量データ付き）
   - LLM応答パターンの分析
   - パフォーマンスデータ（実行時間、タイムアウト率）
   - 発見された制限事項のドキュメント

3. **Phase 1への推奨事項リスト**
   - エラーメッセージの最適形式
   - パフォーマンス改善の必要性
   - 追加機能の優先順位

#### 次への判断基準

**✅ Phase 1 MVPへ進む条件**:
- 全P0検証項目（4項目）が100%合格
- P1検証項目の80%以上（4項目中3項目以上）が合格
- 致命的なパフォーマンス問題がない

**⚠️ 設計修正後に再実験**:
- P0項目の一部が不合格だが、修正可能と判断
- 例: エラーメッセージ形式の変更で改善が見込める

**❌ Option B（汎用フレームワーク）へ切り替え**:
- 失敗基準に該当
- P0項目の複数が不合格で、修正が困難

---

### Phase 1: MVP（2週間）

**前提**: Phase 0の実証実験が成功

**目標**: Claude Code Hooksを使った基本的なワークフロー強制 + "Oops"カウンター

**機能**:
1. **Claude Code Hooks統合**
   - `.claude/hooks/oops-gate.sh`: ファイルアクセス制限
   - `.claude/hooks/oops-test-runner.sh`: 自動テスト実行
   - フック設定の自動化（`oops init`）

2. **フェーズ管理**
   - `oops phase red|green|refactor`
   - 状態管理（`.oops/state.json`）
   - フェーズ遷移時の自動ゲートチェック

3. **"Oops"カウンター**
   - Hooksで拒否された操作をカウント
   - `oops stats`で統計表示
   - 目標: ゼロ oops!

4. **プロンプト生成**
   - 各フェーズ用のプロンプトテンプレート
   - "Oops"防止チェックリスト組み込み

5. **ゲートチェック**
   - `oops gate red-to-green`
   - `oops gate green-to-refactor`
   - "Oops"検出とレポート

6. **CLI基盤**
   - `oops init`: Hooks設定の自動生成
   - `oops feature start`: 機能開発開始
   - `oops complete`: セッション終了とレポート

**成果物**:
- 動作するCLIツール（TypeScript製）
- Claude Code Hooks統合
- "No more Oops!"をテーマにしたドキュメント
- デモ動画（3分）："From Oops to Success with Claude Code"

**技術スタック**:
- TypeScript
- Commander.js（CLI）
- Jest（テストランナー統合）
- chalk（カラフルなCLI出力）
- Bash（Hooks実装）

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
