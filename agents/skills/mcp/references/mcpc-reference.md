# mcpc Reference

Complete reference for `mcpc` CLI operations with Notion, Gmail, Slack, and Browser Control.

## Browser Control Tools

Browser Control MCP connects to the user's Firefox browser via the [browser-control-mcp](https://github.com/eyalzh/browser-control-mcp) extension. Session: `@browser`. Config: `~/.mcp.json:browser-control`.

| Tool | Description | Key Args |
|------|-------------|----------|
| `open-browser-tab` | Open a URL in a new tab | `url:str` |
| `close-browser-tabs` | Close tabs by IDs | `tabIds:[num]` |
| `get-list-of-open-tabs` | List open tabs (paginated) | `offset?:int` (0-based), `limit?:num` (default 100, max 500) |
| `get-recent-browser-history` | Search browser history | `searchQuery?:str` (omit for all recent) |
| `get-tab-web-content` | Read webpage text + links | `tabId:num`, `offset?:num` (for pagination of large pages) |
| `reorder-browser-tabs` | Change tab order | `tabOrder:[num]` |
| `find-highlight-in-browser-tab` | Find & highlight text in tab | `tabId:num`, `queryPhrase:str` |
| `group-browser-tabs` | Create tab group | `tabIds:[num]`, `isCollapsed?:bool`, `groupColor?:enum` (`grey`/`blue`/`red`/`yellow`/`green`/`pink`/`purple`/`cyan`/`orange`), `groupTitle?:str` |

### Reading Webpage Content
1. Open the URL: `mcpc @browser tools-call open-browser-tab url:="https://example.com"` → returns `tab id`
2. Wait for page load, then read: `mcpc @browser tools-call get-tab-web-content tabId:=<id>`
3. For large pages, paginate with `offset`: `mcpc @browser tools-call get-tab-web-content tabId:=<id> offset:=5000`
4. Close when done: `mcpc @browser tools-call close-browser-tabs tabIds:='[<id>]'`

### Domain Consent
Reading webpage text requires the user to grant consent in the Firefox extension for each domain. If `get-tab-web-content` fails, the user needs to approve the domain in the extension preferences.

### Connection
- Stdio-based MCP server launched from `~/.mcp.json`
- Connect: `mcpc connect ~/.mcp.json:browser-control @browser`
- Authentication: shared secret via `BROWSER_CONTROLE_MCP_KEY` env var (mapped to `EXTENSION_SECRET`)
- Extension port: default 8089 (configurable via `EXTENSION_PORT`)

## Notion Tools

| Tool | Description | Key Args |
|------|-------------|----------|
| `notion-search` | Search workspace | `query:str`, `query_type?:enum`, `content_search_mode?:enum` |
| `notion-fetch` | Fetch page/database | `id:str`, `include_transcript?:bool`, `include_discussions?:bool` |
| `notion-create-pages` | Create pages | `pages:[obj]`, `parent?:any` |
| `notion-update-page` | Update page properties | `page_id:str`, `command:enum`, `properties?:obj` |
| `notion-move-pages` | Move pages to new parent | `page_or_database_ids:[str]`, `new_parent:any` |
| `notion-duplicate-page` | Duplicate a page | `page_id:str` |
| `notion-create-database` | Create a database | `schema:str`, `parent?:obj`, `title?:str` |
| `notion-update-data-source` | Update data source | `data_source_id:str`, `statements?:str` |
| `notion-create-comment` | Add comment to page | `page_id:str`, `body:str` |
| `notion-get-comments` | Get page comments | `page_id:str` |
| `notion-get-teams` | List teams | `query?:str` |
| `notion-get-users` | List users | `query?:str` |
| `notion-create-view` | Create database view | `data_source_id:str`, `name:str`, `type:enum` |
| `notion-update-view` | Update a view | `view_id:str` |

### Notion Search Types
- `query_type`: `page`, `database`, or omit for all
- `content_search_mode`: controls how content is matched

### Notion Fetch Details
Fetching a database returns its full schema (properties, types, options), views, data sources, and an SQLite table definition for querying. Fetching a page returns its content and metadata.

### Resolving Notion URLs to IDs
Notion URLs embed the page/database ID. Extract it before calling `notion-fetch`:

