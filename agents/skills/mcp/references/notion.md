# Notion MCP Reference

Session: `@notion` · URL: `https://mcp.notion.com/mcp` · Auth: automatic OAuth (browser-based PKCE + DCR)

## Authentication

```bash
mcpc login https://mcp.notion.com/mcp
```

Opens browser, handles PKCE and DCR automatically. No client ID/secret needed.

## Tool Reference

⚡ = required arg | `?:` = optional arg | enum values shown in `()`
**Before calling an unfamiliar tool**, run `mcpc @notion tools-get <tool>` to confirm exact arg names, required fields, and enum values and review full description.

| Tool | Description | Key Args |
|------|-------------|----------|
| `notion-search` | Search workspace (pages, databases, connected sources) or users | `query:str` ⚡, `query_type?:enum` (`internal`/`user`), `content_search_mode?:enum` (`workspace_search`/`ai_search`), `data_source_url?:str`, `page_url?:str`, `teamspace_id?:str`, `filters?:obj`, `page_size?:int`, `max_highlight_length?:int` |
| `notion-fetch` | Fetch page, database, or data source by ID or URL | `id:str` ⚡, `include_transcript?:bool`, `include_discussions?:bool` |
| `notion-create-pages` | Create one or more pages | `pages:[obj]` ⚡, `parent?:obj` (**⚠️ top-level arg, not inside pages[]**; supports `page_id`, `database_id`, or `data_source_id`) |
| `notion-update-page` | Update page properties or content | `page_id:str` ⚡, `command:enum` ⚡ (`update_properties`/`replace_content`/`insert_content`/`update_content`/`apply_template`/`update_verification`), `properties?:obj`, `new_str?:str`, `content?:str`, `content_updates?:[{old_str,new_str}]`, `position?:obj`, `template_id?:str`, `verification_status?:enum`, `verification_expiry_days?:int`, `allow_deleting_content?:bool`, `icon?:str`, `cover?:str` |
| `notion-move-pages` | Move pages/databases to new parent | `page_or_database_ids:[str]` ⚡, `new_parent:obj` ⚡ (supports `page_id`, `workspace`, `database_id`, `data_source_id`) |
| `notion-duplicate-page` | Duplicate a page (async) | `page_id:str` ⚡ |
| `notion-create-database` | Create a database with SQL DDL schema | `schema:str` ⚡ (CREATE TABLE DDL), `parent?:obj`, `title?:str`, `description?:str` |
| `notion-update-data-source` | Update data source schema or attributes | `data_source_id:str` ⚡, `statements?:str` (DDL: ADD/DROP/RENAME/ALTER COLUMN), `title?:str`, `description?:str`, `is_inline?:bool`, `in_trash?:bool` |
| `notion-create-comment` | Add comment to page or inline content | `page_id:str` ⚡, `discussion_id?:str` (reply to thread), `selection_with_ellipsis?:str` (~10 chars…~10 chars), `markdown?:str` **or** `rich_text?:[any]` (pick one) |
| `notion-get-comments` | Get page comments/discussions | `page_id:str` ⚡, `include_resolved?:bool`, `include_all_blocks?:bool`, `discussion_id?:str` (fetch specific thread) |
| `notion-get-teams` | List teamspaces | `query?:str` |
| `notion-get-users` | List workspace users | `query?:str`, `user_id?:str` (pass `"self"` for current user), `start_cursor?:str`, `page_size?:int` |
| `notion-create-view` | Create database view (table/board/calendar/etc.) | `data_source_id:str` ⚡, `name:str` ⚡, `type:enum` ⚡ (`table`/`board`/`list`/`calendar`/`timeline`/`gallery`/`form`/`chart`/`map`/`dashboard`), `database_id?:str` **or** `parent_page_id?:str` (exactly one required), `configure?:str` (FILTER, SORT BY, GROUP BY, etc.) |
| `notion-update-view` | Update view config | `view_id:str` ⚡, `name?:str`, `configure?:str` (supports CLEAR FILTER/SORT/GROUP BY) |

