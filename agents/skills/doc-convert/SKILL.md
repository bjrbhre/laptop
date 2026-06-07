---
name: doc-convert
description: Convert any PDF or DOCX document to Markdown using the doc-tooling uv/python project at ~/laptop/agents/scripts/doc-tooling. Use when asked to convert a document, transform a PDF or Word file to Markdown, or process a folder of documents.
---

# doc-convert

Convert PDF/DOCX → Markdown using Docling. Works on a single file or a whole directory, from any project or path.

## Project location

```
~/laptop/agents/scripts/doc-tooling/
```

## Usage

```bash
# Single file — output next to source
uv run --project ~/laptop/agents/scripts/doc-tooling convert report.pdf

# Single file — explicit output path
uv run --project ~/laptop/agents/scripts/doc-tooling convert report.pdf summary.md
uv run --project ~/laptop/agents/scripts/doc-tooling convert report.pdf ./output/

# Directory — in-place (.md next to each source)
uv run --project ~/laptop/agents/scripts/doc-tooling convert ./docs/

# Directory — mirror structure into output dir
uv run --project ~/laptop/agents/scripts/doc-tooling convert ./docs/ ./md/

# Dry run (preview without writing)
uv run --project ~/laptop/agents/scripts/doc-tooling convert ./docs/ ./md/ --check
```

## Output path rules

| Input | Output arg | Result |
|---|---|---|
| `file.pdf` | _(none)_ | `file.md` next to source |
| `file.pdf` | `out.md` | `out.md` |
| `file.pdf` | `./dir/` | `./dir/file.md` |
| `./docs/` | _(none)_ | `.md` next to each source |
| `./docs/` | `./md/` | mirrors structure: `docs/a/b.pdf` → `md/a/b.md` |

## Setup (first time only)

```bash
cd ~/laptop/agents/scripts/doc-tooling
uv sync
```

## Supported formats

`.pdf`, `.docx`
