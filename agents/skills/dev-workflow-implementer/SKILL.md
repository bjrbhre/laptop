---
name: dev-workflow-implementer
description: Implement a vertical-slice step from its spec, write implementation notes, and respond to reviews. Use when instructed to implement a specific step, when reading step specs, or when addressing review feedback. Triggers on "implement step N", "code step N", "address reviews".
---

# Dev Workflow — Implementer

Implement one step at a time from its spec. Write implementation notes. Address reviews. Never modify reviewer files or frozen specs.

## Directory structure

```
rfc/000-pi-notion-mcp/
├── rfc.md
├── steps/
│   ├── 1-hello-notion.md       ← you read this
│   ├── 2-connect.md            ← frozen (has review files)
│   └── 2b-connect-fix.md      ← amendment (created by planner)
└── reviews/
    └── 1/
        ├── notes.md            ← you write this (notes + responses + later)
        ├── reviewer-01.md      ← you NEVER touch this
        └── reviewer-02.md      ← you NEVER touch this
```

One file per step for you: `notes.md`. Everything goes in there — implementation notes, responses to reviews, and deferred items.

## Core Rules

1. **One step at a time.** Read the step spec. Implement exactly what it says. Nothing more, nothing less.
2. **Never modify reviewer files.** Files named `reviewer-*.md` are off-limits. You own `notes.md` only.
3. **Never modify frozen steps or RFC sections.** A step is frozen once any file exists in `reviews/<step>/`. An RFC section is frozen once a step referencing it has been implemented. If the spec is wrong, flag it under `## Deviations` with `**Amendment needed.**` — do not edit the spec yourself.
4. **English only.** All code, comments, commit messages, notes in English.
5. **Commit when done.** Each completed step = one commit with message `"Step N: <name>"`.

## Process

### Step 1: Read the spec

Read `rfc/<project>/steps/<number>-<name>.md`. Also read `rfc/<project>/rfc.md` for any referenced technical sections.

If the spec references "the OAuth Reference section", go read that section in `rfc.md`. Do not guess.

**Do not read anything else.** Specifically:
- Do not read `reviews/` files from previous steps — they are review artifacts, not spec. The RFC and step specs are the single source of truth.
- Do not read `notes.md` from previous steps — if a deferred item matters, the planner already propagated it into your step spec as a task.
- Do not read `reviewer-*.md` from any step — reviewer files are off-limits, even for your own step.

If you find yourself exploring the `reviews/` directory, stop. You already have everything you need.

### Step 2: Implement

Follow the spec procedurally. Work top to bottom through the instructions.

- Use exact file paths from the spec.
- Use exact function signatures from the spec.
- If something is ambiguous, prefer the simplest interpretation that passes validation.
- Do not add features "that might be useful later". Out-of-scope items exist for a reason.
- If the spec is wrong or impossible to implement as written, **do not silently deviate**. Flag it in `## Deviations` with `**Amendment needed.**` and implement the closest correct behavior.

### Step 3: Validate

Run the exact validation commands from the spec. If they fail, fix the code — not the spec.

### Step 4: Commit

```bash
git add -A
git commit -m "Step N: <name>"
```

### Step 5: Write implementation notes

Create `rfc/<project>/reviews/<step>/notes.md` after committing:

```markdown
---
role: implementer
skills: dev-workflow-implementer
provider: <REQUIRED — if not provided in the prompt, ask the user before proceeding>
model: <REQUIRED — if not provided in the prompt, ask the user before proceeding>
rfc: <RFC directory name>
step: N
branch: <git branch — the branch under review>
---

# Step N — Implementation Notes

## Summary — commit <hash> — <ISO 8601>

Scope: path/to/file1.ts, path/to/file2.ts

<What was implemented, in 2-3 sentences>

## Decisions
- <Decision made and why, if the spec had ambiguity>

## Deviations
- <Any deviation from the spec and why, or "None">
- If the spec is wrong: `Cannot implement as specified: <description>. Affects Step N task M. **Amendment needed.**`
```

### Step 6: Address reviews

When reviewer files exist in `reviews/<step>/`:

1. Read every `reviewer-*.md` file.
2. For each finding, decide: **Fixed**, **Declined** (with reason), or **Deferred** (to which step).
3. Modify code for all **Fixed** items. Commit.
4. Append to `notes.md` — add a `## Reviews — Round R — commit <hash> — <ISO 8601>` section for each round of reviews, and a `## Later` section at the end:

```markdown
## Reviews — Round 1 — commit abc1234 — 2026-05-15T20:00:00Z

### reviewer-01 (architecture)

Scope: path/to/file1.ts, path/to/file2.ts

- [CRITICAL] path traversal in auth-path: **Fixed** in abc1234. Added path validation against agentDir.
- [SUGGESTION] async readFile: **Declined**. Sync read is fine for a startup check that runs once.

### reviewer-02 (security)

Scope: path/to/file3.ts

- [CRITICAL] username leak in notify: **Fixed** in abc1234. Redacted to filename only.

## Later

- [reviewer-01] `strict: true` in tsconfig — jiti doesn't enforce it. Revisit if we add a build step.
- [reviewer-02] `renameSync` overwrites target — low risk for now, only triggers during legacy migration. Worth a guard if migration code survives Step 3.
```

5. No frontmatter update needed — per-round data is in section headers.

### Step 7: Re-review cycle

If reviewers append edits to their files (new `### Edit N` sections) after you respond:

1. Read the new edits in each `reviewer-*.md`.
2. Append `## Reviews — Round 2 — commit <hash> — <ISO 8601>` (or next round) to `notes.md`.
3. Address only the new findings from that round.
4. Commit. No frontmatter update needed.

## What NOT to do

- Do not modify any `reviewer-*.md` file.
- Do not edit frozen step specs or RFC sections — flag problems instead.
- Do not implement features from future steps.
- Do not skip validation.
- Do not leave TODO comments in shipped code.
- Do not write non-English text anywhere in the repository.
