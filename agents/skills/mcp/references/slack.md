# Slack MCP Reference

Session: `@slack` · URL: `https://mcp.slack.com/mcp` · Auth: pre-registered OAuth client required

## Authentication

Never read `SLACK_OAUTH_CLIENT_ID` or `SLACK_OAUTH_CLIENT_SECRET` env vars directly. Reference them via shell expansion only:

```bash
mcpc login https://mcp.slack.com/mcp \
  --client-id "$SLACK_OAUTH_CLIENT_ID" \
  --client-secret "$SLACK_OAUTH_CLIENT_SECRET" \
  --scope "search:read.public search:read.private search:read.mpim search:read.im search:read.files search:read.users chat:write channels:history groups:history mpim:history im:history canvases:read canvases:write users:read users:read.email"
```

## Tool Reference

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

## Reading Channel Messages — Two-Step Workflow

Channel names (e.g. `#competitors`) don't work directly. You must resolve to a `channel_id` first:

1. **Find the channel ID** — use `slack_search_channels` to resolve a name to a `channel_id`.
2. **Read messages** — use `slack_read_channel` with the `channel_id`. Messages come back newest-first.

```bash
# Step 1: find channel ID
mcpc @slack tools-call slack_search_channels query:="competitors"
# → channel_id e.g. "CEXMZA74J"

# Step 2: read messages
mcpc @slack tools-call slack_read_channel channel_id:="CEXMZA74J" limit:=50
```

## Time-Bounded Reads with oldest/latest

`slack_read_channel` accepts `oldest` and `latest` as Unix epoch timestamps (string). Use this to scope reads to a specific time range:

```bash
# Compute Unix timestamp for a date
python -c "from datetime import datetime, timezone; print(datetime(2026,5,25,tzinfo=timezone.utc).timestamp())"
# → 1779667200.0

# Read this week's messages only
mcpc @slack tools-call slack_read_channel channel_id:="CEXMZA74J" oldest:="1779667200.0" limit:=100
```

## Paginating Channel Reads

When there are more messages than `limit`, the response includes a `next_cursor`. Pass it as `cursor` to fetch the next page:

```bash
mcpc @slack tools-call slack_read_channel channel_id:="CEXMZA74J" cursor:="<next_cursor>" limit:=100
```

## Reading Threads from a Slack Permalink URL

When given a Slack thread URL like `https://k-continuity.slack.com/archives/C0B0FNBBTNZ/p1780565989702139`, extract the `channel_id` and `message_ts`:

- **Channel ID**: the `C...` segment after `/archives/` → `C0B0FNBBTNZ`
- **Message TS**: the `p...` segment, converted by inserting a `.` before the last 6 digits → `p1780565989702139` becomes `1780565989.702139`

⚠️ **The `key:=value` CLI syntax does NOT reliably pass `message_ts` to `slack_read_thread`.** It fails with `thread_not_found`. Always use JSON piped via stdin:

```bash
# ✅ Correct — use JSON stdin to read a thread
echo '{"channel_id":"C0B0FNBBTNZ","message_ts":"1780565989.702139","limit":50}' | mcpc @slack tools-call slack_read_thread

# ❌ Wrong — fails with thread_not_found
mcpc @slack tools-call slack_read_thread channel_id:="C0B0FNBBTNZ" message_ts:="1780565989.702139" limit:=50
```

**Fallback if `slack_read_thread` still fails:** Use `slack_read_channel` with `oldest`/`latest` timestamps scoped around the message to locate it, then retry the thread read.

## Sending Messages

### Posting to a channel (no thread)

```bash
mcpc @slack tools-call slack_send_message channel_id:="<id>" message:="Hello"
```

### Replying in a thread — MUST use JSON stdin

⚠️ **The `key:=value` CLI syntax does NOT reliably pass `thread_ts` to the Slack API.** Using `thread_ts:="<ts>"` on the command line results in the message being posted to the channel instead of as a threaded reply. Always use JSON piped via stdin for thread replies.

```bash
# ✅ Correct — use JSON stdin to reply in a thread
echo '{"channel_id":"<id>","thread_ts":"<ts>","message":"Reply"}' | mcpc @slack tools-call slack_send_message

# ✅ Correct — with heredoc for longer messages
cat << 'EOF' | mcpc @slack tools-call slack_send_message
{"channel_id":"<id>","thread_ts":"<ts>","message":"Reply"}
EOF

# ❌ Wrong — thread_ts is silently ignored, message goes to channel
mcpc @slack tools-call slack_send_message channel_id:="<id>" message:="Reply" thread_ts:="<ts>"
```

**How to verify it worked:** The returned `message_link` should contain `?thread_ts=<ts>&cid=<id>`. If the link has no `thread_ts` query param, the message was posted to the channel, not the thread.

### Getting the parent message timestamp

To reply in a thread, you need the `thread_ts` (i.e. the parent message's `ts`). Get it from:
- `slack_read_channel` — the `Message TS` field in the output
- `slack_read_thread` — the `Message TS` field in the parent message
- A Slack permalink URL like `https://workspace.slack.com/archives/CEXMZA74J/p1780557259943879` → extract `1780557259.943879` (insert a `.` before the last 6 digits)

⚠️ **Same `key:=value` caveat applies to `slack_send_message` with `thread_ts`** — always use JSON stdin (see examples above).

## OAuth Requirements

- Slack app with required scopes configured
- OAuth client ID + secret from Slack app settings
- Redirect URI `127.0.0.1:13316-13325/callback` must be registered in app
- Auth method: `client_secret_post`
- PKCE with S256 code challenge
