# Guardrails and Safety for LLM Applications

## Defense-in-Depth Model

Never rely on a single safety layer. Apply multiple independent defenses so that if one fails, others catch the issue.

```
Input → [Input Guard] → [Prompt Construction] → LLM → [Output Guard] → User
              ↓                              ↓              ↓
         Reject/Log                    Rate Limit      Filter/Redact
```

## Input Guardrails

### Prompt Injection Defense

Prompt injection is the #1 security threat for LLM applications. Treat all user input as potentially adversarial.

**Defense layers:**

1. **Input sanitization.** Strip or escape special token sequences from user input before embedding in prompts. Remove `<|im_start|>`, `</system>`, and model-specific control tokens.

2. **Role separation.** Never concatenate user input and system instructions in the same message without clear delimiters. Use the model's structured message format (system / user / assistant turns).

3. **Instruction isolation.** Place all instructions in the system message. Place user input only in the user message. Never allow user input to override system instructions.

4. **Input classification.** Before processing, classify the input: is it a legitimate query or an attempted injection? Use a small, fast classifier. Reject or flag suspicious inputs.

```python
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"forget\s+(everything|all|your\s+rules)",
    r"you\s+are\s+now\s+",
    r"system\s*:\s*",
    r"<\|im_start\|>",
    r"\[INST\]",
]

def check_injection(user_input: str) -> bool:
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, user_input, re.IGNORECASE):
            return True
    return False
```

5. **Output format enforcement.** Require structured output. Free-form text is harder to validate and easier to manipulate.

### Input Validation Rules

- Enforce maximum input length. Truncate or reject inputs exceeding the limit.
- Validate input encoding. Reject inputs with unusual Unicode or encoding tricks.
- Check for data exfiltration patterns: URLs, API keys, email addresses in unexpected contexts.
- Rate limit per user/IP. Prevent automated probing.

## Output Guardrails

### Content Filtering

1. **PII detection.** Scan model outputs for personal data (names, emails, phone numbers, IDs). Redact before returning to user.

2. **Harmful content filter.** Use a classifier to detect hate speech, violence, self-harm, CSAM, and other policy-violating content. Block or redirect.

3. **Hallucination detection.** For RAG systems: verify that output claims map to retrieved source chunks. Flag uncited claims. For non-RAG: cross-reference high-stakes claims with a trusted source.

4. **Tone and style check.** Ensure output matches expected persona. Detect off-brand or inappropriate tone.

### Output Validation Pipeline

```python
def validate_output(response: str, context: dict) -> dict:
    result = {"response": response, "flags": [], "passed": True}

    # PII check
    pii_found = detect_pii(response)
    if pii_found:
        result["response"] = redact_pii(response, pii_found)
        result["flags"].append("pii_detected")

    # Safety check
    safety_score = safety_classifier(response)
    if safety_score < 0.8:
        result["passed"] = False
        result["flags"].append("safety_violation")

    # Citation check (RAG)
    if "sources" in context:
        uncited = find_uncited_claims(response, context["sources"])
        if uncited:
            result["flags"].append("uncited_claims")

    # Schema validation (structured output)
    if "schema" in context:
        try:
            validate_json(response, context["schema"])
        except ValidationError:
            result["passed"] = False
            result["flags"].append("schema_violation")

    return result
```

## Tenant Isolation

For multi-tenant systems, data leakage between tenants is a critical risk.

1. **Retrieval-level isolation.** Filter vector store queries by tenant ID. Never search across all tenants. Enforce this at the database query level, not the application level.

2. **Context isolation.** Never include data from tenant A in tenant B's prompt. Verify at prompt assembly time.

3. **Cache isolation.** Use tenant-scoped cache keys. Never serve cached responses across tenant boundaries.

4. **Logging isolation.** Separate audit logs per tenant. Never co-mingle logs from different tenants in the same stream.

```python
# Tenant-scoped retrieval
results = vector_store.search(
    query=user_query,
    filter={"tenant_id": tenant_id},  # ALWAYS scope to tenant
    top_k=5
)
```

## AI Act Compliance Mapping

### Risk Classification

| System Type                    | Risk Tier (AI Act) | Required Actions                                   |
| ------------------------------ | ------------------ | -------------------------------------------------- |
| Transparency tools (chatbots)  | Minimal            | Disclosure that user interacts with AI            |
| Risk scoring (insurance)       | High (Annex III)   | Full conformity assessment, human oversight, audit trail |
| Internal document processing   | Limited            | Transparency obligations, human oversight           |
| Safety components              | High               | Full conformity assessment, CE marking              |

### Governance Requirements by Risk Tier

**High-risk systems must implement:**
- Risk management system (continuous identification and mitigation)
- Data governance for training data quality
- Technical documentation (system architecture, design specs)
- Record-keeping (automatic logging of all model interactions)
- Transparency (clear information to deployers and users)
- Human oversight (meaningful human-in-the-loop or override)
- Accuracy, robustness, and cybersecurity measures
- Conformity assessment before market placement

**Limited-risk systems must implement:**
- Transparency obligations (disclose AI interaction)
- Provide information about the system's capabilities and limitations

**Minimal-risk systems:**
- No specific AI Act requirements (follow general data protection laws)

### Voluntary Over-Compliance Strategy

For systems at the boundary of risk tiers, adopt a voluntary over-compliance posture:
- Implement high-risk governance controls even if the system qualifies as limited risk.
- Document the risk classification decision with supporting evidence.
- Maintain the option to demonstrate compliance at a higher tier if regulation evolves.
- This is strategically safer than under-classifying and facing enforcement.

## Audit and Logging

### What to Log

| Event                | Fields                                                | Retention    |
| -------------------- | ----------------------------------------------------- | ------------ |
| User input           | Query, tenant, user ID, timestamp, input classification | Per policy   |
| Retrieval results    | Chunks retrieved, scores, sources, latency           | Per policy   |
| Model call          | Prompt tokens, completion tokens, model, latency, cost | Per policy |
| Raw model output     | Full response before filtering                       | Per policy   |
| Final output         | Filtered/redacted response sent to user              | Per policy   |
| Guardrail events     | Flags triggered, actions taken (block/redact/flag)   | Per policy   |
| User feedback        | Thumbs up/down, corrections, reports                 | Per policy   |

### Log Format

Use structured JSON logging. Every log entry must include:
- `trace_id` — Unique identifier linking all events in a single request
- `tenant_id` — Tenant scope
- `timestamp` — ISO 8601
- `event_type` — Category of the event
- `payload` — Event-specific data
- `flags` — Any safety/quality flags raised

### Retention

Align retention with applicable regulations:
- GDPR: No longer than necessary for the purpose.
- DORA: 5 years for ICT-related incident records.
- SOC 2: Per the organization's data retention policy.
- AI Act: Duration proportionate to the system's risk tier and lifecycle.

## Incident Response

When a safety incident occurs (jailbreak success, data leak, harmful output):

1. **Contain.** Disable the affected feature or revert to a safe model/prompt configuration.
2. **Analyze.** Review logs using the `trace_id`. Reproduce the attack vector.
3. **Patch.** Add the attack pattern to input classifiers. Update system prompts. Add output filters.
4. **Communicate.** Notify affected users if data was leaked. Report to regulators if required by AI Act or DORA.
5. **Post-mortem.** Document the incident, root cause, and fix. Add the pattern to the eval set as a regression test.
