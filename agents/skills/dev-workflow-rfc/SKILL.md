---
name: dev-workflow-rfc
description: Produce an RFC from competitive analysis of reference projects, with full technical specs and vertical-slice step breakdown. Use when starting a new project that builds on existing work, comparing repos, or creating a project plan with implementation steps. Triggers on "write the RFC", "create the project plan", "compare these repos for an RFC", "competitive analysis to RFC".
---

# Dev Workflow — RFC Author

Produce a complete RFC: competitive analysis, technical specs, and vertical-slice step breakdown. One skill, one directory, one coherent document.

## Directory structure

Every RFC lives in its own directory under `rfc/`:

```
rfc/
├── 000-pi-notion-mcp/
│   ├── rfc.md                          ← the RFC (analysis + specs + step breakdown)
│   ├── steps/
│   │   ├── 1-hello-notion.md
│   │   ├── 2-connect.md
│   │   └── ...
│   └── reviews/
│       ├── 1/
│       │   ├── notes.md                ← implementer: notes + responses + later
│       │   ├── reviewer-01.md          ← reviewer: findings + edits
│       │   └── reviewer-02.md          ← reviewer: findings + edits
│       ├── 2/
│       └── ...
├── 001-another-project/
│   └── ...
└── ...
```

### Naming rules

| Path part | Pattern | Example |
|-----------|---------|---------|
| RFC directory | `<number>-<project-name>` | `000-pi-notion-mcp` |
| RFC document | `rfc.md` | always exactly `rfc.md` |
| Step spec | `<number>-<name>.md` | `1-hello-notion.md` |
| Implementer notes | `notes.md` | always exactly `notes.md` |
| Reviewer file | `reviewer-<number>.md` | `reviewer-01.md` |

**No metadata in filenames.** All metadata lives in the frontmatter and section headers of each file. The filename just distinguishes multiple files of the same role within one directory.

**No round subdirectories.** Rounds are tracked in section headers. Everything is append-only.

### Navigation

```bash
ls rfc/                              # all RFC projects
ls rfc/000-pi-notion-mcp/steps/      # all steps
ls rfc/000-pi-notion-mcp/reviews/    # which steps have review activity
ls rfc/000-pi-notion-mcp/reviews/1/  # notes? reviewers?
```

Each `ls` returns under ~10 entries.

## What this skill does

1. **Competitive analysis** — what each reference project does well, what it does poorly
2. **Technical decision record** — what to take, what to reject, what to build fresh
3. **Complete technical specs** — endpoints, protocols, signatures, formats, conventions
4. **Vertical-slice step breakdown** — each step testable, each step depends only on the previous
5. **Review workflow** — directory layout, templates, process rules

## What this skill does NOT do

- Implement code
- Review code
- Create repos or projects from scratch without reference material

## Process

### Step 1: Forensic analysis of each reference project

For each reference project, gather signals:

1. **Package manifest** — package.json, dependencies, scripts, pi manifest
2. **README + docs** — stated purpose, stated audience
3. **Entry points** — main files, extension entry points, what runs first
4. **Directory structure** — top 2 levels
5. **Key source files** — read the actual implementation, not just the docs

Use the `repo-forensics` skill if available. Otherwise, do the analysis manually.

### Step 2: Comparative table

Produce an honest comparison. Rate each project on:

| Dimension | Signals to look for |
|-----------|-------------------|
| Problem-Solution Fit | Does the code solve a real problem? Or is it a solution looking for a problem? |
| Accidental Complexity | Are there dependencies, abstractions, or indirections that don't earn their place? |
| Narrative Coherence | Does the code do what the README promises? |

Traffic light each: 🟢 Sound / 🟡 Drifting / 🔴 Strained. Each rating needs 2+ observable signals.

### Step 3: Decision record

For each technical decision, document:

| Decision | Source | Take / Reject / Build fresh | Why |
|----------|--------|----------------------------|-----|
| OAuth flow | repo A | Take | Correct MCP OAuth, PKCE, no client_secret |
| Callback server | repo B | Reject | Raw net socket parsing is fragile |
| Dynamic tool registration | repo B | Take | pi.registerTool pattern is right |

Never take without citing. Never reject without explaining.

### Step 4: Technical specs

Document complete specs for every protocol, API, and convention the implementation will use. Include:

- Exact endpoints and HTTP methods
- Request and response shapes (with code blocks)
- Error handling patterns
- File formats and storage conventions
- Package configuration (package.json fields, pi manifest)
- Language rules
- Import paths

**The spec must be self-contained.** An implementer reading only `rfc.md` and the existing code must have everything needed — no external lookups, no "see the source repo for details".

### Step 5: Vertical-slice step breakdown

Slice the RFC into sequential steps. Each step:

| Criterion | Requirement |
|-----------|------------|
| Vertical slice | Delivers working value end-to-end |
| Testable | Can be validated by running the product |
| Linear | Depends only on previous steps |
| Small | Under 90 min implementation |
| English only | All output in English |

Before writing step specs, read all existing `reviews/<step>/notes.md` files from previous steps and collect every item under `## Later`. These are deferred findings that must be addressed in a future step. Distribute each Later item into the appropriate upcoming step spec as a task.

Produce one file per step in `steps/<number>-<name>.md`. Each step spec is self-contained and references back to the technical sections of `rfc.md` by section name — never by copying content.

**Never duplicate task lists in the RFC.** The RFC contains technical references and conventions. The step specs contain tasks. These are two separate concerns. Duplication causes drift: when the same task is described in two places, reviewers confirm the copy instead of challenging the content.

