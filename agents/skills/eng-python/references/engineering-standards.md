# Engineering Standards

Python engineering standards for production-grade code. All standards assume uv as the toolchain.

## Type Hints

### Rules

1. **All function signatures** must have type hints for parameters and return types
2. **Use `from __future__ import annotations`** in every file (PEP 604 syntax, postponed evaluation)
3. **Use `pyright` strict mode** — zero errors required
4. **Prefer `str | None`** over `Optional[str]` (PEP 604 style)
5. **Prefer `list[str]`** over `List[str]` (PEP 585 style)
6. **Use `TypedDict`** for structured dicts, not `dict[str, Any]`
7. **Use `Protocol`** for structural subtyping over abstract base classes when possible
8. **Use `Final`** for constants that should not be reassigned

### Patterns

```python
from __future__ import annotations

from typing import Final, Protocol


# Constants
DEFAULT_TIMEOUT: Final[int] = 30

# Function with full annotations
def fetch_data(url: str, *, timeout: int = DEFAULT_TIMEOUT) -> dict[str, str]:
    ...

# TypedDict for structured data
class UserInfo(TypedDict):
    name: str
    email: str
    active: bool

# Protocol for structural subtyping
class Fetcher(Protocol):
    def fetch(self, url: str) -> str: ...

# Modern union syntax
def find_user(id: str) -> User | None:
    ...
```

### pyright configuration

```toml
[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "strict"
reportUnusedImport = "error"
reportUnusedVariable = "error"
reportPrivateUsage = "warning"
```

## Error Handling

### Rules

1. **Define custom exception hierarchy** — never raise bare `Exception` or `ValueError` for domain errors
2. **Use specific exception types** — callers need to catch precisely
3. **Include context in error messages** — what was being attempted, what went wrong
4. **Don't swallow exceptions** — unless explicitly documented with a reason
5. **Use `raise ... from`** for exception chaining
6. **Fail fast** — validate early, raise immediately

### Pattern: Exception hierarchy

```python
from __future__ import annotations


class AppError(Exception):
    """Base for all application errors."""

    def __init__(self, message: str, *, code: str = "UNKNOWN") -> None:
        self.code = code
        super().__init__(message)


class ValidationError(AppError):
    """Input validation failed."""

    def __init__(self, message: str, field: str = "") -> None:
        self.field = field
        detail = f"Field '{field}': {message}" if field else message
        super().__init__(detail, code="VALIDATION")


class NotFoundError(AppError):
    """Resource not found."""

    def __init__(self, resource: str, identifier: str) -> None:
        super().__init__(f"{resource} '{identifier}' not found", code="NOT_FOUND")


class ExternalServiceError(AppError):
    """External service call failed."""

    def __init__(self, service: str, message: str) -> None:
        super().__init__(f"{service}: {message}", code="EXTERNAL_SERVICE")
```

### Pattern: Validation with early return

```python
def process_config(config: Config) -> Result:
    """Process configuration. Raises ValidationError on bad input."""
    if not config.name:
        raise ValidationError("Name is required", field="name")
    if config.timeout < 0:
        raise ValidationError("Timeout must be non-negative", field="timeout")
    # Happy path continues here
    ...
```

### Pattern: Exception chaining

```python
def load_config(path: str) -> Config:
    try:
        data = read_file(path)
        return Config.from_dict(data)
    except OSError as e:
        raise ExternalServiceError("filesystem", f"Cannot read {path}") from e
    except (KeyError, ValueError) as e:
        raise ValidationError(f"Invalid config in {path}") from e
```

## Logging

### Rules

1. **Use `logging` module** — never `print()` for application output
2. **Use structured, consistent format** — include timestamp, level, logger name
3. **Log at appropriate level**: DEBUG (tracing), INFO (progress), WARNING (degraded), ERROR (failed operation), CRITICAL (system down)
4. **Include context** — log relevant identifiers, not just "operation failed"
5. **Don't log sensitive data** — no passwords, tokens, PII
6. **Use `logger.exception()`** in exception handlers to capture tracebacks

