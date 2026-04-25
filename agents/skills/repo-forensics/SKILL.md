---
name: repo-forensics
description:
  Interrogate codebases for product purpose, philosophy, and architectural honesty. Produce progressive analysis with traffic-light KPIs across Problem-Solution Fit, Accidental Complexity, and Narrative Coherence. Use when exploring a new repo, comparing repos, onboarding to a project, or challenging architectural choices. Triggers include "analyze this repo", "forensic analysis", "compare these repos", "what is this codebase about", "how honest is this architecture".
---

# Repo Forensics

Interrogate codebases — don't just describe them. Extract purpose, expose philosophy, challenge assumptions. Every output answers: *what does this code reveal about the product intent?*

## Depth Levels

Three depth levels. Each produces a specific artifact. Never skip ahead without delivering the current level.

| Level | Artifact | When |
|-------|----------|------|
| **1. TL;DR** | 15-line executive summary + KPIs | First contact with any repo |
| **2. Report** | Structured analysis + C4 diagrams + challenge dimensions | Understanding a repo for real work |
| **3. Deep Dive** | Per-module analysis + component diagrams + coupling map | Working inside a specific module |

Ask the user which depth they want. Default to TL;DR.

## Phase 0: Reconnaissance (Always Run First)

Before any depth level, gather raw signals. Run `signal_scan.sh` first, then supplement manually.

```bash
bash /Users/pierrebeauhaire/.agents/skills/repo-forensics/scripts/signal_scan.sh [repo-path]
```

Then collect these signals manually:

1. **Package manifest** — read package.json / go.mod / Cargo.toml / pyproject.toml / pom.xml. Extract: language, framework, dependency list, scripts.
2. **README + docs** — read README.md and any docs/ folder. Extract: *stated* purpose, *stated* audience.
3. **Entry points** — find main.*, index.*, app.*, server.*, cmd/. Map what runs first.
4. **Directory structure** — top 2 levels. Ignore node_modules, vendor, .git, dist, build, __pycache__.
5. **Git recent history** — last 20 commit messages. Extract: what actually changes (vs. what docs claim).

## Level 1: TL;DR

Produce exactly this format:

```
repo-forensics: [repo-name]

Purpose: [One sentence: what problem does this solve for whom]
Philosophy: [One sentence: the design thesis that organizes the codebase]

Problem-Solution Fit    [🟢/🟡/🔴] [Sound/Drifting/Strained] — [one-line justification]
Accidental Complexity   [🟢/🟡/🔴] [Sound/Drifting/Strained] — [one-line justification]
Narrative Coherence     [🟢/🟡/🔴] [Sound/Drifting/Strained] — [one-line justification]

Stack: [language + framework + key deps]
Architecture: [monolith/microservices/serverless/etc.]
Key risk: [one sentence]
```

When comparing multiple repos, add a comparison table:

```
| Repo | Purpose | Fit | Complexity | Coherence |
|------|---------|-----|------------|-----------|
| [name] | [one-liner] | 🟢 | 🟡 | 🟢 |
```

### KPI Rating Rules

Rate from observable signals — never from vibes. Each rating requires at least 2 supporting signals. For full rubrics, load [references/challenge-framework.md](references/challenge-framework.md).

**Quick signal guide:**

- 🟢 **Sound** — signals show alignment between intent and implementation
- 🟡 **Drifting** — 1-2 misalignments detectable; course-correctable
- 🔴 **Strained** — fundamental misalignment; architecture fights the problem

## Level 2: Report

Extend the TL;DR with structured analysis. Include all sections below.

### Purpose Extraction

Extract purpose using the signal hierarchy from [references/philosophy-extraction.md](references/philosophy-extraction.md). Always compare:

- **Stated purpose** — from README, docs, comments
- **Actual purpose** — from where code mass lives, what dependencies do, what tests protect
- **Gap** — if stated ≠ actual, surface it explicitly

### Architecture Diagrams

Generate C4 diagrams using Mermaid. Protocol from [references/diagram-protocol.md](references/diagram-protocol.md).

At Report level, always produce:
- **Context diagram** (Level 1) — system + external actors
- **Container diagram** (Level 2) — apps, services, databases within the system

### Challenge Dimensions

Analyze all three dimensions. For each:

1. List the observable signals found
2. Rate the dimension (🟢🟡🔴)
3. State the specific evidence
4. Name the one thing that would improve it most

Full rubrics in [references/challenge-framework.md](references/challenge-framework.md).

### Data Flow

Trace one request from entry to response:
- Where it enters (router/handler/controller)
- How it's validated (middleware/schema/guard)
- Where business logic lives (service/model/use-case)
- How it reaches persistence (ORM/query/repository)

### Module Map

Table of top-level modules with:

```
| Module | Purpose | LOC | Connects to | Isolated? |
```

`Isolated?` flags feature islands — modules with no connection to the core.

## Level 3: Deep Dive

Focused on a single module. Ask the user which module to deep-dive.

### Component Diagram

Generate C4 Component diagram for the target module. Protocol from [references/diagram-protocol.md](references/diagram-protocol.md).

### Pattern Catalog

List design patterns found in the module:
- Pattern name
- Where it appears (file:line)
- Whether it solves a real problem here or is cargo-culted

### Coupling Map

```
| This module | depends on | for what |
|-------------|-----------|----------|
```

Flag: circular dependencies, dependency on internals of other modules, imports that cross architectural boundaries.

### Code Smells

List specific, observable issues:
- Competing abstractions (two ways to do the same thing)
- Dead paths (unreachable code, unused exports)
- Naming inconsistency (same concept, different names)
- Leaky concerns (module doing work that belongs elsewhere)

### Verdict

One paragraph: *What would a principled rewrite of this module look like?* Not a recommendation to rewrite — a thought experiment that reveals the gap between current state and coherent design.

## Anti-Patterns

- ❌ Describing architecture without judging it — every section must answer "so what?"
- ❌ Rating without evidence — every traffic light needs 2+ observable signals
- ❌ Mixing depth levels — never dump Level 3 detail in a TL;DR
- ❌ Giving advice without understanding purpose — "refactor to microservices" is noise unless you know why the monolith exists
- ❌ Aggregating KPIs into a single score — the dimensions tell different stories

## References

- [references/challenge-framework.md](references/challenge-framework.md) — Full rubrics for the 3 KPI dimensions with signal definitions
- [references/philosophy-extraction.md](references/philosophy-extraction.md) — Signal hierarchy for extracting purpose and philosophy
- [references/diagram-protocol.md](references/diagram-protocol.md) — C4 diagram levels, Mermaid syntax, which diagram at which depth
