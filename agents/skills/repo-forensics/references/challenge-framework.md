# Challenge Framework

Three dimensions for rating codebase honesty. Each dimension has observable signals and a traffic-light rubric.

Every rating must cite at least 2 signals. No vibes.

---

## Problem-Solution Fit 🟢🟡🔴

> Is the architecture proportional to the problem, or is it over/under-built?

### Signals

| Signal | How to detect | What it reveals |
|--------|--------------|-----------------|
| Indirection layers vs. domain depth | Count abstraction layers (interfaces, adapters, wrappers). Count domain-specific logic LOC. Ratio > 3:1 = overbuilt. | Whether the architecture serves the problem or the architect's resume |
| Dependency weight vs. app scope | Read package manifest. For each dep: does it solve a problem the app actually has? Count deps that solve problems the app doesn't face. | Whether the build-vs-buy choices match the actual scope |
| Glue code ratio | Measure LOC in adapter/translation/glue files vs. LOC in feature files. | Whether modules talk directly or need interpreters |
| Framework ceremony | Count LOC in config, setup, boilerplate vs. LOC in business logic. | Whether the framework serves the app or the app serves the framework |

### Rubric

| Rating | Criteria |
|--------|----------|
| 🟢 **Sound** | Abstraction layers match problem complexity. Dependencies solve real problems that would cost more to build. Glue code is minimal. Framework serves the domain. |
| 🟡 **Drifting** | 1-2 unnecessary abstraction layers. 1-2 "nice to have" deps that add coupling without proportional value. Some adapter code that exists only to bridge style differences. |
| 🔴 **Strained** | Framework boilerplate dwarfs domain code. Half the deps solve problems the app doesn't have. More code connecting things than doing things. Architecture could be cut in half and lose no capability. |

### One thing that would improve it

- 🟢→🟢⁺: Remove the weakest remaining indirection layer
- 🟡→🟢: Collapse the unnecessary abstraction — inline the adapter
- 🔴→🟡: Delete the framework features you don't use; replace heavy deps with focused ones

---

## Accidental Complexity 🟢🟡🔴

> Is the complexity inherent to the domain, or self-inflicted?

### Signals

| Signal | How to detect | What it reveals |
|--------|--------------|-----------------|
| Config/tooling LOC vs. feature LOC | Measure config files (Dockerfile, CI, webpack, tsconfig, etc.) vs. feature code. | Whether ops/tooling complexity is earned or habitual |
| Patterns used vs. patterns needed | Catalog design patterns found. For each: does it solve a concrete problem that exists now? Flag "in case we need it later" patterns. | Whether patterns serve the codebase or the codebase serves the patterns |
| Dead/unreachable paths | Count: unused exports, unreachable branches, commented-out features, TODO code that ships. Use `signal_scan.sh` for mechanical detection. | How much code exists for a future that never came |
| Build pipeline complexity | Count build steps, plugins, custom scripts. Map each to a real output. | Whether the build process is proportional to the artifact |

### Rubric

| Rating | Criteria |
|--------|----------|
| 🟢 **Sound** | Config is minimal and purposeful. Every pattern solves a concrete problem. Negligible dead code. Build pipeline is linear and understandable. |
| 🟡 **Drifting** | Build pipeline growing independent of app. One pattern used "just in case". Some commented-out features or unused exports. Config that once made sense but is now cargo. |
| 🔴 **Strained** | More config than code. Patterns cargo-culted from a different context. Significant unreachable code shipping to production. Build pipeline is a Rube Goldberg machine. |

### One thing that would improve it

- 🟢→🟢⁺: Delete the oldest unused export
- 🟡→🟢: Remove the "just in case" pattern — inline the abstraction
- 🔴→🟡: Cut the build pipeline in half; delete dead code paths en masse

---

## Narrative Coherence 🟢🟡🔴

> Does this product have a thesis, or is it a feature accumulation?

### Signals

| Signal | How to detect | What it reveals |
|--------|--------------|-----------------|
| Competing abstractions | Find two modules/files that do the same conceptual thing differently. Count distinct approaches per concern. | Whether the codebase has a consistent mental model |
| Feature islands | Map module dependencies. Find modules with zero imports from or to the core. | Whether all code serves the product thesis |
| Naming/structural consistency | Pick a core concept (e.g., "user", "order", "request"). Find all names for it across modules. Count distinct names. | Whether the team shares a vocabulary |
| Commit narrative | Read last 50 commit messages. Categorize: feature work, bugfix, refactor, chore. Ratio reveals what the team actually prioritizes. | Whether the team still builds toward the thesis or maintains a surface |

### Rubric

| Rating | Criteria |
|--------|----------|
| 🟢 **Sound** | One way to do each kind of thing. All modules connect to the core. Consistent naming across the codebase. Commits show active feature development toward a clear direction. |
| 🟡 **Drifting** | Two approaches for same concern (one clearly legacy). One feature island. Inconsistent naming in one area. Commits show maintenance-heavy activity — the product is coasting. |
| 🔴 **Strained** | 3+ approaches for same concern with no clear winner. Multiple disconnected feature clusters. Same concept called 3+ different names. New code picks patterns randomly. The codebase is a museum of past decisions. |

### One thing that would improve it

- 🟢→🟢⁺: Converge the last naming inconsistency
- 🟡→🟢: Pick one abstraction and deprecate the other; connect the feature island
- 🔴→🟡: Choose the winning abstraction per concern and enforce it in new code; prune the smallest island

---

## Rating Discipline

1. **Never rate without citing 2+ signals.** If you can't find 2 signals, say so — that itself is a signal.
2. **Never aggregate the three dimensions.** They tell different stories. A composite score hides the interesting part.
3. **When comparing repos, use the same signal definitions.** Different repos may reveal different signals, but the rubric stays constant.
4. **Rate the codebase, not the team.** No "the developers were lazy." Describe what the code reveals, not who wrote it or why.
5. **State uncertainty.** If a signal is ambiguous, say so. "This could be 🟡 or 🔴 — the dead code signal is strong but the naming is consistent" is more useful than a forced call.
