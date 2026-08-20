---
name: tool-discipline
description: Enforce strict JSON tool-call schema compliance. Prevents missing required params (especially path in write), positional args, and schema mismatches. Apply globally or when models hallucinate tool calls.
---

When calling tools, ALWAYS use explicit named parameters in the JSON object. Never use positional arguments. Never omit required parameters.

Specifically for the `write` tool:
- `path` is REQUIRED — always include it FIRST, before `content`
- `content` is REQUIRED — always include it SECOND
- Pattern: `write({ "path": "<filepath>", "content": "<text>" })`
- NEVER put the content where the path should go
- NEVER start the write call with the file content — start with the path

For ALL tools:
- Every required parameter must be present and explicitly named
- Do not guess or hallucinate parameter names — use exactly the names from the tool schema
- If unsure about a parameter, check the tool definition first