### Pattern: Logging setup

```python
from __future__ import annotations

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    """Configure root logger for the application."""
    logging.basicConfig(
        level=logging.getLevelName(level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stderr,
    )


def get_logger(name: str) -> logging.Logger:
    """Get a named child logger."""
    return logging.getLogger(name)
```

### Pattern: Usage in modules

```python
from myapp.log import get_logger

logger = get_logger(__name__)


def process(data: str) -> None:
    logger.info("Processing data: len=%d", len(data))
    try:
        result = transform(data)
        logger.debug("Transform complete: result=%s", result)
    except ValidationError:
        logger.exception("Validation failed for data")
        raise
```

## Configuration

### Rules

1. **Environment variables for deployment config** — use `os.getenv()` with defaults
2. **Dataclasses for configuration objects** — immutable (`frozen=True`), validated at construction
3. **Prefix env vars** with app name — `MYAPP_DATABASE_URL`, not `DATABASE_URL`
4. **Never hardcode secrets** — always from environment
5. **Provide sensible defaults** — app should run without any env vars set

### Pattern: Config dataclass

```python
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    """Application configuration from environment."""

    database_url: str = os.getenv("MYAPP_DATABASE_URL", "sqlite:///myapp.db")
    log_level: str = os.getenv("MYAPP_LOG_LEVEL", "INFO")
    debug: bool = os.getenv("MYAPP_DEBUG", "false").lower() == "true"
    max_retries: int = int(os.getenv("MYAPP_MAX_RETRIES", "3"))
```

## Code Organization

### Rules

1. **One class per file** for non-trivial classes (files can have multiple small helpers)
2. **`__init__.py`** only re-exports public API — no implementation logic
3. **Private modules** prefixed with `_` — `_internal.py`, `_helpers.py`
4. **Constants at module top** — `UPPER_SNAKE_CASE`, type-annotated with `Final`
5. **Imports ordered**: stdlib → third-party → local, separated by blank lines
6. **Use absolute imports** from the project root: `from myapp.core import process`

### Import ordering (enforced by ruff)

```python
from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx
from rich.console import Console

from myapp.config import Config
from myapp.errors import AppError
```

## Dependency Management

### Rules

1. **Always specify minimum versions** in `pyproject.toml`: `"requests>=2.31"`
2. **Let `uv.lock` handle exact pins** — the lockfile provides reproducibility
3. **Don't over-pin** — avoid `==` pins in `pyproject.toml` unless required for API compat
4. **Declare dev dependencies in `[dependency-groups]`** — not in `[project.optional-dependencies]`
5. **Use `uv add`** — never manually edit dependencies without running `uv lock` after
6. **Commit `uv.lock`** — every CI run and deployment must use the lockfile
7. **Run `uv lock --check`** in CI — detect drift

## Security

### Rules

1. **Never commit secrets** — use environment variables or secret managers
2. **Pin dev tool versions** — `ruff>=0.11` is fine, but `mypy` exact pins prevent surprise breakage
3. **Run `uv audit`** — check for known vulnerabilities in dependencies
4. **Prefer `uv pip compile`** over raw `requirements.txt` for deployment lockfiles
5. **Use `--hash`** when exporting for deployment: `uv export --hash`

## Naming Conventions

| Element | Style | Example |
|---------|-------|---------|
| Modules | `lowercase` with underscores | `data_processing.py` |
| Classes | `PascalCase` | `HttpRequest` |
| Functions | `lowercase` with underscores | `process_data` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Private members | Leading underscore | `_internal_process` |
| Type variables | `PascalCase` | `T`, `TResponse` |
| Protocols | `PascalCase` + descriptive | `Closeable`, `DataReader` |
| TypedDict | `PascalCase` | `UserInfo`, `ApiResponse` |
