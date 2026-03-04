# Clarity Framework v2.0 設計ドキュメント
## マルチエージェント・アーキテクチャによるLLM向けTDD強制フレームワーク

---

## エグゼクティブサマリー

**Clarity Framework v2.0**は、LLM（大規模言語モデル）に**RED-GREEN-REFACTORサイクルを強制**するマルチエージェント・フレームワークです。

### コアコンセプト

> **LLMに「一度に全部やらせない」**
> 役割を分離した専門エージェントが、段階的に開発を進める

### 従来の問題（v1.0の設計）

```
❌ 事後対処型
LLM → 大量のコード生成 → エラー発生 → 自動revert
```

### 新しいアプローチ（v2.0）

```
✓ 事前防止型
LLM → 小さなステップ → 検証 → 次のステップ
      ↑各ステップで専門エージェントが担当
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

**新言語の開発** → **既存言語向けフレームワークの開発**

---

## LLMのコード生成における問題点

### 学術研究からの知見（2025-2026年）

#### 1. セマンティックエラー（意味的エラー）が主要な問題

| エラータイプ | 発生頻度 | 説明 |
|---|---|---|
| **条件エラー** | 最も一般的 | 条件の欠落や誤った条件分岐 |
| **定数値エラー** | 非常に多い | 関数引数、代入文などでの誤った定数値 |
| **参照エラー** | 頻繁 | 未定義変数/関数の参照 |
| **論理/数学演算エラー** | 多い | 演算子の誤用や計算ミス |
| **重要なステップの欠落** | 深刻 | タスク完了に必要な処理の省略 |

**重要な発見**: LLMは小さなエラーより、**複数行にわたる非自明なエラー**を起こしやすい

#### 2. ハルシネーション vs 実行時エラー

- **ハルシネーション**（存在しないメソッド/ライブラリの発明）は、実は最も害が少ない
  - 理由: コンパイラ/インタープリターが即座に検出

- **本当に危険**: コンパイラで検出されず、実行時に問題を起こすエラー

#### 3. 非機能品質の問題

- LLM生成コードは機能的には正しくても、**品質が低い**ことが多い
- リファクタリングしたコードは信頼性が低い

#### 4. プロンプトの影響

- **短いプロンプト（<50語）の方が成功率が高い**
- 長いプロンプトは無意味なコードを生成する可能性が高まる

#### 5. 修正コストの問題

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

---

## 設計の変遷

### v1.0の設計（廃案）

**アプローチ**: 複雑なDSL、実行時契約、多層防御など14の機能

**問題点**:
1. **事後対処型**: エラーを検出して戻すだけ（根本解決ではない）
2. **スコープが広すぎる**: 14機能は多すぎて焦点がぼやける
3. **実現可能性の疑問**: LLMセッションリセットなど技術的に困難な機能
4. **複雑なDSL**: `clarityTest()`, `clarityImplement()`は学習コストが高い

### v2.0の設計（本設計）

**アプローチ**: マルチエージェント・アーキテクチャによるプロセス強制

**コアアイデア**:
- **LLMに「一度に全部やらせない」**
- 役割を分離した専門エージェントが段階的に開発
- ファイルアクセス制限とシステムプロンプトで物理的に強制

**利点**:
1. **事前防止型**: エラーを起こさせない
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
└─────────────────────────────────────────┘
  ↓
  ├── Phase 1: RED ────────────────────┐
  │                                    │
  │  ┌──────────────────────────────┐  │
  │  │ Test Writer Agent            │  │
  │  │ Role: テストのみを書く       │  │
  │  │ Can: *.test.ts を編集        │  │
  │  │ Cannot: 実装ファイルを見る   │  │
  │  │ Prompt: "Write failing tests"│  │
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
  │  │ Context: テストは読み取り専用│  │
  │  │ Prompt: "Make tests pass"    │  │
  │  └──────────────────────────────┘  │
  │                                    │
  │  Output: UserService.ts            │
  │  Gate: ✓ 全テスト成功             │
  └────────────────────────────────────┘
  ↓
  └── Phase 3: REFACTOR (Optional) ────┐
                                       │
     ┌──────────────────────────────┐  │
     │ Refactor Agent               │  │
     │ Role: コード改善             │  │
     │ Can: 実装を編集              │  │
     │ Constraint: テストを保つ     │  │
     │ Prompt: "Improve code quality"│ │
     └──────────────────────────────┘  │
                                       │
     Output: Refactored code            │
     Gate: ✓ 全テスト成功（維持）      │
     └────────────────────────────────┘
```

