# Philosophy Extraction

Signal hierarchy for extracting "why" from a codebase. Purpose and philosophy are not the same thing:

- **Purpose**: what problem does this solve for whom
- **Philosophy**: the design thesis that organizes the codebase — the principle that, if you removed it, the architecture would collapse into incoherence

---

## Signal Hierarchy

Read signals in this order. Each layer either confirms or contradicts the previous one. The contradictions are the interesting part.

### Layer 1: Stated Intent (Low effort, low reliability)

**Sources**: README, docs/, comments in entry points, package description field

**Extract**:
- What the authors say the product does
- Who they say it's for
- What they say matters most

**Reliability**: Low. READMEs describe aspiration, not reality. They age fast.

**Command**: Read README.md, docs/ folder, and the "description" field from the package manifest.

### Layer 2: Code Mass Distribution (Medium effort, high reliability)

**Sources**: LOC counts per directory, file counts per module, import frequency

**Extract**:
- Where the bulk of code lives → reveals actual priorities
- Which modules are largest → reveals what the codebase *actually* does vs. what it claims

**Reliability**: High. People write code for what matters. Code mass doesn't lie.

**Method**:
```bash
# From signal_scan.sh output, examine LOC_PER_DIR
# The top 3 directories by LOC are the real product
# Compare against stated purpose — any gap is a finding
```

### Layer 3: Dependency Choices (Low effort, medium reliability)

**Sources**: package.json dependencies, go.mod requires, Cargo.toml dependencies

**Extract**:
- What problems the authors chose to **buy** (libraries, frameworks, SaaS SDKs)
- What problems the authors chose to **build** (custom code where a library exists)

**Reliability**: Medium. Choices reveal priorities, but some deps are inherited or accidental.

**Method**:
1. List all direct dependencies
2. For each: does it solve a problem core to the product, or a cross-cutting concern?
3. Core deps → the authors consider this problem hard enough to delegate
4. Missing deps (where standard solutions exist) → the authors chose to own this complexity. Why?

### Layer 4: Test Structure (Medium effort, medium-high reliability)

**Sources**: Test file locations, test-to-source ratios, what gets mocked

**Extract**:
- What they care enough to protect → reveals what they consider critical path
- What's untested → reveals what they consider disposable or "easy enough to not break"

**Reliability**: Medium-high. Tests reveal intent. Absence of tests is also a signal.

**Method**:
```bash
# From signal_scan.sh output, examine TEST_RATIO
# Low test ratio in a module = "we trust this" or "we don't care if this breaks"
# High test ratio = "this is critical" or "this breaks often"
```

### Layer 5: Git History (High effort, high reliability for recent trends)

**Sources**: Recent commit messages, files changed per commit, frequency of changes per module

**Extract**:
- What actually changes → reveals real development priorities
- Which modules are hot vs. frozen → reveals where the product is actively evolving
- Commit message style → reveals team culture (descriptive vs. cryptic, feature vs. fix)

**Reliability**: High for recent trends (last 100 commits). Low for historical archaeology.

**Method**:
```bash
# From signal_scan.sh output, examine GIT_RECENT
# Map commit categories: feature / bugfix / refactor / chore
# Feature-heavy → product is growing
# Bugfix-heavy → product is stabilizing (or rotting)
# Chore-heavy → product is coasting
```

---

## Extracting Philosophy

After gathering all layers, ask:

> What single principle, if removed, would cause the architecture to lose coherence?

Examples of philosophies found in real codebases:

| Philosophy | Evidence |
|-----------|----------|
| "Intercept before forwarding" | Middleware-heavy, all request paths go through a validation layer before reaching handlers |
| "Configuration over code" | Extensive YAML/JSON config, minimal hardcoded logic, feature flags everywhere |
| "Own the data path" | Custom ORM instead of Prisma/TypeORM, custom serialization, no third-party data layer |
| "Local-first, sync later" | IndexedDB/SQLite on device, sync engine separate, offline is the happy path |
| "Convention over configuration" | Rigid directory structure, generators, minimal config files, framework dictates structure |
| "Explicit over implicit" | No magic, verbose naming, no decorators that hide behavior, no metaprogramming |

If no philosophy emerges, that itself is the finding: *"This codebase has no organizing principle. It accreted."*

---

## The Gap Report

Always compare stated vs. actual. Format:

```
Stated purpose:  [from README/docs]
Actual purpose:  [from code mass + dependency choices]
Philosophy:      [the organizing principle]

Gap: [If stated ≠ actual, describe the gap specifically]
  - README claims X, but 60% of code does Y
  - Docs say "real-time", but architecture is batch-oriented
  - Stated audience is developers, but UX investment says end-users
```

The gap is not a judgment — it's a finding. Some gaps are intentional (building toward a pivot). Some are drift. The skill surfaces the gap; the user interprets it.
