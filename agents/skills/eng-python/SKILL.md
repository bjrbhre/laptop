---
name: eng-python
description: Engineer production-grade Python applications and scripts using uv for all package management, version management, virtual environments, and code execution. Use when creating Python projects, adding dependencies, running Python code, managing Python versions, scaffolding apps or scripts, or applying Python engineering best practices.
---

# Engineering Python with uv

All Python work uses **uv** as the single tool for version management, package management, environment isolation, and code execution. Never use pip, poetry, pyenv, virtualenv, or pipx directly — uv replaces them all.

## Golden Rules

1. **uv for everything**: `uv run` to execute, `uv add` to depend, `uv python` to manage versions, `uvx` to run tools
2. **Lock everything**: Commit `uv.lock` — reproducibility is non-negotiable
3. **Type everything**: All function signatures get type hints; use `pyright` for checking
4. **Test everything**: Use `pytest`; aim for meaningful coverage, not number chasing
5. **Lint everything**: Use `ruff` for linting and formatting — zero warnings

## Decision: Project vs Script

| Scenario | Approach | Command |
|----------|----------|---------|
| Multi-file app or library | uv project | `uv init` |
| Single-file tool or utility | uv script with inline metadata | `uv add --script` |
| One-off execution | `uv run --with` | Ephemeral, no files |
| CLI tool installation | `uv tool install` or `uvx` | Global bin |

## Project Workflow

### Initialize

```bash
uv init --name myproject --python 3.12
```

### Pin Python version

```bash
uv python pin 3.12
```

Creates `.python-version` — commit this file.

### Add dependencies

```bash
uv add requests              # production dependency
uv add --dev pytest ruff pyright  # dev dependencies
```

### Run code

```bash
uv run python main.py        # run in project venv
uv run pytest                # run tests
uv run ruff check .          # lint
uv run pyright               # type check
```

### Sync and lock

```bash
uv lock                      # update lockfile
uv sync                      # sync env to lockfile
```

## Script Workflow

For single-file Python scripts with isolated dependencies:

```bash
uv add --script myscript.py requests httpx
```

This adds PEP 723 inline metadata. Run with:

```bash
uv run myscript.py
```

## One-off Execution

Run code with temporary dependencies — no project, no files:

```bash
uv run --with requests --with rich python -c "import requests; print(requests.get('https://example.com').status_code)"
```

## Python Version Management

```bash
uv python install 3.12 3.11 3.10    # install versions
uv python list                        # list available
uv python pin 3.12                    # pin for project
uv python upgrade 3.12                # upgrade to latest patch
uv python find 3.12                   # find installed interpreter
```

## Project Structure Standards

For application projects:

```
myproject/
├── pyproject.toml
├── uv.lock
├── .python-version
├── src/
│   └── myproject/
│       ├── __init__.py
│       ├── __main__.py
│       ├── core.py
│       └── config.py
└── tests/
    ├── conftest.py
    └── test_core.py
```

For library projects, use the `src` layout with a `py.typed` marker:

```
mylib/
├── pyproject.toml
├── uv.lock
├── .python-version
├── src/
│   └── mylib/
│       ├── __init__.py
│       ├── py.typed
│       └── ...
└── tests/
```

## pyproject.toml Standards

Every project must declare:

- `name`, `version`, `requires-python`
- `dependencies` and `optional-dependencies` (never inline version pins without lower bounds)
- `dev-dependencies` via `[dependency-groups]`
- Ruff and pyright configuration

See [pyproject reference](references/pyproject-reference.md) for complete templates.

## Quality Gates

Before considering any Python work complete, verify:

```bash
uv run ruff check .          # zero lint errors
uv run ruff format --check . # formatted
uv run pyright               # zero type errors
uv run pytest                # all tests pass
```

For detailed standards on each quality gate, see [engineering standards](references/engineering-standards.md).

## Key uv Commands Reference

For the complete command reference with flags and examples: [uv-commands](references/uv-commands.md).

## Advanced Patterns

- **Workspaces**: Multi-package monorepos — see [project patterns](references/project-patterns.md)
- **Script patterns**: Inline metadata, entry points — see [script patterns](references/script-patterns.md)
- **Testing and quality**: pytest, ruff, pyright configs — see [testing and quality](references/testing-and-quality.md)