### 設計の要点

| 要素 | 説明 |
|---|---|
| **エージェント分離** | 各フェーズで異なるエージェントを使用 |
| **ファイル制限** | エージェントごとに編集可能なファイルを制限 |
| **システムプロンプト** | 各エージェントに専用の役割を明示 |
| **ゲート条件** | フェーズ間の移行条件を厳格にチェック |
| **強制機構** | LLMの行動を物理的に制約 |

---

## 各エージェントの詳細仕様

### 1. Orchestrator Agent（オーケストレーター）

#### 責務

- ユーザーリクエストを受け取る
- 適切なフェーズに分解
- 各フェーズのエージェントを起動
- ゲート条件をチェック
- 次のフェーズに進むか判断

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

  Phase 2 (GREEN):
    - Implementation Agentを起動
    - 実装が完了するまで待つ
    - Gate: テストが成功することを確認

  Phase 3 (REFACTOR - optional):
    - ユーザーに確認
    - Refactor Agentを起動
    - Gate: テストが維持されることを確認
```

#### 出力

```typescript
{
  status: "completed",
  phases: [
    { phase: "RED", status: "passed", output: "UserService.test.ts" },
    { phase: "GREEN", status: "passed", output: "UserService.ts" },
    { phase: "REFACTOR", status: "skipped" }
  ],
  commits: [
    "abc1234: Add user registration tests",
    "def5678: Implement user registration"
  ]
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

#### システムプロンプト

```markdown
# Role: Test Writer

You are a test-first developer writing tests ONLY.

## Your Task
Write comprehensive tests for: {{feature}}

## Requirements
{{requirements}}

## Rules (STRICT)
1. Write ONLY test code
2. DO NOT write any implementation
3. Tests MUST fail (no implementation exists yet)
4. Cover happy path, edge cases, and error cases
5. Use descriptive test names

## Files You Can Edit
{{testFiles}}

## Files You CANNOT See
(Implementation files are hidden from you)

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
  })
})
```

Begin writing tests now.
```

#### 出力例

```typescript
// UserService.test.ts (Test Writer Agentが生成)
import { UserService } from './UserService'

describe('UserService', () => {
  describe('registerUser', () => {
    it('should create user with valid email and password', () => {
      const service = new UserService()
      const result = service.registerUser('test@example.com', 'Password123')

      expect(result.isOk()).toBe(true)
      expect(result.value.email).toBe('test@example.com')
      expect(result.value).toHaveProperty('id')
    })

    it('should reject invalid email format', () => {
      const service = new UserService()
      const result = service.registerUser('invalid-email', 'Password123')

      expect(result.isError()).toBe(true)
      expect(result.error).toContain('Invalid email')
    })

    it('should reject weak password', () => {
      const service = new UserService()
      const result = service.registerUser('test@example.com', 'weak')

      expect(result.isError()).toBe(true)
      expect(result.error).toContain('Password')
    })

    it('should prevent duplicate email', () => {
      const service = new UserService()
      service.registerUser('test@example.com', 'Password123')
      const result = service.registerUser('test@example.com', 'Password456')

      expect(result.isError()).toBe(true)
      expect(result.error).toContain('already exists')
    })

    it('should hash password before storing', () => {
      const service = new UserService()
      const result = service.registerUser('test@example.com', 'Password123')

      expect(result.value.password).not.toBe('Password123')
      expect(result.value.password.length).toBeGreaterThan(20) // hashed
    })
  })
})
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

#### システムプロンプト

```markdown
# Role: Implementation Writer

You are implementing code to make tests pass.

## Your Task
Implement: {{feature}}

## Failed Tests
The following tests are currently failing:
{{failedTests}}

## Test File (READ-ONLY)
```typescript
{{testFileContent}}
```

## Rules (STRICT)
1. Write MINIMAL code to make tests pass
2. DO NOT modify tests
3. DO NOT add features not covered by tests
4. Follow YAGNI (You Aren't Gonna Need It)
5. All tests MUST pass

## Files You Can Edit
{{implementationFiles}}

## Files You CANNOT Edit
{{testFiles}} (read-only)

## Implementation Guidelines
- Start with the simplest possible implementation
- Only add complexity when tests demand it
- Focus on making ONE test pass at a time
- Refactoring comes later (REFACTOR phase)

Begin implementing now.
```

#### 出力例

```typescript
// UserService.ts (Implementation Agentが生成)
type Result<T, E> =
  | { isOk: () => true, isError: () => false, value: T }
  | { isOk: () => false, isError: () => true, error: E }

function Ok<T>(value: T): Result<T, never> {
  return {
    isOk: () => true,
    isError: () => false,
    value
  }
}

function Error<E>(error: E): Result<never, E> {
  return {
    isOk: () => false,
    isError: () => true,
    error
  }
}

interface User {
  id: string
  email: string
  password: string
}

export class UserService {
  private users: Map<string, User> = new Map()

  registerUser(email: string, password: string): Result<User, string> {
    // Email validation
    if (!this.isValidEmail(email)) {
      return Error("Invalid email format")
    }

    // Password strength
    if (!this.isStrongPassword(password)) {
      return Error("Password must be at least 8 characters")
    }

    // Duplicate check
    if (this.users.has(email)) {
      return Error("Email already exists")
    }

    // Create user
    const user: User = {
      id: this.generateId(),
      email,
      password: this.hashPassword(password)
    }

    this.users.set(email, user)
    return Ok(user)
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  private isStrongPassword(password: string): boolean {
    return password.length >= 8
  }

  private hashPassword(password: string): string {
    // Simplified hash (in real implementation, use bcrypt)
    return 'hashed_' + password + '_' + Date.now()
  }

  private generateId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9)
  }
}
```

---

### 4. Refactor Agent（リファクタリングエージェント）

#### 役割

テストを保ちながらコードを改善

#### 制約

- **Can**: 実装ファイルを編集
- **Must**: テストを維持（すべて成功し続ける）
- **Focus**: コード品質、可読性、保守性

#### システムプロンプト

```markdown
# Role: Refactoring Specialist

You are improving code quality while maintaining test coverage.

## Your Task
Refactor: {{feature}}

## Current Implementation
```typescript
{{currentImplementation}}
```

## Tests (MUST remain passing)
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

## Rules (STRICT)
1. ALL tests MUST continue to pass
2. DO NOT change behavior
3. DO NOT add new features
4. Focus on code quality
5. Verify tests pass after EACH change

## Refactoring Techniques
- Extract Method: Pull out complex logic into named methods
- Rename: Use more descriptive names
- Simplify Conditionals: Make if/else logic clearer
- Remove Dead Code: Delete unused code
- Add Type Safety: Strengthen TypeScript types

Begin refactoring now.
```

#### 出力例

```typescript
// UserService.ts (Refactor Agentが改善)
type Result<T, E> =
  | { isOk: () => true, isError: () => false, value: T }
  | { isOk: () => false, isError: () => true, error: E }

function Ok<T>(value: T): Result<T, never> {
  return {
    isOk: () => true,
    isError: () => false,
    value
  }
}

function Error<E>(error: E): Result<never, E> {
  return {
    isOk: () => false,
    isError: () => true,
    error
  }
}

interface User {
  readonly id: string
  readonly email: string
  readonly password: string
}

// Validation errors with clear messages
class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class UserService {
  private readonly users: Map<string, User> = new Map()

  // Email validation regex as constant
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  private static readonly MIN_PASSWORD_LENGTH = 8

  /**
   * Register a new user with email and password
   * @param email - User's email address
   * @param password - User's password (will be hashed)
   * @returns Result containing User or error message
   */
  registerUser(email: string, password: string): Result<User, string> {
    // Validate inputs
    const validationError = this.validateUserInput(email, password)
    if (validationError) {
      return Error(validationError)
    }

    // Check for duplicate
    if (this.emailExists(email)) {
      return Error("Email already exists")
    }

    // Create and store user
    const user = this.createUser(email, password)
    this.users.set(email, user)

    return Ok(user)
  }

  /**
   * Validate user registration input
   * @returns error message if invalid, null if valid
   */
  private validateUserInput(email: string, password: string): string | null {
    if (!this.isValidEmail(email)) {
      return "Invalid email format"
    }

    if (!this.isStrongPassword(password)) {
      return `Password must be at least ${UserService.MIN_PASSWORD_LENGTH} characters`
    }

    return null
  }

  private isValidEmail(email: string): boolean {
    return UserService.EMAIL_REGEX.test(email)
  }

  private isStrongPassword(password: string): boolean {
    return password.length >= UserService.MIN_PASSWORD_LENGTH
  }

  private emailExists(email: string): boolean {
    return this.users.has(email)
  }

  private createUser(email: string, password: string): User {
    return {
      id: this.generateUserId(),
      email,
      password: this.hashPassword(password)
    }
  }

  private hashPassword(password: string): string {
    // TODO: Use bcrypt in production
    return `hashed_${password}_${Date.now()}`
  }

  private generateUserId(): string {
    return `user_${Math.random().toString(36).substr(2, 9)}`
  }
}
```

---

## ゲート条件

各フェーズの間に**検証ゲート**を設置し、条件を満たさない限り次に進めない。

### Gate 1: RED → GREEN

```typescript
async function gateRedToGreen(context: Context): Promise<GateResult> {
  console.log("🚦 Checking RED → GREEN gate conditions...")

  // 1. テストファイルが存在するか
  const testFiles = await findTestFiles(context.feature)
  if (testFiles.length === 0) {
    return {
      passed: false,
      reason: "No test files found",
      suggestion: "Create test file before proceeding"
    }
  }

  // 2. テストケースが十分にあるか
  const testCases = await countTestCases(testFiles)
  if (testCases < 3) {
    return {
      passed: false,
      reason: `Only ${testCases} test cases found (minimum: 3)`,
      suggestion: "Add more test cases to cover edge cases"
    }
  }

  // 3. テストが失敗するか（RED確認）
  const testResult = await runTests(testFiles)

  if (testResult.passed > 0) {
    return {
      passed: false,
      reason: `${testResult.passed} tests are passing. Tests should fail in RED phase.`,
      suggestion: "Remove or fix passing tests (implementation doesn't exist yet)"
    }
  }

  if (testResult.failed === 0) {
    return {
      passed: false,
      reason: "No failing tests found",
      suggestion: "Tests should fail because implementation doesn't exist"
    }
  }

  // すべての条件をクリア
  return {
    passed: true,
    message: `✓ ${testResult.failed} tests failing as expected. Proceeding to GREEN phase.`
  }
}
```

**実行例**:

```bash
$ clarity gate red-to-green

🚦 Checking RED → GREEN gate conditions...

  ✓ Test file exists: src/services/UserService.test.ts
  ✓ Test cases found: 5
  ✓ Tests failing: 5/5 (expected)

✓ Gate passed. Ready for GREEN phase.

Run: clarity phase green
```

---

### Gate 2: GREEN → REFACTOR

```typescript
async function gateGreenToRefactor(context: Context): Promise<GateResult> {
  console.log("🚦 Checking GREEN → REFACTOR gate conditions...")

  // 1. すべてのテストが成功するか
  const testResult = await runTests()

  if (testResult.failed > 0) {
    return {
      passed: false,
      reason: `${testResult.failed} tests failing`,
      failedTests: testResult.failedTests,
      suggestion: "Fix failing tests before proceeding to refactor"
    }
  }

  // 2. コードカバレッジは十分か（警告のみ）
  const coverage = await getCoverage()
  const warnings = []

  if (coverage < 80) {
    warnings.push(`Coverage is ${coverage}% (recommended: 80%+). Consider adding more tests.`)
  }

  // 3. コード品質チェック（警告のみ）
  const qualityIssues = await checkCodeQuality()
  if (qualityIssues.length > 0) {
    warnings.push(`${qualityIssues.length} code quality issues found. Refactoring recommended.`)
  }

  // 4. ユーザーに確認（オプション）
  if (context.interactive) {
    const userConfirm = await askUser(
      "All tests are passing. Proceed to refactor phase?",
      ["Yes", "No, commit as is", "Review code first"]
    )

    if (userConfirm === "No, commit as is") {
      return {
        passed: false,
        reason: "User chose to skip refactoring",
        action: "commit"
      }
    }

    if (userConfirm === "Review code first") {
      return {
        passed: false,
        reason: "User wants to review code",
        action: "review"
      }
    }
  }

  // すべての条件をクリア
  return {
    passed: true,
    message: "✓ All tests passing. Proceeding to REFACTOR phase.",
    warnings
  }
}
```

**実行例**:

```bash
$ clarity gate green-to-refactor

🚦 Checking GREEN → REFACTOR gate conditions...

  ✓ All 5 tests passing
  ⚠ Coverage is 75% (recommended: 80%+)
  ⚠ 2 code quality issues found:
    - UserService.registerUser() has complexity of 12 (max: 10)
    - Missing JSDoc comments

✓ Gate passed (with warnings). Ready for REFACTOR phase.

Proceed to refactor? (Y/n) Y

Run: clarity phase refactor
```

---

## 実装方式

### Option A: Claude Code Skills + Subagents（推奨）

Claude Codeの**Skills**と**Subagent**機能を活用した実装。

#### ディレクトリ構造

```
.claude/
├── skills/
│   ├── clarity-orchestrator.md      # メインオーケストレーター
│   ├── clarity-test-writer.md       # テストライターエージェント
│   ├── clarity-implementation.md    # 実装エージェント
│   └── clarity-refactor.md          # リファクタリングエージェント
└── hooks/
    ├── before-write.ts               # ファイル書き込み前チェック
    └── after-test.ts                 # テスト実行後の処理
```

#### メインスキル（clarity-orchestrator.md）

```markdown
---
name: clarity-orchestrator
description: Enforces RED-GREEN-REFACTOR cycle for LLM-driven development
---

# Clarity Framework - TDD Orchestrator

This skill enforces strict Test-Driven Development using subagents.

## Usage

When user requests a new feature, invoke this skill to orchestrate the RED-GREEN-REFACTOR cycle.

## Process

### Phase 1: RED (Test Writing)

Invoke the `clarity-test-writer` subagent:

```
Task: clarity-test-writer
Prompt: Write tests for {{feature}}
Requirements: {{requirements}}
Allowed Files: **/*.test.ts, **/*.spec.ts
Denied Files: **/!(*.test|*.spec).ts
```

After test writer completes:
1. Run tests → expect ALL to fail
2. Check gate conditions
3. If gate passes → proceed to GREEN

### Phase 2: GREEN (Implementation)

Invoke the `clarity-implementation` subagent:

```
Task: clarity-implementation
Prompt: Implement {{feature}} to make tests pass
Test File: {{testFile}} (read-only)
Allowed Files: **/*.ts
Denied Files: **/*.test.ts, **/*.spec.ts
```

After implementation completes:
1. Run tests → expect ALL to pass
2. Check gate conditions
3. If gate passes → ask user about REFACTOR

### Phase 3: REFACTOR (Optional)

If user wants to refactor, invoke `clarity-refactor` subagent:

```
Task: clarity-refactor
Prompt: Refactor {{feature}} while keeping tests green
Constraint: All tests must continue to pass
```

## Example

User: "Add user registration with email validation"

1. Orchestrator analyzes request
2. RED phase: Test Writer creates UserService.test.ts
3. Gate check: 5 tests failing ✓
4. GREEN phase: Implementation Agent creates UserService.ts
5. Gate check: 5 tests passing ✓
6. REFACTOR phase: (optional) Refactor Agent improves code
7. Commit changes

## Important

- NEVER skip phases
- ALWAYS check gates before proceeding
- ENFORCE file access restrictions
- VERIFY tests after each phase
```

#### Hooks実装例（before-write.ts）

```typescript
// .claude/hooks/before-write.ts

/**
 * Before Write Hook - Enforces file access restrictions
 *
 * This hook runs before Claude Code writes to any file.
 * It checks the current phase and enforces restrictions.
 */

export default async function beforeWrite(context) {
  const { file, content } = context

  // Get current phase from .clarity/state.json
  const phase = await getCurrentPhase()

  if (!phase) {
    // No active Clarity session
    return { allowed: true }
  }

  // Phase-specific restrictions
  switch (phase.name) {
    case 'RED':
      // In RED phase, only test files can be written
      if (!isTestFile(file)) {
        return {
          allowed: false,
          reason: `❌ RED Phase: Cannot modify ${file}`,
          message: `
            You are currently in RED phase (writing tests).

            Only test files (*.test.ts, *.spec.ts) can be modified.
            Implementation files are locked.

            To switch to GREEN phase:
            1. Ensure all tests are failing
            2. Run: clarity gate red-to-green
            3. Run: clarity phase green
          `
        }
      }
      break

    case 'GREEN':
      // In GREEN phase, test files cannot be modified
      if (isTestFile(file)) {
        return {
          allowed: false,
          reason: `❌ GREEN Phase: Cannot modify test files`,
          message: `
            You are currently in GREEN phase (writing implementation).

            Test files are locked (read-only).
            Focus on making tests pass.

            To modify tests, switch to REFACTOR phase:
            1. Ensure all tests are passing
            2. Run: clarity gate green-to-refactor
            3. Run: clarity phase refactor
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
  return { allowed: true }
}

function isTestFile(path: string): boolean {
  return path.endsWith('.test.ts') ||
         path.endsWith('.spec.ts') ||
         path.endsWith('.test.js') ||
         path.endsWith('.spec.js')
}

async function getCurrentPhase() {
  try {
    const stateFile = await readFile('.clarity/state.json')
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
clarity-framework/
├── cli/
│   └── clarity.ts                 # メインCLI
├── core/
│   ├── orchestrator.ts            # オーケストレーター
│   ├── gate-checker.ts            # ゲート条件チェック
│   └── phase-manager.ts           # フェーズ管理
├── prompts/
│   ├── test-writer.md             # テストライター用プロンプト
│   ├── implementation.md          # 実装エージェント用プロンプト
│   └── refactor.md                # リファクタリング用プロンプト
└── templates/
    └── clarity.config.ts          # デフォルト設定
```

#### CLI コマンド

```bash
# 初期化
$ clarity init

Creating Clarity workspace...
  ✓ .clarity/config.json
  ✓ .clarity/prompts/
  ✓ .clarity/state.json

# 新しいフィーチャー開始
$ clarity feature start "user-registration" \
    --requirement "Email validation" \
    --requirement "Password strength check"

Starting RED-GREEN-REFACTOR cycle for: user-registration

=== Phase 1: RED ===

📝 Test Writer Prompt:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Role: Test Writer

Write comprehensive tests for: user-registration

Requirements:
- Email validation
- Password strength check

Rules (STRICT):
1. Write ONLY test code
2. DO NOT write implementation
3. Tests MUST fail (no implementation exists yet)

Files to create:
- src/services/UserService.test.ts

Begin writing tests now.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Next steps:
1. Copy the prompt above
2. Paste into your LLM (Claude, ChatGPT, Cursor, etc.)
3. Save generated tests to: src/services/UserService.test.ts
4. Run: clarity gate red-to-green

# ゲートチェック
$ clarity gate red-to-green

🚦 Checking RED → GREEN gate conditions...

  ✓ Test file exists: src/services/UserService.test.ts
  ✓ Test cases found: 5
  ✗ Tests status: 3 passing, 2 failing

✗ Gate failed: Some tests are passing (expected: all failing)

Reason: Tests should fail because implementation doesn't exist yet.
The following tests are passing:
  - should import UserService class
  - should instantiate UserService

Action: Remove or fix these tests, then try again.

# テストを修正後、再チェック
$ clarity gate red-to-green

🚦 Checking RED → GREEN gate conditions...

  ✓ Test file exists: src/services/UserService.test.ts
  ✓ Test cases found: 5
  ✓ Tests failing: 5/5 (expected)

✓ Gate passed. Ready for GREEN phase.

Run: clarity phase green

# GREEN フェーズに移行
$ clarity phase green

=== Phase 2: GREEN ===

📝 Implementation Writer Prompt:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Role: Implementation Writer

Implement: user-registration

Failed Tests:
- should create user with valid email and password
- should reject invalid email format
- should reject weak password
- should prevent duplicate email
- should hash password before storing

Test File (READ-ONLY):
```typescript
[test file content shown here]
```

Rules (STRICT):
1. Write MINIMAL code to make tests pass
2. DO NOT modify tests
3. All tests MUST pass

Files to create:
- src/services/UserService.ts

Begin implementing now.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Next steps:
1. Copy the prompt above
2. Paste into your LLM
3. Save generated code to: src/services/UserService.ts
4. Run: clarity gate green-to-refactor

# 実装後、ゲートチェック
$ clarity gate green-to-refactor

🚦 Checking GREEN → REFACTOR gate conditions...

  ✓ All 5 tests passing
  ⚠ Coverage is 78% (recommended: 80%+)

✓ Gate passed (with warnings). Ready for REFACTOR phase.

Proceed to refactor? (Y/n) Y

# REFACTORフェーズ
$ clarity phase refactor

=== Phase 3: REFACTOR ===

[Refactoring prompt shown...]

# 完了
$ clarity complete

✓ Feature completed: user-registration

Summary:
  Phase RED: 5 tests written
  Phase GREEN: All tests passing
  Phase REFACTOR: Code improved

Commits:
  abc1234: Add user registration tests (RED)
  def5678: Implement user registration (GREEN)
  ghi9012: Refactor user service (REFACTOR)
```

#### 状態管理（.clarity/state.json）

```json
{
  "currentPhase": "GREEN",
  "feature": "user-registration",
  "requirements": [
    "Email validation",
    "Password strength check"
  ],
  "phases": {
    "RED": {
      "status": "completed",
      "testFile": "src/services/UserService.test.ts",
      "testCases": 5,
      "completedAt": "2026-03-04T10:30:00Z"
    },
    "GREEN": {
      "status": "in_progress",
      "implementationFile": "src/services/UserService.ts",
      "startedAt": "2026-03-04T10:35:00Z"
    },
    "REFACTOR": {
      "status": "pending"
    }
  }
}
```

---

## 実装計画

### Phase 1: MVP（2週間）

**目標**: 基本的なワークフロー強制を実現

**機能**:
1. **フェーズ管理**
   - `clarity phase red|green|refactor`
   - 状態管理（`.clarity/state.json`）

2. **プロンプト生成**
   - 各フェーズ用のプロンプトテンプレート
   - 動的な変数埋め込み（{{feature}}, {{requirements}}等）

3. **ゲートチェック**
   - `clarity gate red-to-green`
   - `clarity gate green-to-refactor`
   - テスト実行とカウント

4. **CLI基盤**
   - `clarity init`
   - `clarity feature start`
   - `clarity complete`

**成果物**:
- 動作するCLIツール（TypeScript製）
- 基本的なドキュメント
- デモ動画（3分）

**技術スタック**:
- TypeScript
- Commander.js（CLI）
- Jest（テストランナー統合）

---

### Phase 2: Claude Code統合（2週間）

**目標**: Claude CodeのSkillsとHooksを活用

**機能**:
1. **Skills実装**
   - `clarity-orchestrator` スキル
   - `clarity-test-writer` サブエージェント
   - `clarity-implementation` サブエージェント
   - `clarity-refactor` サブエージェント

2. **Hooks実装**
   - `before-write.ts`: ファイル書き込み制限
   - `after-test.ts`: テスト実行後の自動ゲートチェック

3. **Subagent orchestration**
   - エージェント間の自動切り替え
   - ファイルアクセス制限の自動適用

**成果物**:
- Claude Code用Skillsパッケージ
- インストールガイド
- ビデオチュートリアル

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
   - ワンクリックでプロンプトコピー
   - テスト実行とゲートチェックの可視化

4. **GitHub Actions**
   - CI/CDでのゲートチェック自動化
   - PRコメントに結果表示

**成果物**:
- VSCode拡張（Marketplace公開）
- GitHub Actions workflow
- 包括的なドキュメント

---

### Phase 4: 高度な機能（1ヶ月）

**目標**: より高度なエラー防止機能

**機能**:
1. **コード品質チェック**
   - 循環的複雑度測定
   - マジックナンバー検出（ESLintルール）

2. **ドメインルール定義**
   - 簡易版（zodスキーマベース）

3. **一貫性チェック**
   - 命名規則検証
   - アーキテクチャパターン検証

4. **ダッシュボード**
   - Web UIでフェーズ可視化
   - メトリクス表示

**成果物**:
- 拡張機能パッケージ
- ダッシュボード（Next.js製）

---

## 成功指標

### 定量的指標

| 指標 | 目標値 | 測定方法 |
|---|---|---|
| **テストファースト遵守率** | 90%以上 | REDフェーズで作成されたテスト / 総テスト数 |
| **テスト成功率（GREENフェーズ）** | 95%以上 | 1回目の実装でテストが通る割合 |
| **フェーズ順守率** | 100% | RED→GREEN→REFACTORの順序が守られる割合 |
| **ゲート通過率** | 90%以上 | ゲートチェックが1回で通る割合 |
| **平均サイクルタイム** | <30分 | RED→GREEN→REFACTOR完了までの時間 |
| **コードレビュー指摘削減** | 50%削減 | Clarity使用前後の指摘数比較 |

### 定性的指標

| 指標 | 測定方法 |
|---|---|
| **開発者満足度** | アンケート（5段階評価、目標4以上） |
| **学習曲線** | 初回使用から習熟までの時間（目標1週間以内） |
| **採用率** | GitHub Stars、npmダウンロード数 |

### 検証方法

1. **ベンチマークテスト**
   - HumanEvalベンチマークでClarity使用前後を比較

2. **ユーザースタディ**
   - 10名のアーリーアダプターによる1ヶ月間の使用

3. **A/Bテスト**
   - 同じフィーチャーをClarityあり/なしで実装し比較

---

## リスクと対策

### リスク1: LLMがルールを無視する

**リスク**: プロンプトで指示してもLLMが実装ファーストで書いてしまう

**対策**:
- **Option A（Claude Code）**: Hooksでファイル書き込みを物理的にブロック
- **Option B（汎用）**: ゲートチェックで検出し、やり直しを促す
- **教育**: ドキュメントとチュートリアルで正しいワークフローを啓蒙

### リスク2: 学習コストが高い

**リスク**: 開発者が新しいワークフローに適応できない

**対策**:
- **段階的導入**: 既存プロジェクトに部分的に適用可能
- **豊富な例**: サンプルプロジェクト、ビデオチュートリアル
- **プリセット**: デフォルト設定で即座に使える

### リスク3: 既存ツールとの競合

**リスク**: ESLint、Jest等との統合が難しい

**対策**:
- **標準ツールを活用**: Jest/Vitestをそのまま使用
- **ESLint拡張**: Clarityルールを追加プラグインとして提供
- **設定インポート**: 既存の設定を自動検出

### リスク4: パフォーマンス問題

**リスク**: ゲートチェックやテスト実行が遅い

**対策**:
- **キャッシング**: テスト結果をキャッシュ
- **並列実行**: 可能な部分は並列化
- **増分チェック**: 変更されたファイルのみチェック

---

## 参考文献

1. "Towards Understanding the Characteristics of Code Generation Errors Made by Large Language Models" (ICSE 2025)
   - LLMのエラーパターン分類

2. "Test-Driven Development for Code Generation" (arXiv 2024)
   - TDDとLLMの組み合わせの有効性

3. "Why Does Test-Driven Development Work So Well In AI-assisted Programming?" (2026)
   - TDDがLLM開発に適している理由

4. "Claude Code and the Art of Test-Driven Development" (The New Stack, 2025)
   - Claude CodeでのTDD実践例

5. "Forcing Claude Code to TDD: An Agentic Red-Green-Refactor Loop" (alexop.dev, 2026)
   - マルチエージェント実装の実例

6. "My LLM coding workflow going into 2026" (Addy Osmani, Medium)
   - 実務でのLLMワークフロー

---

## まとめ

### 設計の要点

| 要素 | 説明 |
|---|---|
| **コアアイデア** | LLMに「一度に全部やらせない」 |
| **実現方法** | 役割分離された専門エージェント |
| **強制機構** | ファイルアクセス制限 + システムプロンプト + ゲート条件 |
| **検証** | 各フェーズ間のゲート条件チェック |
| **実装** | Option A (Claude Code Hooks) or Option B (汎用CLI) |

### v1.0からの主な変更

| v1.0（廃案） | v2.0（本設計） |
|---|---|
| 事後対処型（自動revert） | 事前防止型（プロセス強制） |
| 14の複雑な機能 | 3つのシンプルなエージェント |
| 独自DSL（`clarityTest()`等） | 既存ツール（Jest/TypeScript） |
| 実現困難な機能を含む | 実現可能な技術のみ |

### 最大の価値提案

**「LLMにTDDサイクルを物理的に強制し、エラーを起こさせない」**

これにより：
1. **品質向上**: エラーの事前防止
2. **プロセス改善**: 一貫性のある開発フロー
3. **学習効果**: 開発者がTDDを自然に習得

---

## 次のステップ

1. **Phase 1 MVP開発開始**（2週間）
   - CLI基盤の実装
   - プロンプトテンプレート作成
   - ゲートチェック実装

2. **アーリーアダプター募集**
   - オープンソース公開（GitHub）
   - フィードバック収集

3. **Claude Code統合**（Phase 2）
   - Skills/Hooks実装
   - Subagent orchestration

4. **継続的改善**
   - ユーザーフィードバックに基づく機能追加
   - 他のLLMツールへの対応（Phase 3-4）
