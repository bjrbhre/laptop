# Testing and Quality

Testing, linting, and type checking standards for production Python projects using uv.

## pytest Configuration

### Install

```bash
uv add --group dev pytest pytest-cov
```

### pyproject.toml config

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = [
    "--strict-markers",
    "--strict-config",
    "-ra",                    # show summary of all failures
    "--cov=src/myproject",    # coverage target
    "--cov-report=term-missing",
]
markers = [
    "slow: marks tests as slow (deselect with '-m not slow')",
    "integration: marks integration tests",
]
```

### Test structure

```
tests/
├── conftest.py           # fixtures and shared configuration
├── test_core.py          # tests for core module
├── test_config.py        # tests for config module
├── test_cli.py           # tests for CLI (if applicable)
└── integration/          # integration tests in separate directory
    ├── conftest.py
    └── test_api.py
```

## Writing Tests

### Rules

1. **Test behavior, not implementation** — test what the function does, not how
2. **One assertion per concept** — multiple assertions are fine if they test one logical thing
3. **Use descriptive test names** — `test_process_rejects_empty_input`, not `test_process_1`
4. **Use `@pytest.mark.parametrize`** for testing multiple inputs/outputs
5. **Use fixtures** for shared setup — never copy-paste setup code across tests
6. **Test edge cases explicitly** — empty inputs, None, zero, very large values
7. **Test error paths** — verify that invalid input raises the expected exception
8. **Keep tests independent** — no ordering dependencies, no shared mutable state

### Pattern: Basic test

```python
from __future__ import annotations

import pytest

from myproject.core import process


def test_process_returns_result_for_valid_input() -> None:
    result = process("valid data")
    assert result.status == "success"
    assert result.value > 0


def test_process_raises_validation_error_for_empty_input() -> None:
    with pytest.raises(ValidationError, match="Name is required"):
        process("")
```

### Pattern: Parametrized test

```python
@pytest.mark.parametrize(
    ("input_value", "expected"),
    [
        ("hello", "HELLO"),
        ("world", "WORLD"),
        ("", ""),
        ("mixed Case", "MIXED CASE"),
    ],
)
def test_uppercase_transforms_correctly(input_value: str, expected: str) -> None:
    assert transform(input_value) == expected
```

### Pattern: Fixture

```python
from __future__ import annotations

import pytest

from myproject.config import Config


@pytest.fixture
def config() -> Config:
    """Provide a default test configuration."""
    return Config(
        database_url="sqlite:///test.db",
        log_level="DEBUG",
        debug=True,
    )


@pytest.fixture
def populated_db(config: Config) -> Database:
    """Provide a database with test data."""
    db = Database(config.database_url)
    db.insert({"name": "test", "value": 42})
    yield db
    db.cleanup()


def test_query_returns_data(populated_db: Database) -> None:
    result = populated_db.query("test")
    assert result.value == 42
```

### Pattern: Integration test

```python
import pytest

from myproject.core import fetch_and_process


@pytest.mark.integration
@pytest.mark.slow
def test_fetch_and_process_with_real_api() -> None:
    """Integration test that calls a real external API."""
    result = fetch_and_process("https://api.example.com/data")
    assert result is not None
```

### Pattern: Mocking

```python
from __future__ import annotations

from unittest.mock import patch

import pytest

from myproject.core import fetch_data


@patch("myproject.core.httpx.get")
def test_fetch_data_handles_timeout(mock_get: pytest.Mock) -> None:
    mock_get.side_effect = httpx.TimeoutException("request timed out")
    with pytest.raises(ExternalServiceError, match="timed out"):
        fetch_data("https://example.com")
```

## Coverage

### Rules

1. **Target meaningful coverage** — cover important paths, not trivial ones
2. **Don't chase percentages** — 80% coverage of important code is better than 99% of trivial code
3. **Exclude trivial files** from coverage: `__init__.py`, `__main__.py`, `conftest.py`
4. **Use `--cov-fail-under`** in CI to enforce minimum coverage

### pyproject.toml

```toml
[tool.coverage.run]
source = ["src/myproject"]
omit = [
    "src/myproject/__init__.py",
    "src/myproject/__main__.py",
    "tests/*",
]

[tool.coverage.report]
fail_under = 80
show_missing = true
exclude_also = [
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
    "@overload",
]
```

### Run with coverage

```bash
uv run pytest --cov --cov-report=term-missing
uv run pytest --cov --cov-report=html    # HTML report in htmlcov/
```

## Ruff (Linting and Formatting)

### Install

```bash
uv add --group dev ruff
```

### pyproject.toml config

```toml
[tool.ruff]
target-version = "py312"
line-length = 120
src = ["src"]

[tool.ruff.lint]
select = [
    "E",     # pycodestyle errors
    "W",     # pycodestyle warnings
    "F",     # pyflakes
    "I",     # isort
    "UP",    # pyupgrade
    "B",     # flake8-bugbear
    "SIM",   # flake8-simplify
    "TCH",   # flake8-type-checking
    "RUF",   # ruff-specific rules
]
ignore = []

[tool.ruff.lint.isort]
known-first-party = ["myproject"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

### Commands

```bash
uv run ruff check .                   # lint only
uv run ruff check . --fix             # lint and auto-fix
uv run ruff format .                  # format only
uv run ruff format --check .          # check formatting without changing
```

### Key rules to enforce

- **`I`** — enforce consistent import ordering (stdlib → third-party → local)
- **`UP`** — upgrade to modern Python syntax (PEP 585, PEP 604)
- **`B`** — catch common bugs (mutable default arguments, unused loops)
- **`SIM`** — simplify unnecessarily complex code
- **`TCH`** — move type-only imports under `if TYPE_CHECKING`
- **`F`** — catch undefined names, unused imports

## pyright (Type Checking)

### Install

```bash
uv add --group dev pyright
```

### pyproject.toml config

```toml
[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "strict"
include = ["src"]
exclude = ["tests"]
reportUnusedImport = "error"
reportUnusedVariable = "error"
reportPrivateUsage = "warning"
venvPath = "."
venv = ".venv"
```

### Commands

```bash
uv run pyright              # type check the project
uv run pyright --verifytypes  # verify type completeness for public API
```

### Strict mode requirements

Strict mode enforces:
- All parameters and return types must be annotated
- No `Any` types without explicit `ExplicitAny` override
- No untyped function definitions
- No untyped class attributes
- Report missing type stubs for third-party packages

## Quality Gate Checklist

Run all four gates before completing any Python work:

```bash
# Gate 1: Lint (zero errors)
uv run ruff check .

# Gate 2: Format (zero differences)
uv run ruff format --check .

# Gate 3: Type check (zero errors in strict mode)
uv run pyright

# Gate 4: Tests (all pass)
uv run pytest
```

### CI configuration

```yaml
# GitHub Actions example
name: quality
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync --frozen
      - run: uv run ruff check .
      - run: uv run ruff format --check .
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync --frozen
      - run: uv run pyright
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync --frozen
      - run: uv run pytest --cov
  lockfile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv lock --check
```

Key CI patterns:
- **`uv sync --frozen`** — install exactly what the lockfile says, don't resolve
- **`uv lock --check`** — verify lockfile matches pyproject.toml, no drift