**🗑️ No delete/trash tool for pages or databases.** There is no MCP tool to delete or trash a page or database. `notion-move-pages` only moves content to a new parent (`page_id`/`workspace`/`database_id`/`data_source_id`) — it **cannot** move items to the Trash. To remove a page or database, the user must delete it manually in Notion. (Only exception: `notion-update-data-source` accepts `in_trash?:bool`, but that applies solely to **data sources** — i.e. tables/views under a database — not to pages or databases themselves.)

## Resolving a Notion URL to a Page/Database ID

When a user shares a Notion URL, extract the ID before calling `notion-fetch`. Notion URLs embed the ID in two formats:

1. **Clean URL** — `https://www.notion.so/Page-Title-36f26ae567698106a037fd7a360b36fb` → the trailing hex segment **is** the ID.
2. **Query-param URL** — `https://www.notion.so/36f26ae567698106a037fd7a360b36fb?pvs=4` → the path segment is the ID.
3. **Hyphenated UUID** — `36f26ae5-6769-8106-a037-fd7a360b36fb` → remove hyphens to match the format Notion MCP expects (or use as-is; both forms usually work).

**Extraction pattern:**
```bash
id=$(echo "$URL" | grep -oE '[0-9a-f]{32}')
mcpc @notion tools-call notion-fetch id:="$id"
```

If the URL uses a short form (`notion.so/Short-Page-Title-` + hash) with no visible ID, use `notion-search` with the title instead.

## Reading a Notion Page — Workflow

1. **Extract the ID** from the URL (see above) or search by title.
2. **Fetch with `notion-fetch`** — returns page content, metadata, and ancestor path.
3. **Parse the response** — the `text` field inside the JSON contains a markdown-like rendering of the page. Properties are in a `<properties>` block.

```bash
mcpc @notion tools-call notion-fetch id:="36f26ae567698106a037fd7a360b36fb"
```

## Fetching Databases vs Pages

- **Page fetch** returns content blocks and properties.
- **Database fetch** returns its schema (properties, types, options), views, data sources, and an SQLite table definition for querying.
- Both use the same `notion-fetch id:=<id>` call — the server auto-detects the type.

## Creating Databases (DDL)

`notion-create-database` takes a `schema:str` of SQL `CREATE TABLE` DDL. Per the tool's own spec:
- **Column names must be double-quoted**; type options use single quotes.
- **Simple types** (no options): `TITLE`, `RICH_TEXT`, `DATE`, `PEOPLE`, `CHECKBOX`, `URL`, `EMAIL`, `PHONE_NUMBER`, `STATUS`, `FILES`.
- **Option-bearing types** — only `SELECT('opt':color, ...)` and `MULTI_SELECT('opt':color, ...)`.
- `NUMBER [FORMAT 'dollar']`, `FORMULA('expression')`, `RELATION('data_source_id')` (one-way) / `RELATION('data_source_id', DUAL)` (two-way).

If no title property is given, `Name` is auto-added. The result includes a `<data-source>` tag with the **data source ID** — save it; `notion-update-data-source` and `notion-create-pages` (with `parent: {data_source_id}`) both need it.

### ⚠️ `STATUS` does not accept inline options — use `SELECT`

`STATUS` is a simple type. Passing it options causes a parse error — `Invalid schema at position N: Expected column name in double quotes, got "("` — because the parser sees `(` where it expects the next quoted column name. For a status-like column with a fixed option set created up front, use `SELECT`:

```
-- ❌ STATUS rejects inline options (parse error)
CREATE TABLE "My DB" ("Title" TITLE, "Stage" STATUS('Todo':gray,'Done':blue))

-- ✅ use SELECT for a fixed option set
CREATE TABLE "My DB" ("Title" TITLE, "Stage" SELECT('Todo':gray,'Done':blue))
```

### DDL with mixed quotes — build the args object as JSON and pipe via stdin

