---
name: mcp
description: Interact with Notion, Slack, Gmail, Google Drive, and Browser. The interaction is done using mcpc CLI (Model Context Protocol) Use only when the user requests to read, search, create, or update data in Notion, Slack, Gmail, Google Drive, or to use the user's active browser. Do not use for general file operations, or other services.
---

# MCP (Notion, Slack, Gmail, Google Drive, Browser)

Use `mcpc` to interact with Notion, Slack, Gmail, Google Drive, and Browser through the Model Context Protocol.

**If a session doesn't exist yet, you must `login` first (for OAuth), then `connect`. These are two separate steps — `--client-id`/`--client-secret` are `login`-only flags, not `connect` flags.**

Regarding the browser tab, when active, you can use it for all web interaction (search, page fetching etc) especially for websites with "protections" that require use of an active broweser.

## Sessions

| Service | URL / Config | Session | OAuth | Reference file |
|---------|--------------|---------|-------|----------------|
| Notion  | `https://mcp.notion.com/mcp` | `@notion` | Built-in (browser OAuth) | references/notion.md |
| Gmail   | `https://gmailmcp.googleapis.com/mcp/v1` | `@gmail` | Pre-registered client required | references/gmail.md |
| Google Drive | `https://cnty-mcp-gd-krpe.cnty.dev/mcp` | `@gdrive` | Built-in (browser OAuth, self-hosted) | references/gdrive.md |
| Slack   | `https://mcp.slack.com/mcp` | `@slack` | Pre-registered client required | references/slack.md |
| Browser | `~/.mcp.json:browser-control` | `@browser` | None (shared secret via `BROWSER_CONTROLE_MCP_KEY` env var) | references/browser.md |

NB: read the reference files before any interaction with mcpc based on the required needs.

## Quick Start

```bash
# Check active sessions
mcpc

# Connect to a server (creates a named session)
mcpc connect https://mcp.notion.com/mcp @notion

# List available tools
mcpc @notion tools-list

# Call a tool
mcpc @notion tools-call notion-search query:="my search"
```

## Authentication

### Browser — shared secret (stdio)
No OAuth needed. The MCP server connects to the Firefox extension via WebSocket using a shared secret. The secret is stored in `BROWSER_CONTROLE_MCP_KEY` and passed as `EXTENSION_SECRET` via `~/.mcp.json`.