### Step 6: Review workflow

Document the review process within `rfc.md`:

- Directory layout (as shown above)
- File metadata: frontmatter contains only stable fields that never change across rounds (role, skills, provider, model, rfc, step, branch). Per-round data (commit, timestamp, scope, verdict) lives in section headers
- Rules: reviewers never touch code or `notes.md`, implementer never touches reviewer files, everything is append-only
- Process: implement → review (parallel) → respond in `notes.md` → re-review if needed → tag → next step
- Freeze rules and amendment process (see below)

### Step 7: Freeze rules

The RFC and step specs are a **contract**. They cannot shift under the reviewers' feet. But implementation reveals what the spec missed. Balance both needs with progressive freezing:

**When does a step become frozen?**

A step is editable until any file appears in `reviews/<step>/`. Once `notes.md` or a `reviewer-*.md` exists, the step spec is frozen.

**When does an RFC section become frozen?**

An RFC section is frozen once a step that references it has been implemented (i.e. has files in `reviews/<step>/`).

**What if a frozen step or section needs a change?**

Do not edit the frozen document. Create an **amendment** — a new step spec that references the original and documents the delta:

```
steps/
├── 1-hello-notion.md          ← frozen
├── 2-connect.md               ← frozen
├── 2b-connect-fix.md          ← amendment: fixes missing PKCE prerequisite
├── 3-discovery.md             ← still editable
```

Amendment naming: `<original-number><letter>-<name>.md`. The letter increments: `2a`, `2b`, `2c`...

An amendment must contain:
- A reference to the original step (by number and name)
- The specific change and why it's needed
- Updated tasks and validation
- The same frontmatter schema as a regular step (minus `branch` — the orchestrator assigns it)

**Who triggers an amendment?**

The implementer discovers the problem during implementation. In `notes.md`, under `## Deviations`, they write:

```markdown
## Deviations
- Cannot implement as specified: <description of the problem>.
  Affects Step N task M. **Amendment needed.**
```

The orchestrator then decides: create an amendment, or insert a new step, or adjust a future unfrozen step.

**Who creates the amendment?**

The planner (RFC author) creates the amendment file. The planner may also edit unfrozen steps or RFC sections directly if the change doesn't affect frozen content. If the planner identifies a spec problem independently (e.g. during a review of another step), the same process applies: flag it, and the orchestrator commissions the amendment.

**What never changes?**

- A step that has been reviewed and approved (tagged) is permanently frozen. No amendment can modify it — only append after it.
- The RFC directory name never changes.

## Common frontmatter schema

Every file inside `reviews/<step>/` uses this frontmatter. It contains **only stable fields** — values that do not change across rounds. The branch under review is stable and belongs here. Per-round data (commit, timestamp, scope, verdict) goes in section headers within the file body.

```yaml
---
role: implementer | reviewer
skills: <space-separated skill names>
provider: <REQUIRED — if not provided in the prompt, ask the user before proceeding>
model: <REQUIRED — if not provided in the prompt, ask the user before proceeding>
rfc: <RFC directory name>
step: N
branch: <git branch — the branch under review>
---
```

Per-round data is placed in each section header:

**notes.md:**
```markdown
## Summary — commit <hash> — <ISO 8601>

Scope: path/to/file1.ts, path/to/file2.ts

## Reviews — Round 1 — commit <hash> — <ISO 8601>
```

**reviewer-01.md:**
```markdown
## Round 1 — commit <hash> — <ISO 8601>

Scope: path/to/file1.ts, path/to/file2.ts
Verdict: APPROVE | REQUEST_CHANGES | COMMENT
```

## RFC template

```markdown
# <project-name> — <tagline>

> <one-line description of what this project does>

## Language rule

**Everything in this repo must be in English** — code, comments, variable names, README, SKILL.md files, commit messages, test descriptions. No exceptions.

## Context

<Competitive analysis of reference projects>

<Comparative table with traffic lights>

## Technical decisions

<Decision record table>

## Technical reference

<Complete specs — protocols, APIs, conventions, packaging>

## Implementation plan

Vertical slices live in `steps/<number>-<name>.md`. Each step spec is self-contained and references back to the technical sections of this document by name. Task lists are never duplicated here — this section only lists the step names and their one-line capability for navigation.

| Step | Name | Capability |
|------|------|------------|
| 1 | Hello Notion | Extension loads, status command works |
| 2 | Connect | OAuth MCP flow + token persisted |
| ... | ... | ... |

## Review workflow

<Directory layout, naming rules, common frontmatter, process>

## Directory structure

<Target file tree of the finished project>
```

## Key rules

- **Self-contained.** The RFC must contain everything an implementer needs. No "see external doc" handwaves.
- **Honest ratings.** Don't rate 🟢 without 2 signals. Don't soften 🔴 to 🟡 to be nice.
- **English only.** The entire RFC in English.
- **License-compatible.** When taking from a reference project, name it, link it, state its license. Include an Attribution section if the license requires it.
- **Specs are executable.** Code blocks in specs must be syntactically valid — an implementer should be able to copy-paste them.
- **Single source of truth for tasks.** Step specs live in `steps/` only. The RFC contains technical references and a navigation table — never a duplicated task list. Duplication causes drift.
- **Propagate Later items.** When writing or updating step specs, read all `## Later` sections from previous steps' `notes.md` and include relevant items as tasks in the upcoming step specs. Nothing falls through the cracks.
