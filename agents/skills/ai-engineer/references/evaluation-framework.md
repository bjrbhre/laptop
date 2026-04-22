# Evaluation Framework for LLM Applications

## Evaluation Philosophy

Evaluations are not a phase — they are a continuous discipline. Every change to a prompt, model, or retrieval pipeline must be measured against a benchmark. Without evals, you are deploying blindly.

## Building Eval Datasets

### Dataset Requirements

| Criterion              | Minimum Standard                            |
| ---------------------- | ------------------------------------------- |
| Size                   | 50 gold-standard examples per task          |
| Coverage               | Happy path + edge cases + adversarial inputs |
| Diversity              | Vary input length, domain, complexity        |
| Versioning             | Git-tracked alongside code                  |
| Annotations            | Clear, unambiguous ground truth labels      |
| Freshness              | Review quarterly; update when distribution shifts |

### Dataset Construction Methods

1. **Production sampling.** Sample real user queries (anonymized). Annotate with ground truth. This is the highest-quality source.
2. **Synthetic generation.** Use a strong model to generate diverse test cases. Verify each synthetic example manually before inclusion.
3. **Adversarial construction.** Craft inputs designed to trigger failure modes: prompt injections, out-of-scope queries, ambiguous requests.
4. **Regression captures.** When a bug is found in production, add the triggering input to the eval set. Never fix without capturing.

### Annotation Guidelines

Write annotation instructions that a new team member could follow without context:
- Define each label with examples of what IS and IS NOT included.
- Include 3+ labeled examples per category.
- Resolve disagreements by consensus, not majority vote.
- Measure inter-annotator agreement (Cohen's κ > 0.7 target).

## Metric Selection by Task

### Factual Q&A (RAG)

| Metric         | What it measures                    | How to compute                            |
| -------------- | ----------------------------------- | ----------------------------------------- |
| Faithfulness    | Claims supported by retrieved context | Decompose response into claims; check each against context |
| Answer relevance | Response addresses the question    | Embed question and answer; measure similarity |
| Citation accuracy | Referenced sources actually contain the claim | Match citation markers to source chunks |
| Retrieval recall | Relevant chunks were retrieved      | Check if gold-answer chunks appear in top-k |

### Extraction

| Metric            | What it measures              | How to compute                           |
| ----------------- | ----------------------------- | ---------------------------------------- |
| Exact match       | Extracted value matches exactly | String comparison after normalization   |
| F1 (entity-level) | Balance of precision/recall    | Token-level or entity-level overlap      |
| Schema compliance | Output conforms to schema     | Validate against JSON Schema / Pydantic  |

### Classification

| Metric     | What it measures          | How to compute                    |
| ---------- | ------------------------- | --------------------------------- |
| F1 (macro) | Per-class performance     | Compute F1 per class, average     |
| ROC-AUC    | Ranking quality           | Threshold sweep on probabilities |
| Calibration | Confidence matches accuracy | Expected Calibration Error (ECE) |
| Latency    | Time to classify          | p50 and p99 measurements         |

### Summarization

| Metric             | What it measures                  | How to compute                        |
| ------------------ | --------------------------------- | ------------------------------------- |
| ROUGE-L            | N-gram overlap with reference    | Standard ROUGE implementation         |
| Consistency        | Summary consistent with source   | NLI-based entailment check            |
| Compression ratio  | Information density              | Source tokens / summary tokens       |
| Coverage           | Key points included              | Check against key-point checklist    |

### Code Generation

| Metric        | What it measures            | How to compute                          |
| ------------- | --------------------------- | --------------------------------------- |
| Pass@k        | Correctness over samples    | Generate k samples; check if any pass   |
| Test pass rate | Generated code passes tests | Run against test suite                  |
| Syntax valid  | Code parses without errors  | AST parsing or interpreter execution    |

### Agentic Tasks

| Metric              | What it measures            | How to compute                          |
| ------------------- | --------------------------- | --------------------------------------- |
| Task completion     | Goal achieved              | Binary: success / failure               |
| Tool call accuracy  | Correct tools, correct args | Compare against expected tool sequence |
| Efficiency          | Steps taken vs. minimum    | Actual steps / optimal steps            |
| Cost                | Tokens consumed            | Input + output tokens, priced per model |

## LLM-as-Judge

When human evaluation is infeasible at scale, use a strong model as evaluator.

### Judge Setup

1. Use a different model than the one being evaluated (avoid self-serving bias).
2. Provide the judge with: the input, the output, the evaluation criteria, and a scoring rubric.
3. Require structured scoring (1-5 scale with definitions for each level).
4. Include few-shot examples of good/bad outputs at each score level.
5. Measure judge agreement with human annotations on a held-out set. Target κ > 0.6.

### Judge Prompt Template

```
You are evaluating the quality of an AI response. Score on a 1-5 scale.

Criteria: {criteria_description}

Scoring rubric:
1 - {description}
2 - {description}
3 - {description}
4 - {description}
5 - {description}

Input: {input}
Response: {response}

Output your evaluation as JSON:
{
  "score": <1-5>,
  "reasoning": "<brief explanation>",
  "specific_issues": ["<issue1>", "<issue2>"]
}
```

### Judge Biases to Control

| Bias              | Manifestation                      | Mitigation                              |
| ----------------- | ---------------------------------- | --------------------------------------- |
| Position bias     | Prefers first option in A/B        | Randomize order; swap and re-evaluate   |
| Verbosity bias    | Longer responses score higher      | Normalize for length in criteria        |
| Self-preference   | Model favors its own style         | Use a different model family as judge   |
| Anchoring         | Score clusters around first example | Randomize example order in rubric      |

## CI/CD Integration

### Pipeline Stages

```
PR → Unit evals (fast, <2min) → Integration evals (<10min) → Deploy → Production monitoring
```

### Unit Evals (Every PR)

- Schema compliance on 20 examples
- Prompt regression on 10 critical examples
- Latency check on sample inputs
- Block merge on regression

### Integration Evals (Pre-deployment)

- Full eval suite (50+ examples)
- Cost estimation per 1k requests
- A/B comparison against current production model/prompt
- Deploy only if metrics are within tolerance or improved

### Production Monitoring

- Sample 1% of production outputs for quality review.
- Track daily averages for key metrics.
- Alert on: faithfulness drop > 5%, latency p99 increase > 20%, cost spike > 30%.
- Weekly quality review of flagged outputs.

## Regression Prevention

1. **Snapshot baseline.** Before any change, run the full eval suite and record results.
2. **Delta reporting.** After change, report delta per metric. Require explicit approval for any regression.
3. **Canary deployment.** Deploy to 5% traffic first. Monitor for 24 hours before full rollout.
4. **Rollback trigger.** If any primary metric drops below threshold, auto-rollback.
