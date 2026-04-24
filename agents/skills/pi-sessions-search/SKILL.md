---
name: pi-sessions-search
description: Search pi coding agent sessions by content, file produced, or name. Use when the user asks to find a session, retrieve past work, locate where a file was created, or get /resume info for a session. This skill is specific to the pi coding agent session format (.jsonl) and is not compatible with other agent harnesses.
---

# Pi Sessions Search

Search across **pi coding agent** sessions to find specific work, locate files produced, or retrieve `/resume` info.

This skill is tightly coupled to the **pi.dev** session format. It parses `.jsonl` files with pi-specific event types (`session`, `session_info`, `message`) and field structures (`message.role`, `message.content[].type=toolCall`, etc.). It is **not** compatible with other agent harnesses.

## Path Resolution

Pi stores sessions as `.jsonl` files under a sessions directory:

1. **Sessions path**: `$PI_CODING_AGENT_DIR/sessions/` if the env var exists, else `~/.config/pi/sessions/`
2. The agent passes this path to the script via `--sessions`

## Workflow

### Step 1: Determine search mode

| User intent | Mode |
|---|---|
| Find a session by topic, keyword, or phrase | `content` |
| Find where a file was created or edited | `file-written` |
| Find a session by its name | `name` |
| General search across everything | `all` (default) |

### Step 2: Run the script

```bash
python3 ~/.agents/skills/pi-sessions-search/scripts/search.py \
  --sessions <SESSIONS_DIR> \
  --query "<search terms>" \
  --mode <content|file-written|name|all>
```

Optional flags:

| Flag | Purpose |
|---|---|
| `--limit <N>` | Max results (default: 10) |
| `--include-user-texts` | Include first user messages in output (for context) |
| `--include-tool-paths` | Include file paths from write/edit calls in output |

### Step 3: Read the JSON output

The script outputs JSON to stdout:

```json
{
  "query": "DORA",
  "mode": "all",
  "total_matches": 3,
  "results": [
    {
      "session_name": "fetch-regulations",
      "session_summary": "AI Act DORA GDPR regulations conversion",
      "session_folder": "--Users-pierrebeauhaire-Code-cnty-ai-agents-secu-and-compliance--",
      "session_file": "2026-04-20T13-44-21-581Z_019dab22-8d4c-703a-9235-544b9d0a8743.jsonl",
      "session_timestamp": "2026-04-20T13:44:21.581Z",
      "session_cwd": "/Users/pierrebeauhaire/Code/cnty-ai/agents/secu-and-compliance",
      "match_reasons": ["content", "file-written"],
      "files_written": [
        "md/regulations/dora/Regulation-EU-2022-2554.md",
        "md/regulations/reports/gdpr-dora/Conversion Quality Report.md"
      ],
      "user_texts": ["I've fetched and converted the ai-act..."]
    }
  ]
}
```

### Step 4: Present results to the user

Format each result as:

```
🏷️ <session_name> — <session_summary>
   📁 <session_cwd>  (compact: ~/ for home, ~/Code/... for subdirs)
   ✏️ Files: <files_written (max 3, then +N more)>
   🔍 Match: <match_reasons>
   ▶️ /resume <session_name>
```

If only one result, emphasize the `/resume` command (pi-specific).
If multiple results, rank by relevance (exact name match > file-written > content match).

## Session Summary Heuristic

The `session_summary` field is generated without LLM calls:

1. If `session_name` is descriptive (≥5 chars, not a shell artifact like `algo-analysis$`) → used as-is, no summary
2. Otherwise, extract significant words from the first 3 user messages:
   - Remove stop words (FR + EN)
   - Remove common noise (`the`, `le`, `de`, `ce`, `cette`, `est`, `que`, `qui`, `dans`, `pour`, `sur`, `avec`, `des`, `les`, `une`, `un`, `et`, `en`, `du`, `la`, `it`, `is`, `to`, `of`, `in`, `for`, `on`, `with`, `a`, `an`, `the`, `this`, `that`)
   - Keep top 3-5 distinct words by frequency
   - Concatenate with spaces
3. If session has < 3 messages → `"session courte / incomplète"`

## Design Principles

- **No LLM calls** — pure heuristic extraction for speed and cost
- **Structured JSON output** — the agent interprets and formats for the user
- **Ranked results** — exact matches first, then partial matches
- **Minimal I/O** — only read what's needed, skip large assistant messages by default
