# Architecture Patterns for LLM Applications

## Pattern 1: Single-Shot with Structured Output

**Use when:** Simple extraction, classification, or transformation tasks.

```
User Input → [Prompt Template] → LLM → [Schema Validation] → Output
```

Implementation rules:
- Define output schema as a Pydantic model or JSON Schema.
- Use the model's structured output mode (function calling, JSON mode).
- Retry on schema validation failure (max 2 retries, then fail gracefully).
- Never accept unstructured output for structured tasks.

```python
from pydantic import BaseModel

class ExtractionResult(BaseModel):
    entity_name: str
    risk_category: str
    confidence: float

# Use model's structured output mode
response = client.chat.completions.create(
    model="gpt-4o",
    response_format={"type": "json_object"},
    messages=[...]
)
result = ExtractionResult.model_validate_json(response.choices[0].message.content)
```

## Pattern 2: RAG Pipeline

**Use when:** Factual Q&A, document-grounded analysis, knowledge-intensive tasks.

```
User Query → [Query Transform] → [Retriever] → [Reranker] → [Prompt Assembly] → LLM → [Citation Check] → Output
```

### Query Transform

- Rewrite the user query for retrieval: expand abbreviations, add synonyms, decompose multi-part questions.
- Generate hypothetical document embeddings (HyDE) for better semantic matching.

### Retriever Options

| Retriever            | Strengths                         | Weaknesses                     |
| -------------------- | --------------------------------- | ------------------------------ |
| Dense (embedding)    | Semantic similarity, flexible     | Misses exact keyword matches   |
| Sparse (BM25)        | Exact keyword matching, fast      | Misses semantic similarity     |
| Hybrid               | Best recall, covers both          | Higher latency, fusion tuning |
| Parent-child         | Fine-grained retrieval, full context | Index complexity              |

### Reranking

Apply a cross-encoder reranker after initial retrieval:
1. Retrieve top-20 chunks with hybrid search.
2. Rerank with a cross-encoder model (Cohere Rerank, BGE-Reranker, or similar).
3. Keep top-5 for context assembly.

### Prompt Assembly

```
System: You are a [role]. Answer using ONLY the provided context.
Cite sources as [Source N] after each claim.

Context:
[Source 1] {chunk_1}
[Source 2] {chunk_2}
...

User: {query}
```

### Citation Check

- Parse `[Source N]` references from the output.
- Verify each reference maps to a real retrieved chunk.
- Flag uncited factual claims for review.

## Pattern 3: Map-Reduce

**Use when:** Processing documents too long for a single context window (summarization, analysis of large corpora).

```
Documents → [Chunk] → [Map: process each chunk] → [Reduce: combine results] → Output
```

Implementation:
1. Split documents into chunk-sized inputs.
2. Run the same prompt on each chunk in parallel.
3. Combine partial results with a reduce prompt.
4. For summarization: apply chain-of-density — iteratively compress while preserving key information.

## Pattern 4: ReAct Agent

**Use when:** Multi-step reasoning, tool use, tasks requiring external data or actions.

```
User Goal → [Plan] → [Action: tool call] → [Observation] → [Reflect] → [Plan/Action] → ... → Final Answer
```

Implementation rules:
- Set `max_iterations = 5`. Hard limit, non-negotiable.
- Define a strict tool catalog with input schemas.
- Log the full thought-action-observation trace.
- Implement a stop condition: if the agent repeats the same action, force termination.
- Include a "give up" tool that the agent can call when it cannot complete the task.

```python
tools = [
    {
        "name": "search_documents",
        "description": "Search the knowledge base for relevant documents",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer", "default": 5}
            },
            "required": ["query"]
        }
    },
    {
        "name": "unable_to_complete",
        "description": "Call when the task cannot be completed with available tools",
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"}
            },
            "required": ["reason"]
        }
    }
]
```

## Pattern 5: Multi-Agent Orchestration

**Use when:** Complex workflows with distinct phases (research → analysis → drafting → review).

```
User Request → [Router] → [Specialist Agent 1] → [Specialist Agent 2] → ... → [Reviewer Agent] → Output
```

Implementation rules:
- Each agent has a single responsibility and a bounded tool set.
- The router classifies the request and selects the agent sequence.
- Agents communicate through structured messages, not raw text.
- The reviewer agent validates the final output against quality criteria.
- Log the full orchestration trace for debugging and improvement.

## Pattern 6: Chain-of-Verification

**Use when:** High-stakes generation where accuracy is critical (legal, medical, financial).

```
User Query → [Generate initial response] → [Generate verification questions] → [Answer verification questions independently] → [Cross-check against original response] → [Corrected response]
```

Implementation:
1. Generate the initial response as normal.
2. Prompt the model to generate verification questions about its own claims.
3. Answer each verification question independently (no access to original response).
4. Compare verification answers against original claims.
5. Revise the response to correct any contradictions.

## Anti-Patterns

### ❌ Stuffing the Context Window
Do not paste entire documents into the prompt hoping the model will "find the right part." Use retrieval instead.

### ❌ Unbounded Agent Loops
Do not allow agents to iterate without a hard limit. Cost and safety risks escalate quickly.

### ❌ No Output Validation
Do not trust raw model output. Always validate structure, content, and safety before returning to the user.

### ❌ Single-Model Monoculture
Do not route all tasks to the most expensive model. Use model routing based on task complexity.

### ❌ Eval as Afterthought
Do not build first and evaluate later. Define evals alongside requirements.