A DDL `schema` nearly always mixes **double quotes** (column names) and **single quotes** (option values), which is fragile as a shell argument. Build the full args object as JSON in Python and pipe it to stdin so the quotes are ordinary characters:

```python
# /tmp/make_db.py
import json, sys
schema = 'CREATE TABLE "My DB" ("Title" TITLE, "Stage" SELECT(\'Todo\':gray,\'Done\':blue))'
args = {"schema": schema, "parent": {"page_id": "<parent-id>"}, "title": "My DB"}
sys.stdout.write(json.dumps(args))
```
```bash
python /tmp/make_db.py | mcpc @notion tools-call notion-create-database
```

When piping via stdin the JSON **must be the complete args object** (including `parent`), not just the `schema` string or a single argument, and no other `key:=value` flags should be passed alongside it — see the stdin rule in `mcpc-reference.md`.

## Content Format: Notion-Flavored Markdown

Page content uses **Notion-flavored Markdown**, which differs from standard Markdown in important ways. **Always read the full spec before creating or updating pages with content** — it is authoritative and covers all block types, escaping rules, and edge cases.

Fetch the spec with:
```bash
mcpc @notion resources-read notion://docs/enhanced-markdown-spec
```

### Critical Differences from Standard Markdown

**Tables: Standard markdown pipe tables DO NOT work.** You must use Notion's `<table>` XML syntax instead of `| col | col |` pipe syntax. Pipe tables will silently truncate or break.

Correct (Notion-flavored):
```
<table header-row="true">
	<tr>
		<td>Model</td>
		<td>Price</td>
	</tr>
	<tr>
		<td>GPT-5</td>
		<td>$5.00</td>
	</tr>
</table>
```

Wrong (will break):
```
| Model | Price |
|-------|-------|
| GPT-5 | $5.00 |
```

**Other key differences:**
- Headings 5 and 6 are not supported (converted to heading 4)
- Empty lines require `<empty-block/>` (plain empty lines are stripped)
- Block colors use `{color="Color"}` attribute lists
- Escaping: backslash-escape these characters in text: `\ * ~ ` $ [ ] < > { } | ^`
- Code blocks: do NOT escape special characters inside ``` code blocks — content is literal
- Inline code: never use ordinary newlines inside backtick spans (breaks the code span)
- Toggle headings: use `{toggle="true"}` attribute on a heading
- Callouts: use `<callout icon="emoji">` blocks
- Mentions: use `<mention-page url="...">`, `<mention-user url="...">`, etc.
- **Inline HTML tags (e.g. `<b>`, `<i>`, `<br>`) are escaped, not rendered.** Use native Markdown equivalents: `**bold**`, `_italic_`, blank lines for paragraph breaks. If `<b>` literally appears in rendered text, rewrite as `**`.

## Converting Standard Markdown to Notion Content

When writing markdown content to a Notion page, you must convert any pipe tables to `<table>` syntax. Here is a reusable Python pattern:

```python
import re

def md_to_notion_content(md_text: str) -> str:
    """Convert standard markdown to Notion-flavored markdown content.
    Handles pipe tables → <table> conversion. Remove H1 title
    (Notion uses the title property instead)."""
    lines = md_text.split("\n")
    output = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect markdown table
        if "|" in line and line.strip().startswith("|"):
            table_lines = []
            while i < len(lines) and "|" in lines[i] and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            if len(table_lines) < 2:
                output.extend(table_lines)
                continue
            # Parse rows
            def parse_row(row):
                s = row.strip()
                if s.startswith("|"): s = s[1:]
                if s.endswith("|"): s = s[:-1]
                return [c.strip() for c in s.split("|")]
            header = parse_row(table_lines[0])
            # Check for separator row (all dashes/colons)
            is_sep = all(set(c.strip()) <= {"-", ":", " ", "~"} for c in parse_row(table_lines[1]))
            data_start = 2 if is_sep else 1
            data_rows = [parse_row(tl) for tl in table_lines[data_start:]]
            num_cols = len(header)
            # Build Notion <table>
            t = ['<table header-row="true">']
            t.append("<tr>" + "".join(f"<td>{c}</td>" for c in header) + "</tr>")
            for row in data_rows:
                while len(row) < num_cols:
                    row.append("")
                t.append("<tr>" + "".join(f"<td>{c}</td>" for c in row[:num_cols]) + "</tr>")
            t.append("</table>")
            output.append("\n".join(t))
            continue
        output.append(line)
        i += 1
    result = "\n".join(output)
    # Remove H1 title (Notion uses the title property)
    if result.startswith("# "):
        result = result[result.index("\n") + 1:]
    return result
```

