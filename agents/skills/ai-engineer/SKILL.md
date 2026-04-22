---
name: ai-engineer
description: Build, evaluate, and deploy LLM-powered applications with production-grade patterns. Covers RAG pipelines, prompt engineering, agent architectures, evaluation frameworks, vector stores, and AI safety guardrails. Use when designing AI systems, crafting prompts, building retrieval pipelines, evaluating model outputs, or hardening LLM applications for production.
---

# AI Engineer

Architect, build, and operate LLM-powered systems with rigor.

## Core Principle

**Measure everything. Optimize nothing without a benchmark.** LLM applications fail silently — hallucinations look plausible, latency hides behind streaming, cost creeps with context windows. Every design decision must be traceable to an evaluation.

## Workflow

1. **Define the task** — Classify: generation, extraction, classification, summarization, reasoning, or agentic. Each demands different evaluation and guardrails.
2. **Select the pattern** — Match the task to an architecture. See [references/architecture-patterns.md](references/architecture-patterns.md).
3. **Implement with guardrails** — Build safety, validation, and fallback from the start. See [references/guardrails-and-safety.md](references/guardrails-and-safety.md).
4. **Evaluate rigorously** — Run automated evals before manual review. See [references/evaluation-framework.md](references/evaluation-framework.md).
5. **Deploy and monitor** — Track latency, cost, quality, and drift in production.

## Architecture Decision Rules

| If the task is...        | Start with...                        | Avoid...                          |
| ------------------------ | ------------------------------------- | --------------------------------- |
| Factual Q&A              | RAG + citations                       | Raw generation without retrieval  |
| Multi-step reasoning     | ReAct agent with tool use             | Single-shot prompting            |
| Document extraction      | Structured output + schema validation | Free-form extraction             |
| Classification           | Few-shot + confidence threshold       | Zero-shot on critical paths       |
| Summarization            | Chain-of-density or map-reduce        | Naive single-prompt summarize    |
| Code generation          | Iterative refinement + tests          | One-shot generation               |

## Prompt Engineering Rules

1. **System prompt first.** Define role, constraints, output format, and examples in the system message. Never bury instructions in user content.
2. **Structured output over free text.** Use JSON mode, function calling, or Pydantic schemas. Parse failures are cheaper than hallucination cleanup.
3. **Examples over instructions.** 3-5 diverse few-shot examples outperform a paragraph of rules. Match example complexity to expected input.
4. **Chain-of-thought for reasoning.** Add "think step by step" or structured reasoning templates for multi-step tasks. Never omit this for tasks requiring logic or arithmetic.
5. **Temperature control.** Use 0 for extraction/classification. Use 0.3-0.7 for generation. Use 0.8+ only for creative tasks. Never default to 1.0.
6. **Context window discipline.** Truncate aggressively. Use RAG instead of stuffing context. Monitor token usage per request.

## RAG Pipeline Checklist

1. **Chunking strategy** — Match chunk size to the task: 256-512 tokens for factual retrieval, 1024+ for reasoning over long passages. Overlap by 10-15%.
2. **Embedding model** — Use domain-matched embeddings. Re-embed when switching models. Benchmark retrieval recall@5 before committing.
3. **Retrieval** — Start with semantic search. Add BM25 hybrid if recall is below 90%. Add reranking if precision is below 80%.
4. **Citation enforcement** — Instruct the model to cite sources. Validate citations against retrieved chunks. Flag uncited claims.
5. **Failure mode** — Define what happens when retrieval returns nothing. Return "I don't know" with source suggestion — never fabricate.

## Agent Design Rules

1. **Max iterations.** Always set a hard limit on reasoning loops (3-5 steps). Unbounded agents are a cost and safety risk.
2. **Tool schemas.** Define strict input/output schemas for every tool. Validate before execution. Never pass raw LLM output to external systems.
3. **Observability.** Log every tool call, reasoning step, and final output. Trace the full decision chain. Use structured logging (JSON).
4. **Graceful degradation.** If a tool fails, the agent must recover — retry, use a fallback tool, or report the failure. Never crash the pipeline.
5. **Human-in-the-loop.** Flag ambiguous, high-stakes, or low-confidence decisions for human review. Never auto-execute beyond defined autonomy thresholds.

## Evaluation Framework

### Three-Layer Eval Stack

1. **Unit evals** — Per-component: retrieval recall, prompt adherence, schema compliance. Run on every commit.
2. **Integration evals** — End-to-end: task accuracy, latency, cost per request. Run before deployment.
3. **Production evals** — Online: user feedback, quality drift, failure rate. Monitor continuously.

### Metric Selection

| Task              | Primary metric         | Secondary metrics           |
| ----------------- | ---------------------- | --------------------------- |
| Factual Q&A       | Faithfulness / Accuracy | Citation rate, latency      |
| Extraction        | F1 / Exact match       | Schema compliance, cost     |
| Classification    | F1 / ROC-AUC           | Calibration, latency        |
| Summarization     | ROUGE / Consistency    | Compression ratio, latency  |
| Code generation   | Pass@k / Test pass rate | Syntax validity, latency    |
| Agentic tasks     | Task completion rate    | Tool call accuracy, cost    |

### Eval Dataset Rules

- Minimum 50 gold-standard examples per task.
- Cover edge cases: empty input, adversarial input, out-of-domain queries.
- Version control eval sets alongside code.
- Never train on eval data. Never cherry-pick eval results.

## Cost Optimization

1. **Model routing.** Route simple tasks to smaller models (GPT-4o-mini, Claude Haiku). Reserve frontier models for complex reasoning. Implement confidence-based fallback.
2. **Caching.** Cache identical or semantically similar requests. Use exact match for deterministic tasks, semantic caching for generation.
3. **Context pruning.** Remove redundant context before calling the model. Re-rank and keep only top-k relevant chunks.
4. **Batch over streaming for evals.** Use batch APIs for evaluation runs. Reserve streaming for user-facing interactions only.
5. **Track cost per task.** Attribute token costs to feature/product area. Set budgets and alert on overruns.

## Safety and Compliance

1. **Input validation.** Sanitize all user input before it reaches the model. Reject prompt injection patterns. Log rejected inputs.
2. **Output filtering.** Scan model outputs for PII, harmful content, and policy violations. Block or redact before returning to user.
3. **Audit trail.** Log every prompt, retrieval context, model response, and user action. Store for the retention period required by applicable regulation.
4. **Data boundaries.** Never include data from one tenant in another tenant's context. Enforce at the retrieval layer, not just the application layer.
5. **AI Act awareness.** Classify the system's risk tier. Implement governance proportionate to risk. Document the classification decision. See [references/guardrails-and-safety.md](references/guardrails-and-safety.md).

## References

- [references/architecture-patterns.md](references/architecture-patterns.md) — RAG, agent, and chain patterns with implementation details
- [references/evaluation-framework.md](references/evaluation-framework.md) — Eval datasets, metrics, and CI/CD integration
- [references/guardrails-and-safety.md](references/guardrails-and-safety.md) — Input/output filtering, prompt injection defense, compliance mapping
