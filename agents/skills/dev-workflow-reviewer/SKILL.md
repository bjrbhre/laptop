---
name: dev-workflow-reviewer
description: Review a completed implementation step against its spec, write findings with metadata, and append edits for cross-reviews or re-reviews. Use when asked to review, audit, or inspect a step. Triggers on "review step N", "audit step N", "check the code".
---

# Dev Workflow — Reviewer

Review a completed step. Write structured findings. Never modify code or implementer notes. Append edits if re-reviewing after changes or reading another reviewer's work.

## Directory structure

```
rfc/000-pi-notion-mcp/
├── rfc.md
├── steps/
│   └── 1-hello-notion.md        ← you read this
└── reviews/
    └── 1/                        ← you work here
        ├── notes.md              ← you read this, you NEVER modify it
        ├── reviewer-01.md        ← your file or another reviewer's
        └── reviewer-02.md        ← another reviewer's file
```

### Your file locations

| What | Where |
|------|-------|
| Your review | `reviews/<step>/reviewer-<number>.md` |

You get assigned a number by the orchestrator (e.g. "you are reviewer-02"). Use that number in your filename.

### Files you NEVER touch

| File | Who owns it |
|------|------------|
| Any file outside `reviews/` | Not you — ever |
| `notes.md` | Implementer |
| Another reviewer's `reviewer-*.md` | That reviewer |

## Core Rules

1. **Never modify code files.** Not even one line. Not even a typo fix. You review, you don't edit.
2. **Never modify `notes.md`.** That file belongs to the implementer.
3. **Never modify another reviewer's file.** If you read their review and want to update yours, append an `### Edit N` section.
4. **English only.** All review text in English.
5. **Append-only in your own file.** Never rewrite previous sections. New findings go as edits at the bottom.
6. **Explicit verdict.** Every review ends with a clear verdict: APPROVE, REQUEST_CHANGES, or COMMENT.
7. **Never modify frozen specs.** If the step spec or RFC section is wrong, flag it as a finding with `[SUGGESTION] Spec issue:` and describe the problem. The implementer will flag it as `**Amendment needed.**` in their deviations. The orchestrator then decides whether the planner creates an amendment.

## Process

### Step 1: Gather context

Read these files in order:
1. The step spec: `rfc/<project>/steps/<number>-<name>.md`
2. The RFC: `rfc/<project>/rfc.md` (for technical references)
3. The implementation notes: `rfc/<project>/reviews/<step>/notes.md`
4. All code files changed in the step (use `git diff <prev-tag>..HEAD` or read the files listed in the scope)

### Step 2: Review against the spec

For each requirement in the step spec, verify it is implemented. Check:

| Dimension | What to verify |
|-----------|---------------|
| **Correctness** | Does the code do what the spec says? |
| **Completeness** | Is anything from the spec missing? |
| **Conventions** | Does the code follow the RFC's conventions? |
| **Edge cases** | What happens with empty inputs, expired tokens, missing files? |
| **Security** | Are credentials handled safely? File permissions? Input validation? |
| **English** | Is all text (comments, strings, docs) in English? |

### Step 3: Write the review

Create your file at `rfc/<project>/reviews/<step>/reviewer-<number>.md`:

```markdown
---
role: reviewer
skills: dev-workflow-reviewer
provider: <REQUIRED — if not provided in the prompt, ask the user before proceeding>
model: <REQUIRED — if not provided in the prompt, ask the user before proceeding>
rfc: <RFC directory name>
step: N
branch: <git branch — the branch under review>
---

# Step N Review — <your-name>

## Round 1 — commit <hash> — <ISO 8601>

Scope: path/to/file1.ts, path/to/file2.ts
Verdict: APPROVE | REQUEST_CHANGES | COMMENT

## Findings

- [CRITICAL] <file>:<line> — <description of the problem>
  <expected behavior vs actual behavior>

- [SUGGESTION] <file>:<line> — <description>
  <rationale for the suggestion>

- [NIT] <file>:<line> — <description>

- [OK] <file>:<line> — <notably good implementation choice>
```

### Severity definitions

| Level | Meaning |
|-------|---------|
| **CRITICAL** | Must fix before proceeding. Bug, security issue, spec violation, or broken validation. |
| **SUGGESTION** | Should fix. Better approach, missing edge case, or improvement to maintainability. |
| **NIT** | Nice to fix. Style, naming, minor clarity. |
| **OK** | Explicitly calling out good decisions. Use sparingly, for non-obvious choices worth preserving. |

### Step 4: Cross-review (if applicable)

If you read another reviewer's file and it changes your assessment:

1. Do NOT modify your existing sections.
2. Append an edit at the bottom:

```markdown
## Edits

### Edit 1 — <ISO 8601 timestamp>
After reading reviewer-01's review, adding:

- [CRITICAL] <file>:<line> — <new finding triggered by cross-review>
```

### Step 5: Re-review (round 2+)

If the implementer has addressed your review and you are asked to re-review:

1. Append a new section to your existing file (do not create a new file).
2. Only document findings that persist or are new. Do not re-list resolved items unless they regressed.
3. Re-issue your verdict in the new section header:

```markdown
## Round 2 — <ISO 8601>

Commit: <short hash>
Scope: path/to/changed/file.ts
Verdict: APPROVE | REQUEST_CHANGES | COMMENT

- [RESOLVED] <file>:<line> — <original finding>. Fixed.
- [PERSISTS] <file>:<line> — <original finding>. Still present.
- [NEW] <file>:<line> — <new finding>.

Verdict: APPROVE | REQUEST_CHANGES | COMMENT
```

## What NOT to do

- Do not edit, move, or refactor any code file — not even one line.
- Do not edit `notes.md` — that belongs to the implementer.
- Do not edit another reviewer's `reviewer-*.md` file.
- Do not delete or rewrite your own previous findings — append edits.
- Do not issue a verdict without reading the spec first.
- Do not approve if any CRITICAL finding is open.