## Creating Pages

**⚠️ Critical: `parent` is a TOP-LEVEL argument, NOT inside the `pages` array.**

The `pages` array contains only `properties`, `icon`, `cover`, `content`, and `template_id`. The `parent` (where to create the pages) is a separate argument at the same level as `pages`.

```bash
# ❌ WRONG — parent inside pages[] will cause "unrecognized_keys" error
mcpc @notion tools-call notion-create-pages pages:='[{"parent":{"page_id":"abc"},"properties":{"title":"My Page"}}]'

# ✅ CORRECT — parent as separate top-level argument
mcpc @notion tools-call notion-create-pages pages:='[{"properties":{"title":"My Page"}}]' "parent:={\"page_id\":\"abc\"}"
```

### "My private pages" (workspace-level, no parent)

When the user says **"my private pages"** or **"private pages"**, they mean their **Notion sidebar's Private section** — the personal, non-shared area of their workspace. To create a page there, **omit the `parent` argument entirely**. The page will appear at the top level of the Private section.

```bash
# Creates a page in the user's Private section (sidebar → Private)
mcpc @notion tools-call notion-create-pages pages:='[{"properties":{"title":"My Page"},"icon":"📝"}]'
```

Do NOT search for a "private pages" parent page — it doesn't exist as a searchable page. The Private section is a workspace-level concept, not a page. Omitting `parent` is the only way to place pages there.

### Simple page (no content, no parent)
```bash
mcpc @notion tools-call notion-create-pages pages:='[{"properties":{"title":"My Page"},"icon":"📝"}]'
```

### Page under a parent page
```bash
mcpc @notion tools-call notion-create-pages pages:='[{"properties":{"title":"My Subpage"},"icon":"📝"}]' "parent:={\"page_id\":\"<parent-id>\"}"
```

### Page under a database data source
```bash
mcpc @notion tools-call notion-create-pages pages:='[{"properties":{"title":"My Item","Status":"In Progress"}}]' "parent:={\"data_source_id\":\"<ds-id>\"}"
```

### Title property formats
The `title` property accepts both a simple string and the verbose nested format. Use the simple string unless you need inline formatting:
```bash
# Simple string (preferred)
"title": "My Page"

# Verbose format (only if you need inline bold/links in the title)
"title": {"title": [{"text": {"content": "My Page"}}]}
```

## Writing Large Content to Pages

For pages with substantial content (tables, long text), shell escaping of `<table>` tags and `$` signs becomes unreliable. Use a **temp file approach**:

### Pattern: Write JSON to file, pass via `$(cat file)`

```bash
# Step 1: Prepare pages JSON in a Python script and write to temp file
cat > /tmp/notion_create.py << 'PYEOF'
import json

content = """## Section
Some text with $5.00 prices and <table> tags safely stored in the file.
"""

pages = [{
    "properties": {"title": "My Page"},
    "icon": "📝",
    "content": content
}]

with open('/tmp/notion_pages.json', 'w') as f:
    json.dump(pages, f, ensure_ascii=False)
PYEOF
python /tmp/notion_create.py

# Step 2: Create pages using the file, with parent as SEPARATE argument
mcpc @notion tools-call notion-create-pages "pages:=$(cat /tmp/notion_pages.json)" "parent:={\"page_id\":\"<parent-id>\"}"
```

