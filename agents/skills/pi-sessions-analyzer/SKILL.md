---
name: pi-sessions-analyzer
description: Analyze pi coding agent sessions — stats, tokens, costs, time, tools, themes. Use when the user asks about their pi session usage, wants stats on sessions, or asks to analyze/compare session activity. This skill is specific to the pi coding agent session format (.jsonl) and is not compatible with other agent harnesses.
---

# Pi Sessions Analyzer

Analyze **pi coding agent** sessions: extract stats, identify patterns, produce narrative reports.

This skill is tightly coupled to the **pi.dev** session format. It parses `.jsonl` files with pi-specific event types (`session`, `session_info`, `message`) and field structures (token usage, model info, tool calls). It is **not** compatible with other agent harnesses.

## Path Resolution

Pi stores sessions as `.jsonl` files under a sessions directory. The skill resolves paths:

1. **Sessions path**: `$PI_CODING_AGENT_DIR/sessions/` if the env var exists, else `~/.config/pi/sessions/`
2. **Output path**: same base directory, replace `sessions/` with `sessions-analysis/`
3. The agent passes these paths to the script via `--sessions` and `--output`

## Workflow

### Step 1: Resolve paths

```
PI_BASE = $PI_CODING_AGENT_DIR || ~/.config/pi
SESSIONS_DIR = $PI_BASE/sessions/
OUTPUT_DIR = $PI_BASE/sessions-analysis/
```

### Step 2: Identify target sessions

When the user specifies a scope (e.g., "secu compliance sessions", "all sessions this week"):
- List subdirectories in `SESSIONS_DIR`
- Select the ones that match the user's intent
- Pass them as a **list** to `--sessions` (not a glob pattern)

When the user says "all sessions":
- Pass the entire `SESSIONS_DIR` directory

### Step 3: Run the script

```bash
python3 ~/.agents/skills/pi-sessions-analyzer/scripts/session_stats.py \
  --sessions <path1> <path2> ... \
  --output <OUTPUT_DIR>/<date>-<slug>-stats.json
```

File naming: `<date>-<slug>-stats.json` where `<date>` = today (YYYY-MM-DD), `<slug>` = scope inferred from the request (e.g., `secu-compliance`, `all-sessions`).

### Step 4: Read the JSON

Read the output JSON file. It contains:
- `sessions[]` — per-session metrics + user_texts (for theme interpretation)
- `aggregates` — totals, ratios, averages
- `timeline` — chronological summary

### Step 5: Produce the report

Write a markdown report in `OUTPUT_DIR` named `<date>-<slug>.md` (same prefix as the JSON).

Follow the report template in [references/report-template.md](references/report-template.md).

## Interpretation Rules

1. **Themes**: Derive from `user_texts` in each session — don't hardcode keyword lists, interpret the actual content
2. **Macro-tasks**: Classify based on what the user *did* (research, writing, coding, structuring), not just keywords
3. **Narrative**: Build a progression story — sessions are chronologically ordered for a reason
4. **Key takeaways**: Extract 8-10 insights that are actionable, not just descriptive
5. **Honesty**: If the data is thin (1-2 sessions), say so. Don't over-interpret.

## Script Flags

| Flag | Purpose |
|---|---|
| `--sessions <path> [<path> ...]` | One or more session directories or .jsonl files |
| `--output <path>` | Output JSON file path |
| `--include-assistant-texts` | Include assistant response texts (larger file, more context) |
| `--active-threshold <seconds>` | Gap threshold for active vs idle time (default: 1800) |