| URL format | Example | ID to use |
|-----------|---------|----------|
| `notion.so/Title-<32hex>` | `.../Page-36f26ae567698106a037fd7a360b36fb` | `36f26ae567698106a037fd7a360b36fb` |
| `notion.so/<32hex>` | `.../36f26ae567698106a037fd7a360b36fb` | `36f26ae567698106a037fd7a360b36fb` |
| Hyphenated UUID | `36f26ae5-6769-8106-a037-fd7a360b36fb` | Either form works |

Quick extraction from any URL:
```bash
id=$(echo "$URL" | grep -oE '[0-9a-f]{32}')
```

If the URL contains no visible ID (e.g. short/hash-only links), use `notion-search` with the page title instead.

## Gmail Tools

| Tool | Description | Key Args |
|------|-------------|----------|
| `search_threads` | Search emails | `query:str`, `pageSize?:int`, `pageToken?:str`, `includeTrash?:bool` |
| `get_thread` | Read a thread | `threadId:str`, `messageFormat?:enum` (`FULL_CONTENT` (default), `MINIMAL`, `MESSAGE_FORMAT_UNSPECIFIED`) |
| `create_draft` | Compose a draft | `to:[str]`, `subject:str`, `body:str`, `cc?:[str]`, `bcc?:[str]`, `attachments?:[any]` |
| `list_drafts` | List drafts | `pageSize?:int`, `query?:str` |
| `list_labels` | List labels | `pageSize?:int` |
| `label_thread` | Add labels to thread | `threadId:str`, `labelIds:[str]` |
| `unlabel_thread` | Remove labels from thread | `threadId:str`, `labelIds:[str]` |
| `label_message` | Add labels to message | `messageId:str`, `labelIds:[str]` |
| `unlabel_message` | Remove labels from message | `messageId:str`, `labelIds:[str]` |
| `create_label` | Create a label | `displayName:str`, `color?:any` |
| `update_label` | Update a label | `labelId:str`, `displayName?:str`, `color?:any` |
| `delete_label` | Delete a label | `labelId:str` |

### Gmail Search Operators
Common query operators for `search_threads`:
- `newer_than:1d` — last day
- `from:user@example.com` — sender filter
- `to:user@example.com` — recipient filter
- `subject:keyword` — subject filter
- `label:INBOX` — label filter
- `is:unread` — unread messages
- Combine: `from:boss newer_than:7d is:unread`

### Gmail Enum Values
The Gmail MCP uses **SCREAMING_SNAKE** enum values that differ from the raw Gmail API:
- `messageFormat`: `FULL_CONTENT` (default), `MINIMAL`, `MESSAGE_FORMAT_UNSPECIFIED`
- Do **not** use `full` or `minimal` — they will return an invalid value error.
- Always confirm with `mcpc @gmail tools-get <tool>` before calling.

### Gmail Large Payload Handling
Threads with `FULL_CONTENT` can be 500KB+. Use `--json` + file redirect:
```bash
mcpc --json @gmail tools-call get_thread threadId:="<id>" messageFormat:="FULL_CONTENT" > /tmp/thread.json
< /tmp/thread.json jq -r '.content[0].text | fromjson | .messages[0].plaintextBody'
```

### Gmail OAuth Requirements
- Google Cloud project with Gmail API + Gmail MCP API enabled
- OAuth consent screen configured with scopes: `gmail.readonly`, `gmail.modify`
- Desktop app OAuth client (client ID + secret)
- Redirect URI `127.0.0.1:13316-13325/callback` must be registered

## Slack Tools

All Slack tools are prefixed with `slack_`.

| Tool | Description | Key Args |
|------|-------------|----------|
| `slack_search_channels` | Find a channel by name | `query:str`, `channel_types?:str`, `cursor?:str`, `limit?:int` |
| `slack_search_public` | Search messages across public channels | `query:str`, `content_types?:str`, `context_channel_id?:str`, `cursor?:str`, `limit?:int` |
| `slack_search_public_and_private` | Search messages across all channels | `query:str`, `channel_types?:str`, `content_types?:str`, `cursor?:str`, `limit?:int` |
| `slack_read_channel` | Read channel messages (newest first) | `channel_id:str`, `limit?:int`, `oldest?:str`, `latest?:str`, `cursor?:str`, `response_format?:str` (`detailed`\|`concise`) |
| `slack_read_thread` | Read thread replies | `channel_id:str`, `message_ts:str`, `limit?:int`, `cursor?:str` |
| `slack_send_message` | Post a message | `channel_id:str`, `message:str`, `thread_ts?:str` |
| `slack_schedule_message` | Schedule a message | `channel_id:str`, `message:str`, `post_at:int` |
| `slack_send_message_draft` | Send a message draft | `channel_id:str`, `message:str`, `thread_ts?:str` |
| `slack_search_users` | Find users | `query:str`, `cursor?:str`, `limit?:int` |
| `slack_read_user_profile` | Get user profile | `user_id?:str`, `include_locale?:bool`, `response_format?:str` |
| `slack_create_canvas` | Create a canvas | `title:str`, `content:str` |
| `slack_update_canvas` | Update a canvas | `canvas_id:str`, `action:str`, `content:str`, `canvas_id?:str` |
| `slack_read_canvas` | Read a canvas | `canvas_id:str` |

