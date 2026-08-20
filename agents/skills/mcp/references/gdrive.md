# Google Drive MCP Reference

Session: `@gdrive` · URL: `https://cnty-mcp-gd-krpe.cnty.dev/mcp` · Auth: automatic OAuth (DCR + PKCE, no pre-registered client)

Self-hosted server (repo: `~/repos/mcp/gdrive`, source: `api/main.py`). Exposes 28 tools across **Drive** (files/folders), **Docs**, **Slides**, and **Sheets**. Acts as an OAuth proxy to Google — the user consents once via browser, then the server holds/refreshes Google tokens on behalf of the client.

## Authentication

Automatic OAuth — same flow as Notion (built-in DCR + PKCE). **No** `--client-id`/`--client-secret` needed:

```bash
mcpc login https://cnty-mcp-gd-krpe.cnty.dev/mcp
# browser opens → consent screen → Google login → done
mcpc connect https://cnty-mcp-gd-krpe.cnty.dev/mcp @gdrive
```

Scopes granted: `drive`, `documents`, `presentations`, `spreadsheets`, `openid` (read + write across all four Google services).

## ID Conventions

- **File/folder IDs** are opaque strings (e.g. `1bj2eMJ3d5P7_...`). Get them from `list_folder_contents`, `search_files`, `get_recent_docs`, or from a Google Drive URL (`/d/<id>/edit`).
- **`root`** is a valid `folder_id` / `parent_id` meaning the user's My Drive root.
- **`parent_id`** is optional on create/copy tools; omit to place in root.
- **`sheet_id`** (numeric) ≠ `spreadsheet_id` (string). Get the numeric `sheet_id` from `get_spreadsheet_metadata` (one per tab).
- **`column_index`** and row `start_index`/`end_index` are **0-based**.

## Tool Reference

### Drive — files & folders

| Tool | Description | Key Args |
|------|-------------|----------|
| `list_folder_contents` | List a folder's files | `folder_id?:str` (default `root`) |
| `search_files` | Search Drive (Google query syntax) | `query:str`, `page_size?:int` |
| `get_recent_docs` | Recently modified Docs (newest first) | `limit?:int` (default 20) |
| `get_file_info` | File/folder metadata | `file_id:str` |
| `create_folder` | Create a folder | `name:str`, `parent_id?:str` |
| `move_file_to_folder` | Move file to a folder | `file_id:str`, `folder_id:str` |
| `rename_file` | Rename a file/folder | `file_id:str`, `new_name:str` |
| `copy_file` | Copy a file | `file_id:str`, `new_name:str`, `parent_id?:str` |
| `delete_file` | Trash a file/folder ⚠️ | `file_id:str` |
| `convert_to_google_sheet` | XLSX/CSV/ODS → native Google Sheet | `file_id:str`, `new_name?:str`, `parent_id?:str` |

### Docs

| Tool | Description | Key Args |
|------|-------------|----------|
| `create_google_doc` | Create an empty Doc | `title:str`, `parent_id?:str` |
| `list_google_doc_tabs` | List a Doc's tabs (title, id, nesting) | `document_id:str` |
| `get_google_doc` | Full Doc content + structure (one tab) | `document_id:str`, `tab_id?:str\|null` |
| `get_google_doc_comments` | List comments on a Doc | `document_id:str`, `include_deleted?:bool` |
| `update_google_doc` | batchUpdate on a Doc | `document_id:str`, `requests:[obj]` |
| `create_from_template` | Copy template Doc + replace placeholders | `template_id:str`, `new_name:str`, `replacements:obj`, `parent_id?:str` |

#### Multi-tab Docs (`tab_id`)

Google Docs can contain multiple tabs (like sheets in a spreadsheet). Each tab has a `tabId`, `title`, `index`, and optional `parentTabId`/`nestingLevel` (tabs can nest).