### Updating an existing page's content
```bash
# Write content to file first
echo '## Updated Section
New content here.' > /tmp/notion_content.txt

# Replace content
mcpc @notion tools-call notion-update-page page_id:="<id>" command:="replace_content" "new_str:=$(cat /tmp/notion_content.txt)"
```

### ⚠️ `replace_content` deletes child pages — use `update_content` on pages with children

When you `notion-fetch` a page that has **subpages or child databases**, the returned `<content>` block includes inline `<page url="...">` and `<database url="...">` tags representing those children. They are NOT regular text — they ARE the child references. `command:="replace_content"` replaces the ENTIRE content block **including those tags**, which would detach (effectively delete) the children.

Notion blocks this with a hard error rather than silently doing it:
```
This operation would delete N child page(s) or database(s):
- page: "Syllabus" (id: ...)
- database: "Content" (id: ...)
To proceed, either:
1. Include these items in new_str using <page url="..."> or <database url="..."> tags, OR
2. Set allow_deleting_content: true to confirm deletion.
```

**The error is your friend — do not reflexively set `allow_deleting_content:=true`.** It means you are about to wipe out real subpages/databases. This is an easy near-miss when "just adding an intro to the parent page."

**Correct pattern — add or edit content on a page WITH children, leaving children intact:** use `update_content` with `content_updates` to find/replace a specific anchor (an `<empty-block/>`, a unique heading, or a known string) instead of replacing the whole body. The child `<page>`/`<database>` tags are never touched:

```bash
# Parent page fetched as:
#   <content>
#   <empty-block/>
#   <page url="...">Syllabus</page>
#   <database url="...">Content</database>
#   </content>
#
# Insert an intro above the children by replacing a leading empty block:
cat > /tmp/parent_intro.json << 'EOF'
{"page_id":"<parent-id>","command":"update_content",
 "content_updates":[{"old_str":"<empty-block/>","new_str":"<callout icon=\"👋\">Welcome</callout>"}]}
EOF
cat /tmp/parent_intro.json | mcpc @notion tools-call notion-update-page
```

If `<empty-block/>` appears multiple times, the call errors with `Multiple matches found` — make `old_str` more specific by including surrounding lines (e.g. the preceding newline + the empty block + the child tag that follows it) so it matches exactly once.

**Only use `replace_content` on a page with children if** you intentionally want to rebuild the whole body — and then you MUST re-include every `<page url="...">` / `<database url="...">` tag in `new_str` to keep them, or explicitly accept deletion via `allow_deleting_content:=true`. A safer default for page-with-children edits is always `update_content`.

### `update_content` with `content_updates` — the apostrophe trap

`command:="update_content"` takes `content_updates:='[{old_str,new_str}]'` — a JSON array of find/replace pairs. **Inline single-quoted JSON breaks when `old_str`/`new_str` contain apostrophes** (e.g. `"isn't"`, `"Continuity's"`): bash aborts with `unexpected EOF while looking for matching "'"` (exit code 2). Escaping as `\'` does not help inside a single-quoted string.

Use the temp-file pattern so the JSON is never shell-quoted (apostrophes are ordinary characters inside a JSON string):

```bash
# Write the content_updates array as clean JSON
at > /tmp/updates.json << 'EOF'
[{"old_str":"## 1. The Brain Isn't Fundamental","new_str":"## 1. The Brain Isn't Fundamental — The Ecosystem Is"}]
EOF

# Pass via $(cat file) — keep other args as separate flags
mcpc @notion tools-call notion-update-page page_id:="<id>" command:="update_content" "content_updates:=$(cat /tmp/updates.json)"

# Alternative: pipe the entire args object via stdin (also avoids all shell quoting)
at > /tmp/update_args.json << 'EOF'
{"page_id":"<id>","command":"update_content","content_updates":[{"old_str":"...isn't...","new_str":"...isn't..."}]}
EOF
at /tmp/update_args.json | mcpc @notion tools-call notion-update-page
```