**Prerequisites**: Install the [Browser Control MCP Firefox extension](https://addons.mozilla.org/en-US/firefox/addon/browser-control-mcp/), then copy the secret key from the extension's preferences page (`about:addons` → Browser Control → Preferences) into the `BROWSER_CONTROLE_MCP_KEY` env var.

Connect with:
```bash
mcpc connect ~/.mcp.json:browser-control @browser
```

### Notion & Google Drive — automatic OAuth
```bash
mcpc login https://mcp.notion.com/mcp
mcpc login https://cnty-mcp-gd-krpe.cnty.dev/mcp
```
Opens browser, handles PKCE and DCR automatically. (Google Drive is a self-hosted server; it proxies to Google — the browser consent is a Google login.)

### Gmail & Slack — require pre-registered OAuth client
Never read `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SLACK_OAUTH_CLIENT_ID`, or `SLACK_OAUTH_CLIENT_SECRET` env vars directly. Reference them via shell expansion only:

```bash
# Gmail
mcpc login https://gmailmcp.googleapis.com/mcp/v1 \
  --client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --client-secret "$GOOGLE_OAUTH_CLIENT_SECRET" \
  --scope "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify"

# Slack
mcpc login https://mcp.slack.com/mcp \
  --client-id "$SLACK_OAUTH_CLIENT_ID" \
  --client-secret "$SLACK_OAUTH_CLIENT_SECRET" \
  --scope "search:read.public search:read.private search:read.mpim search:read.im search:read.files search:read.users chat:write channels:history groups:history mpim:history im:history canvases:read canvases:write users:read users:read.email"
```

### Auth precedence when connecting
| Flag | Behavior |
|------|----------|
| `--header "Authorization: ..."` | Explicit header, skip OAuth |
| `--profile <name>` | Use named OAuth profile |
| `--no-profile` | Anonymous even if default profile exists |
| *(none)* | Use `default` profile if exists, else anonymous |

## Before Calling Tools: Check Schemas First

Enum values and argument names vary across MCP servers and may differ from common APIs (e.g., Gmail's `get_thread` uses `FULL_CONTENT` not `full`). **Always run `tools-get` before calling an unfamiliar tool** to confirm exact enum values, required args, and arg names:

```bash
mcpc @gmail tools-get get_thread
mcpc @browser tools-get get-tab-web-content
```

This avoids wasted calls with wrong enum values or missing required fields.

## Core Patterns

### Search and fetch
```bash
# Notion
mcpc @notion tools-call notion-search query:="keywords"
mcpc @notion tools-call notion-fetch id:="<page-or-db-id>"

# Gmail
mcpc @gmail tools-call search_threads query:="newer_than:1d"
mcpc @gmail tools-call get_thread threadId:="<id>" messageFormat:="FULL_CONTENT"

# Google Drive
mcpc @gdrive tools-call search_files query:="name contains 'report'"
mcpc @gdrive tools-call list_folder_contents folder_id:="root"
mcpc @gdrive tools-call get_google_doc document_id:="<id>"

# Slack — search messages across channels
mcpc @slack tools-call slack_search_public query:="keywords"
mcpc @slack tools-call slack_search_public_and_private query:="keywords"
```

### Create and update
```bash
# Notion — create page
mcpc @notion tools-call notion-create-pages pages:='[{"parent":{"page_id":"<id>"},"properties":{"title":{"title":[{"text":{"content":"My Page"}}]}}}]'

# Gmail — create draft
mcpc @gmail tools-call create_draft to:='["user@example.com"]' subject:="Hello" body:="Content"

# Google Drive — create folder / doc from template
mcpc @gdrive tools-call create_folder name:="Reports"
mcpc @gdrive tools-call create_from_template template_id:="<id>" new_name:="Q3 Report" replacements:='{"{{client}}":"Acme"}'

# Slack — send message
mcpc @slack tools-call slack_send_message channel_id:="<id>" message:="Hello"
```

### JSON output for large responses
Gmail threads and Slack channel reads can return hundreds of KB. Use `--json` and save to a temp file, then extract with **jq or grep only** (do not pipe to python — it is blocked):

```bash
# Save raw JSON to file (avoids truncation)
mcpc --json @gmail tools-call get_thread threadId:="<id>" messageFormat:="FULL_CONTENT" > /tmp/thread.json

# Extract plaintext body with jq
jq -r '.content[0].text | fromjson | .messages[0].plaintextBody' /tmp/thread.json

# Or use grep for quick extraction when jq is overkill
grep -o 'plaintextBody.*' /tmp/thread.json
```

## Session Management

```bash
mcpc                                          # List sessions & profiles
mcpc connect <url> @<name>                    # Create session
mcpc @<name> tools-list                       # Use session
mcpc @<name> restart                          # Restart (new session ID)
mcpc @<name> close                           # Close and remove session
mcpc clean                                    # Remove stale sessions
```

## Troubleshooting

- **401/403 errors after restart**: Token may have expired. Run `mcpc login <server>` (with appropriate flags for Gmail/Slack), then `mcpc @<name> restart`. A plain `restart` alone is not enough if the OAuth token is stale.
- **Session crashed**: Run `mcpc @<name> restart`
- **`tools-call` returns exit code 4 with empty output** (no stdout, no stderr): the session bridge has gone stale even though `mcpc` may still list it as `live`. Run `mcpc @<name> restart` and retry. **Do not interpret the empty output as "no results"** — it is a stale-session failure, not an empty result set. (Exit code 2 = a bash syntax/quoting error in your own command, not a session issue — fix the command.)
- **"Incompatible auth server"**: Use `--client-id`/`--client-secret` (Gmail/Slack)
- **"redirect_uri_mismatch"**: Add `http://127.0.0.1:13316/callback` through `http://127.0.0.1:13325/callback` in the Google Cloud Console / Slack app settings.
- **"Invalid value at message_format"**: You used a wrong enum string. Run `mcpc @<name> tools-get <tool>` to see valid values.
- **Output truncated**: Use `--json` and redirect to a file, then process with jq/grep.
- **@browser fails to connect**: Ensure the Firefox extension is running and the `BROWSER_CONTROLE_MCP_KEY` env var matches the extension's secret key. Check `~/.mcpc/logs/bridge-@browser.log`.
- **@browser get-tab-web-content returns error for a domain**: The user must grant content-read consent for that domain in the Firefox extension preferences (`about:addons` → Browser Control → Preferences). Wait a few seconds and retry (giving time to the user).
- **@browser open-browser-tab succeeds but content is empty**: The page may not have finished loading. Wait a few seconds and retry `get-tab-web-content`.
- **Logs**: Check `~/.mcpc/logs/bridge-@<name>.log`

## References

**IMPORTANT:** Load the correct reference file when using any one of the set of tools requested.

- [notion.md](references/notion.md) — Notion tools, URL resolution, page/database workflows
- [gmail.md](references/gmail.md) — Gmail tools, search syntax, enum values, large payloads
- [gdrive.md](references/gdrive.md) — Google Drive/Docs/Slides/Sheets tools, ID conventions, template workflows, server maintenance notes
- [slack.md](references/slack.md) — Slack tools, channel reads, pagination, time-bounded queries
- [browser.md](references/browser.md) — Browser Control tools, when to use vs web_fetch, webpage workflows
- [mcpc-reference.md](references/mcpc-reference.md) — Complete mcpc CLI reference (session states, argument syntax, proxy mode, file locations)
