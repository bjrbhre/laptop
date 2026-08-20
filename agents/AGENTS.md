# Project: Security & Compliance Knowledge Base

## Tool Discipline (CRITICAL)

When calling tools, ALWAYS use explicit named JSON parameters. Never use positional arguments. Never omit required parameters.

For the `write` tool specifically:
- `path` is REQUIRED — always specify it FIRST
- `content` is REQUIRED — always specify it SECOND
- Pattern: `write({ "path": "<filepath>", "content": "<text>" })`
- NEVER put the file content where the path should go
- NEVER start the write call with content — start with the path

For ALL tools: every required parameter must be present and explicitly named. Do not guess parameter names.

## Conventions

- Language: match the client's language (French for Groupama, etc.) or use English for internal docs
- Source documents in `raw/` are never modified — always work in `md/`
- Client response memos go to `md/clients/<Client>/`
- Internal memos go to `md/internal/memos/`
- Deep research goes to `md/internal/deep-researchs/`
- Use the `compliance` skill for compliance persona activation
- Use the `convert-docs` skill for PDF/DOCX → Markdown conversion