- **`get_google_doc` without `tab_id`** → returns only the **first** tab (legacy behavior). The other tabs' content is **not** in the response.
- **`get_google_doc` with `tab_id`** → fetches the whole doc, then *hoists* the requested tab's content into the top-level `body` field (identical shape to the single-tab case) and adds a `tab` object (`tabId`, `title`, `index`, `iconEmoji`) so you can confirm which tab came back.

The `tabId` is the value of the `tab` query param in the Google Docs URL: `...edit?tab=t.17h90ubq95o5` → `tabId` is `t.17h90ubq95o5`. So when you have the URL you can skip `list_google_doc_tabs` and pass `tab_id` directly.

```bash
# Discover tabs first (returns [{tabId, title, index, parentTabId, nestingLevel}])
mcpc @gdrive tools-call list_google_doc_tabs document_id:="<id>"
# Then fetch the specific tab
mcpc @gdrive tools-call get_google_doc document_id:="<id>" tab_id:="t.17h90ubq95o5"
```

### Slides

| Tool | Description | Key Args |
|------|-------------|----------|
| `create_presentation` | Create an empty deck | `title:str`, `parent_id?:str` |
| `create_presentation_with_slides` | Create deck + add slides with content in one call | `title:str`, `slides_content:[obj]`, `parent_id?:str` |
| `get_presentation` | Full deck content + structure | `presentation_id:str` |
| `create_slide` | Add a slide | `presentation_id:str`, `insertion_index?:int`, `slide_layout?:str` |
| `update_presentation` | batchUpdate on a deck | `presentation_id:str`, `requests:[obj]` |

### Sheets

| Tool | Description | Key Args |
|------|-------------|----------|
| `get_spreadsheet_data` | All cell values (native Sheets only) | `spreadsheet_id:str` |
| `get_spreadsheet_metadata` | Sheet names + numeric `sheetId`s | `spreadsheet_id:str` |
| `append_spreadsheet_values` | Append rows to a range | `spreadsheet_id:str`, `range_name:str`, `values:[[any]]` |
| `update_spreadsheet_values` | Overwrite a range | `spreadsheet_id:str`, `range_name:str`, `values:[[any]]` |
| `find_spreadsheet_row_by_value` | Find row by column value → 0-based index | `spreadsheet_id:str`, `sheet_name:str`, `column_index:int`, `search_value:str` |
| `delete_spreadsheet_rows` | Delete a row range ⚠️ | `spreadsheet_id:str`, `sheet_id:int`, `start_index:int`, `end_index:int` |
| `batch_update_spreadsheet` | batchUpdate (formatting, add sheets, etc.) | `spreadsheet_id:str`, `requests:[obj]` |

## Core Workflows

### Browse Drive
```bash
mcpc @gdrive tools-call list_folder_contents                    # root
mcpc @gdrive tools-call list_folder_contents folder_id:="<id>"  # specific folder
mcpc @gdrive tools-call get_recent_docs limit:=10
```

### Search Drive
`search_files` uses Google's Drive query syntax ([docs](https://developers.google.com/drive/api/guides/search-files)):

```bash
mcpc @gdrive tools-call search_files query:="name contains 'report'"
mcpc @gdrive tools-call search_files query:="mimeType='application/vnd.google-apps.spreadsheet' and modifiedTime > '2026-01-01T00:00:00'"
```

### Read a Google Doc / Sheet / Deck
```bash
mcpc @gdrive tools-call get_google_doc document_id:="<id>"                       # first tab only
mcpc @gdrive tools-call get_google_doc document_id:="<id>" tab_id:="t.xxxxx"    # specific tab
mcpc @gdrive tools-call get_spreadsheet_data spreadsheet_id:="<id>"
mcpc @gdrive tools-call get_presentation presentation_id:="<id>"
```
Responses can be large (full document JSON). For big docs use `--json` + a temp file + jq/grep (see mcpc-reference.md "Argument Syntax").

#### Multi-tab Doc gotcha (Gemini "Notes by Gemini" meeting notes)