### `update_content` — silent no-op on italic-delimiter / auto-link mismatch

Even with valid JSON, `content_updates` can **silently fail to match and report success anyway** — the tool applies whatever matches and skips the rest, so a single bad `old_str` leaves the page unchanged with no error. Two recurring causes:

- **Italic delimiters: Notion stores `*italic*` using asterisks, not underscores.** If your `old_str` uses `_italic_` (underscores) it will not match the stored text and the edit is silently skipped. When anchoring on italic-styled text, use `*...*` in `old_str`, or anchor on a non-styled substring.
- **Auto-linkified URLs: a bare URL in `old_str` won't match** once Notion has converted it to a markdown link `[https://…](https://…)`. Match the linkified form, or anchor on adjacent non-link text.

After any `update_content`, **re-fetch and verify the change actually landed** before declaring success — don't trust the tool's success report alone.

### Key pitfalls with large content
- **Shell interpolation:** `$` in prices (like `$5.00`) gets expanded by bash. Using a temp file avoids this entirely.
- **Angle brackets:** `<table>` tags can be eaten by bash redirection. The temp file approach avoids this.
- **Quotes:** Nested JSON in shell arguments is fragile. Write the full pages array as JSON to a temp file and use `$(cat file)`.
- **Parent placement:** Always pass `parent` as a separate argument — never inside `pages[]`.

## Large Notion Pages (Reading)

Pages with many blocks or embedded files can produce large responses. Use `--json` + temp file + jq/grep if output is truncated:
```bash
mcpc --json @notion tools-call notion-fetch id:="<id>" > /tmp/notion_page.json
jq -r '.content[0].text' /tmp/notion_page.json
```

## Reading Comments / Discussions

Comments live on pages as inline "discussions" anchored to text ranges. Two tools read them; their output formats differ — read this before parsing.

### `notion-fetch` with `include_discussions:=true`

Embeds inline `<discussion>` tags inside the page markdown, plus a `<page-discussions>` summary block near the end. **The `<page-discussions>` block only lists the first ~3 threads** — do not rely on it for the full set. Tag shape:

```
<discussion id="..." comment-count="3" resolved="false" type="inline" context="..." text-context="the inline text the comment is anchored on">
  <comment datetime="2026-06-04T12:47:00.000Z" ...>comment body (may contain &lt;br&gt;)</comment>
  <comment ...>reply body</comment>
</discussion>
```

### `notion-get-comments` (use this for the full set)

Returns **all** discussions. **The response is a double-escaped JSON string**: `json.load()` the response, then `json.loads(text)` again to reach the inner `text` field that holds the `<discussion>` markup.

```bash
# Unresolved inline comments only, across all blocks
mcpc --json @notion tools-call notion-get-comments page_id:="<id>" include_resolved:=false include_all_blocks:=true > /tmp/comments.json
```

```python
import json, re
with open('/tmp/comments.json') as f:
    data = json.load(f)
inner = json.loads(data['content'][0]['text'])   # second json.loads — response is double-escaped
disc_text = inner['text']

for part in disc_text.split('<discussion ')[1:]:
    m = re.search(r'text-context="([^"]*)"', part)
    ctx = m.group(1) if m else '?'
    resolved = 'resolved="true"' in part
    comments = re.findall(r'datetime="([^"]*)"[^>]*>(.*?)</comment>', part, re.DOTALL)
    print(f"{'✅' if resolved else '🔴'} {ctx}")
    for dt, body in comments:
        body = body.replace('&amp;','&').replace('&lt;','<').replace('&gt;','>').replace('<br>',' ')
        print(f"  [{dt[:10]}] {body.strip()}")
```

Use `include_all_blocks:=true` to capture inline (text-anchored) discussions, not just page-level ones. Pass `discussion_id:=<id>` to fetch a single thread.
