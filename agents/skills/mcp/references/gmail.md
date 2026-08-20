# Gmail MCP Reference

Session: `@gmail` · URL: `https://gmailmcp.googleapis.com/mcp/v1` · Auth: pre-registered OAuth client required

## Authentication

Never read `GOOGLE_OAUTH_CLIENT_ID` or `GOOGLE_OAUTH_CLIENT_SECRET` env vars directly. Reference them via shell expansion only:

```bash
mcpc login https://gmailmcp.googleapis.com/mcp/v1 \
  --client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --client-secret "$GOOGLE_OAUTH_CLIENT_SECRET" \
  --scope "https://www.googleapis.com/auth/gmail.readonly"
  # Add https://www.googleapis.com/auth/gmail.modify if write access is needed
```

## Tool Reference

| Tool | Description | Key Args |
|------|-------------|----------|
| `search_threads` | Search emails | `query:str`, `pageSize?:int`, `pageToken?:str`, `includeTrash?:bool` |
| `get_thread` | Read a thread | `threadId:str`, `messageFormat?:enum` (`FULL_CONTENT` (default), `MINIMAL`, `MESSAGE_FORMAT_UNSPECIFIED`) |
| `create_draft` | Compose a draft ⚠️ | `to:[str]`, `subject:str`, `body:str`, `cc?:[str]`, `bcc?:[str]`, `attachments?:[any]` |
| `list_drafts` | List drafts | `pageSize?:int`, `query?:str` |
| `list_labels` | List labels | `pageSize?:int` |
| `label_thread` | Add labels to thread ⚠️ | `threadId:str`, `labelIds:[str]` |
| `unlabel_thread` | Remove labels from thread ⚠️ | `threadId:str`, `labelIds:[str]` |
| `label_message` | Add labels to message ⚠️ | `messageId:str`, `labelIds:[str]` |
| `unlabel_message` | Remove labels from message ⚠️ | `messageId:str`, `labelIds:[str]` |
| `create_label` | Create a label ⚠️ | `displayName:str`, `color?:any` |
| `update_label` | Update a label ⚠️ | `labelId:str`, `displayName?:str`, `color?:any` |
| `delete_label` | Delete a label ⚠️ | `labelId:str` |

## Enum Values Differ from Raw Gmail API

The Gmail MCP uses **SCREAMING_SNAKE** enum values:
- `messageFormat`: `FULL_CONTENT` (default), `MINIMAL`, `MESSAGE_FORMAT_UNSPECIFIED`
- Do **not** use `full` or `minimal` — they will return an invalid value error.
- Always confirm with `mcpc @gmail tools-get <tool>` before calling.

## Search Query Syntax

Gmail `search_threads` supports these operators (combinable with spaces):

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:boss@example.com` | Sender filter |
| `to:` | `to:me@example.com` | Recipient filter |
| `subject:` | `subject:quarterly` | Subject filter |
| `newer_than:` | `newer_than:1d` | Relative time (1d, 7d, 30d) |
| `is:unread` | `is:unread` | Unread messages |
| `label:` | `label:INBOX` | Label filter |

Combine: `from:boss newer_than:7d is:unread`

## Two-Step Read Workflow

Use `search_threads` to find thread IDs, then `get_thread` to read bodies. Search results only return snippets.

```bash
# Step 1: search
mcpc @gmail tools-call search_threads query:="newer_than:1d"

# Step 2: read full thread
mcpc @gmail tools-call get_thread threadId:="<id>" messageFormat:="FULL_CONTENT"
```

## Large Payload Handling

A single thread with `FULL_CONTENT` can be 500KB+. Use `--json` + temp file + jq/grep:

```bash
mcpc --json @gmail tools-call get_thread threadId:="<id>" messageFormat:="FULL_CONTENT" > /tmp/thread.json

# Extract plaintext body
jq -r '.content[0].text | fromjson | .messages[0].plaintextBody' /tmp/thread.json

# Or grep for quick extraction
grep -o 'plaintextBody.*' /tmp/thread.json
```

## Creating a Draft

```bash
mcpc @gmail tools-call create_draft to:='["user@example.com"]' subject:="Hello" body:="Content"
```

## OAuth Requirements

- Google Cloud project with Gmail API + Gmail MCP API enabled
- OAuth consent screen configured with scopes: `gmail.readonly` (add `gmail.modify` if write access is needed)
- Desktop app OAuth client (client ID + secret)
- Redirect URI `127.0.0.1:13316-13325/callback` must be registered in Google Cloud Console