Meeting-transcription docs typically have a `notes` tab and a `Transcription` tab. **A bare `get_google_doc` returns the `notes` tab** (short, mostly empty) — the real transcript payload lives in the `Transcription` tab. Always discover tabs first and pass `tab_id`:

```bash
# Tab ID is also in the URL: ?tab=t.17h90ubq95o5
mcpc --json @gdrive tools-call get_google_doc document_id:="<id>" tab_id:="t.17h90ubq95o5" > /tmp/tab.json
# Extract the transcript text
jq -r '.structuredContent.body.content[] | .paragraph? | select(.elements!=null) | .elements[] | .textRun.content? // empty' /tmp/tab.json
```
If a `get_google_doc` response looks suspiciously short for a long doc, check `list_google_doc_tabs` — you're probably on the wrong tab.

### Read an uploaded Office spreadsheet
`get_spreadsheet_data` only works on native Google Sheets. For XLSX/CSV/ODS, convert first:
```bash
mcpc @gdrive tools-call convert_to_google_sheet file_id:="<id>"
# then get_spreadsheet_data with the NEW id returned
```

### Create a Doc from a template
`create_from_template` copies a template Doc and replaces `{{placeholder}}` strings:
```bash
mcpc @gdrive tools-call create_from_template \
  template_id:="<id>" new_name:="Q3 Report - Acme" \
  replacements:='{"{{client}}":"Acme Corp","{{date}}":"2026-07-08"}'
```

### Sheets — find + read a row
```bash
# metadata gives the numeric sheetId + tab names
mcpc @gdrive tools-call get_spreadsheet_metadata spreadsheet_id:="<id>"
# find which row has a value in column 0
mcpc @gdrive tools-call find_spreadsheet_row_by_value spreadsheet_id:="<id>" sheet_name:="Sheet1" column_index:=0 search_value:="Acme"
# then read with get_spreadsheet_data (returns all rows; index client-side)
```

## Token freshness / reauth

This self-hosted server's session tends to go stale on the order of ~weekly (symptom: `mcpc @gdrive` tool calls fail with `Error: Authentication required by server` / `OAuthProvider in runtime mode does not support authorization flow`). A plain `restart` is not enough — re-login first, then restart:

```bash
mcpc login https://cnty-mcp-gd-krpe.cnty.dev/mcp   # browser consent (DCR + PKCE)
mcpc @gdrive restart
```
If a long-running session was previously live but now returns errors, assume the token expired and run the two commands above before debugging anything else.

## Server Maintenance Notes

These are server-side requirements in `api/main.py` (not client-side). The server **will break again** if regressed — keep these in place:

1. **Loopback redirect allowlist** — `allowed_client_redirect_uris` must include `http://127.0.0.1:*` (mcpc/RFC 8252 send `http://127.0.0.1:<port>/callback`, not `localhost`). Without it: `400 Redirect URI ... does not match allowed patterns`.
2. **`allowed_hosts`** on `mcp.http_app()` — derived from `MCP_SERVER_BASE_URL`, else fastmcp ≥3.4's `HostOriginGuardMiddleware` returns `421 Misdirected Request` for the public hostname behind Caddy.
3. **`ProxyHeadersMiddleware`** (+ `allowed_origins`) — rewrites the ASGI scope scheme to `https` from Caddy's `X-Forwarded-Proto`. Without it: `403 Forbidden Origin` on the consent POST, and metadata advertises `http://` issuers (which strict clients reject).
4. **Pin `fastmcp`** in `requirements.txt` — the 3.4.x behavioral changes caused all of the above. Unpinned upgrades risk reintroducing them.
5. Requires env: `MCP_SERVER_BASE_URL` (public https URL), `MCP_HOST`, `MCP_PORT`, and `credentials.json` (Google OAuth web client) in the working dir.

## OAuth Requirements (server side)

- Google Cloud project with Drive, Docs, Slides, Sheets APIs enabled
- OAuth consent screen with the 5 scopes above
- Web-application OAuth client → `credentials.json` (this is the **server's** Google client; the mcpc↔server hop uses DCR, no client creds needed on the mcpc side)
