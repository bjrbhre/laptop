## Tool Discipline (CRITICAL)

When calling tools, ALWAYS use explicit named JSON parameters. Never use positional arguments. Never omit required parameters.

For the `write` tool specifically:
- `path` is REQUIRED — always specify it FIRST
- `content` is REQUIRED — always specify it SECOND
- Pattern: `write({ "path": "<filepath>", "content": "<text>" })`
- NEVER put the file content where the path should go
- NEVER start the write call with content — start with the path

For ALL tools: every required parameter must be present and explicitly named. Do not guess parameter names.
