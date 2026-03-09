# 🙊 OOPS Framework

**No more "Oops, I broke it again!" 💥**

You asked your LLM to write some code. It jumped straight into implementation without writing a single test. You ran it. It broke.

> "Oops...😅"

Sound familiar?

OOPS Framework **physically enforces TDD discipline on LLMs (Claude Code)**. Instead of politely asking "please write tests first 🙏", it **blocks implementation files until tests exist**. Not a request — an enforcement 🔒

[🇯🇵 日本語版 README](README.ja.md)

---

## 🔧 How It Works

Uses [Claude Code Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) to **block file edits based on the current TDD phase**.

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

When the LLM thinks "let me just sneak in some implementation... 😏":

```
  🤖 Claude: Edit src/calculator.js
  🚨 Hook: Phase: RED - Only test files allowed. Cannot modify: src/calculator.js
```

**Oops! 🙊** Blocked! Write those tests first!

---

## 🚀 Quick Start

```bash
# Install 📦
npm install -g oops-framework

# Initialize in your project
cd your-project
oops init

# Start feature development (auto-enters RED phase 🔴)
oops feature start add-login

# Write tests ✍️ (RED phase: only test files editable)
# ... write your tests ...

# Transition to GREEN phase 🟢 (only implementation files editable)
oops phase green

# Write minimal implementation 💻
# ... write implementation ...

# Transition to REFACTOR phase 🔄 (both editable)
oops phase refactor

# Refactor ✨ (keep tests passing)
# ... refactor ...

# Feature complete! 🎉
oops feature complete
```

---

## 📊 The "Oops" Counter

Every time the LLM tries to edit a file that violates the current phase, the Oops counter goes up 😱

```
$ oops stats

📊 OOPS Framework Statistics
===================================
  Phase:     GREEN 🟢
  Oops Count: 3  💀💀💀
  Last Oops:  2026-03-05T01:23:45.000Z
```

Complete a feature with zero Oops and... 🏆

```
$ oops feature complete

  ✅ Feature completed: add-login
  🙊 Oops prevented: 0

  🎉 Perfect TDD cycle! No oops!
```

Nailed it! ✨

---

## 🧩 Task Decomposition

Got a big task like "build an inventory management system"? No problem 💪

OOPS automatically breaks it into subtasks, each protected by its own TDD cycle!

```bash
# Break down the task 📋
oops plan create \
  --goal "Inventory Management System" \
  --subtask "Product Model: Product type and validation" \
  --subtask "Product CRUD: API endpoints" \
  --subtask "Stock Management: inventory logic"

# Work through subtasks one by one 🏃‍♂️
oops plan next    # → Product Model (RED 🔴 phase)
# ... RED → GREEN → REFACTOR ...
oops plan done    # → Done! Next up ✅

oops plan next    # → Product CRUD (RED 🔴 phase)
# ...
oops plan done    # ✅

oops plan next    # → Stock Management (RED 🔴 phase)
# ...
oops plan done    # ✅

oops plan complete  # 🎉 All done!
```

Every subtask is locked down by the OOPS cycle 🛡️

---

## 📖 Commands

| Command | Description |
|---------|-------------|
| `oops init` | 🏗️ Initialize the framework |
| `oops phase` | 👀 Show current phase |
| `oops phase red\|green\|refactor\|none` | 🔀 Transition phase |
| `oops feature start <name>` | 🚀 Start feature development (→ RED 🔴) |
| `oops feature start --no-tdd <name>` | 📝 Start without TDD (docs, config, etc.) |
| `oops feature complete` | 🎉 Complete the feature (auto-syncs plan subtask) |
| `oops gate` | 🚦 Gate check (verify transition conditions) |
| `oops stats` | 📊 Show statistics |
| `oops plan create` | 📋 Create a task decomposition plan |
| `oops plan show` | 🗺️ Show the plan |
| `oops plan next` | ▶️ Start the next subtask |
| `oops plan done` | ✅ Complete the current subtask |
| `oops plan complete` | 🏆 Complete the entire plan |

---

## 🤖 Claude Code Integration

OOPS Framework runs on [Claude Code Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks).
Humans do what they always do — just tell Claude Code "build X"!
OOPS handles drilling TDD discipline into Claude Code 🥋

### Hooks 🪝

- **PreToolUse** — Intercepts Edit/Write/NotebookEdit. Instant block on phase violations 🚫
- **PostToolUse** — Auto-runs tests after file changes 🧪 (optional)

### Skills 📚

Three skills are included in `.claude/skills/`:

- **oops-orchestrator** 🎭 — Conducts the entire TDD session
- **oops-test-writer** ✍️ — Guides test creation during RED phase
- **oops-implementation** 💻 — Guides minimal implementation during GREEN phase

---

## 🤔 Why "OOPS"?

**O**rchestrated **O**bligatory **P**rocess **S**ystem

Fancy name, but what it really means:

> 🙊 A framework that stops LLMs from ever having to say "Oops."

Hooks prevent the "Oops" of writing code without tests and breaking things.
And if the LLM still tries to break the rules? The counter's watching 👀

**Aim for Oops 0!** 🏆

---

## 📄 License

MIT
