# Browser Control MCP Reference

Session: `@browser` · Config: `~/.mcp.json:browser-control` · Auth: shared secret via `BROWSER_CONTROLE_MCP_KEY` env var (no OAuth)

## Prerequisites

Install the [Browser Control MCP Firefox extension](https://addons.mozilla.org/en-US/firefox/addon/browser-control-mcp/), then copy the secret key from the extension's preferences page (`about:addons` → Browser Control → Preferences) into the `BROWSER_CONTROLE_MCP_KEY` env var.

## Connection

The MCP server connects to the Firefox extension via WebSocket using a shared secret. The secret is stored in `BROWSER_CONTROLE_MCP_KEY` and passed as `EXTENSION_SECRET` via `~/.mcp.json`.

```bash
mcpc connect ~/.mcp.json:browser-control @browser
```

## Tool Reference

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

## When to Use Browser Control Instead of `web_fetch`

Use `@browser` when you need to read webpage content from the user's active browser. **Always prefer `@browser` over `web_fetch` for these sites** — they block or return empty/unusable content via plain HTTP fetching:

| Site / Category | What happens with `web_fetch` | Why `@browser` works |
|----------------|-------------------------------|---------------------|
| **Reddit** (`reddit.com`) | 403 Forbidden | Extension reads rendered DOM |
| **Old Reddit** (`old.reddit.com`) | 403 Forbidden | Extension reads rendered DOM |
| **LinkedIn** (`linkedin.com`) | 999 auth-wall / redirect to login | Reads user's logged-in session |
| **Medium** (`medium.com`) | 403 Forbidden | Extension reads rendered DOM |
| **X / Twitter** (`x.com`, `twitter.com`) | Returns empty JS shell (no content) | Extension reads rendered DOM |
| **Instagram** (`instagram.com`) | Login wall for most content | Reads user's logged-in session |
| **Facebook** (`facebook.com`) | Login wall | Reads user's logged-in session |
| **Cloudflare-protected sites** | JS challenge / 403 | Extension already passed the challenge |
| **Any login-gated page** | Redirect to login / 401 / 403 | Reads user's logged-in session |

General rule: if `web_fetch` returns a no content or the content is clearly a JS shell with no actual text, switch to `@browser`.

### Google Docs with `?tab=` — prefer `@gdrive`
For Google Docs (docs.google.com) — especially meeting notes with a specific `?tab=t.xxxxx` — prefer `@gdrive get_google_doc(document_id=..., tab_id=...)` over `@browser`. The Docs API returns clean structured JSON for any named tab and needs no rendered tab. `@browser` is the fallback only when the Docs API can't reach the tab (e.g. the `tab_id` arg didn't exist yet on older server versions).

### Reddit-specific rate limiting

Reddit serves its own rate-limit page with the literal text **"whoa there, pardner!"** when it flags the source (proxy/IP) as suspicious — this is distinct from the `403 Forbidden` above and means you need to slow down or rotate source, not that the page is missing. Do not mistake it for a normal error page.

## Reading a Webpage — Workflow

1. **Open the URL** in a new tab (if not already open):
   ```bash
   mcpc @browser tools-call open-browser-tab url:="https://www.reddit.com/r/example/comments/abc123/"
   ```
   This returns a `tab id`.
2. **Wait a moment** for the page to load, then **read the content**:
   ```bash
   mcpc @browser tools-call get-tab-web-content tabId:=<id>
   ```
   For large pages, the response may be truncated. Use `offset` to continue reading:
   ```bash
   mcpc @browser tools-call get-tab-web-content tabId:=<id> offset:=5000
   ```
3. **Close the tab** when done (optional):
   ```bash
   mcpc @browser tools-call close-browser-tabs tabIds:='[<id>]'
   ```

## Finding a Tab by URL

To find the tab ID for an already-open page:
```bash
mcpc @browser tools-call get-list-of-open-tabs | grep -i "reddit"
```

## User Consent for Reading Content

Reading webpage text requires the user to grant consent in the Firefox extension for each domain. If `get-tab-web-content` returns an error, the user needs to approve the domain in the extension's preferences. In this case, give the user a little time to approve the request and try again.

## Large Page Content

Pages can return large text payloads. Use `--json` and save to a temp file if needed:
```bash
mcpc --json @browser tools-call get-tab-web-content tabId:=42 > /tmp/page.json
```

## Troubleshooting

- **Empty content with no error** can mean a `429 Too Many Requests` (or another non-200 status): the browser renders these as a Firefox error page with no body text, so the tool returns empty rather than the literal `429`. **Check for empty content, do not grep for `429` in the text** — strings like a username containing `429` (e.g. `Substantial-Cost-429`) cause false positives. Treat empty content as a likely rate-limit and back off / rotate.
- **Close tabs as you go in scraping scripts.** Each `open-browser-tab` keeps a tab open in the user's Firefox; in a loop, unclosed tabs accumulate and cause browser memory overflow. Call `close-browser-tabs` after each page is read, not only at the end of the run.