### Reading Channel Messages
Channel names (e.g. `#competitors`) do not work as arguments. You must resolve to a `channel_id` first:

1. `slack_search_channels query:="name"` → get `channel_id`
2. `slack_read_channel channel_id:="<id>"` → read messages

### Time-Bounded Reads
`slack_read_channel` accepts `oldest` and `latest` as Unix epoch timestamp strings:

```bash
# Compute timestamp
python -c "from datetime import datetime, timezone; print(datetime(2026,5,25,tzinfo=timezone.utc).timestamp())"

# Read this week's messages
mcpc @slack tools-call slack_read_channel channel_id:="CEXMZA74J" oldest:="1779667200.0" limit:=100
```

### OAuth Requirements
- Slack app with required scopes configured
- OAuth client ID + secret from Slack app settings
- Redirect URI `127.0.0.1:13316-13325/callback` must be registered in app
- Auth method: `client_secret_post`
- PKCE with S256 code challenge
- Scopes: `search:read.public search:read.private search:read.mpim search:read.im search:read.files search:read.users chat:write channels:history groups:history mpim:history im:history canvases:read canvases:write users:read users:read.email`

## mcpc Command Reference

### Global Options
| Option | Description |
|--------|-------------|
| `--json` | JSON output for scripting |
| `--verbose` | Debug logging |
| `--profile <name>` | OAuth profile name |
| `--timeout <seconds>` | Request timeout (default: 300) |
| `--max-chars <n>` | Truncate output |
| `--insecure` | Skip TLS verification |

### Session States
| State | Meaning |
|-------|---------|
| 🟢 `live` | Connected and responding |
| 🟡 `connecting` | Initial startup |
| 🟡 `reconnecting` | Auto-reconnecting after crash |
| 🟡 `disconnected` | Server unreachable |
| 🟡 `crashed` | Bridge process crashed |
| 🔴 `unauthorized` | Auth failed; re-run `login` then `restart` |
| 🔴 `expired` | Session ID rejected; run `restart` |

### Argument Syntax for tools-call
```bash
# Key:=value (auto-parsed: JSON types preserved, else string)
mcpc @s tools-call <tool> count:=10 enabled:=true name:="hello"

# Inline JSON
mcpc @s tools-call <tool> '{"key":"value"}'

# Pipe the FULL args object from stdin — all args as ONE JSON object (not a single
# argument's value), and pass NO key:=value flags alongside it. Use this for
# quote-heavy / multi-arg payloads (DDL, nested JSON, apostrophes in content).
echo '{"schema":"CREATE TABLE ...","parent":{"page_id":"<id>"}}' | mcpc @s tools-call <tool>

# Force string type
mcpc @s tools-call <tool> id:='"123"'
```

### Proxy Mode
Expose a sandboxed MCP proxy that hides OAuth credentials from clients:
```bash
mcpc connect <url> @<name> --proxy 8080
# Optional: protect proxy with bearer token
mcpc connect <url> @<name> --proxy 8080 --proxy-bearer-token secret
```

### Grep (Progressive Tool Discovery)
```bash
mcpc grep "search"              # Across all sessions
mcpc @notion grep "database"     # Single session
mcpc grep "mail" --resources     # Include resources
```

## File Locations
| Path | Contents |
|------|----------|
| `~/.mcpc/sessions.json` | Session metadata |
| `~/.mcpc/profiles.json` | OAuth profile metadata |
| `~/.mcpc/credentials` | Fallback credential store (Linux headless) |
| `~/.mcpc/logs/` | Bridge process logs |
| `~/.mcpc/history` | Interactive shell history |
| OS keychain | OAuth tokens (macOS Keychain / Linux Secret Service) |
