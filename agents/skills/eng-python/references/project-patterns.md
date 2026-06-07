# Project Patterns

Scaffolding patterns for different types of Python projects managed with uv.

## Application Project

For deployable services, CLI apps, or any project where the output is a running system.

### Scaffolding

```bash
uv init --app --name myapp --python 3.12
cd myapp
uv add --dev pytest ruff pyright pytest-cov
```

### Structure

```
myapp/
├── pyproject.toml
├── uv.lock
├── .python-version
├── src/
│   └── myapp/
│       ├── __init__.py       # version, public API
│       ├── __main__.py       # entry point for `python -m myapp`
│       ├── cli.py            # CLI argument parsing
│       ├── core.py           # main business logic
│       ├── config.py         # configuration loading
│       └── errors.py         # custom exception hierarchy
│       └── log.py            # logging setup
└── tests/
    ├── conftest.py           # fixtures, shared config
    ├── test_cli.py
    ├── test_core.py
    └── test_config.py
```

### Key pyproject.toml settings

```toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []

[project.scripts]
myapp = "myapp.cli:main"

[dependency-groups]
dev = ["pytest>=8", "pytest-cov>=6", "ruff>=0.11", "pyright>=1.1"]

[tool.ruff]
target-version = "py312"
line-length = 120

[tool.ruff.lint]
select = ["E", "W", "F", "I", "UP", "B", "SIM", "TCH", "RUF"]

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "strict"
```

### __main__.py pattern

```python
"""Entry point for python -m myapp."""
from myapp.cli import main

if __name__ == "__main__":
    main()
```

### __init__.py pattern

```python
"""myapp — application description."""
__version__ = "0.1.0"
```

### config.py pattern

```python
"""Configuration management using environment variables with defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    """Application configuration loaded from environment."""

    log_level: str = os.getenv("MYAPP_LOG_LEVEL", "INFO")
    database_url: str = os.getenv("MYAPP_DATABASE_URL", "sqlite:///myapp.db")
    debug: bool = os.getenv("MYAPP_DEBUG", "false").lower() == "true"


def load_config() -> Config:
    """Load configuration from environment variables."""
    return Config()
```

### errors.py pattern

```python
"""Custom exception hierarchy for myapp."""
from __future__ import annotations


class AppError(Exception):
    """Base exception for all application errors."""

    def __init__(self, message: str, *, code: str = "UNKNOWN") -> None:
        self.code = code
        super().__init__(message)


class ValidationError(AppError):
    """Input validation failed."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="VALIDATION")


class NotFoundError(AppError):
    """Requested resource not found."""

    def __init__(self, resource: str, identifier: str) -> None:
        super().__init__(f"{resource} '{identifier}' not found", code="NOT_FOUND")
```

### log.py pattern

```python
"""Structured logging setup for myapp."""
from __future__ import annotations

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    """Configure application logging."""
    logging.basicConfig(
        level=logging.getLevelName(level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )


def get_logger(name: str) -> logging.Logger:
    """Get a named logger."""
    return logging.getLogger(name)
```

## Library Project

For packages published to PyPI or shared as dependencies.

### Scaffolding

```bash
uv init --lib --name mylib --python 3.12
cd mylib
uv add --dev pytest ruff pyright pytest-cov
```

### Structure

```
mylib/
├── pyproject.toml
├── uv.lock
├── .python-version
├── src/
│   └── mylib/
│       ├── __init__.py
│       ├── py.typed          # PEP 561 marker — signals type info available
│       ├── _core.py          # internal implementation
│       └── public.py         # public API surface
└── tests/
    ├── conftest.py
    └── test_public.py
```

### Key pyproject.toml differences

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mylib"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []

# Expose only the public API
[tool.hatch.build.targets.wheel]
packages = ["src/mylib"]
```

The `py.typed` marker file must exist in the package root (`src/mylib/`) for PEP 561 compliance — this tells type checkers that inline type hints are available.

### __init__.py pattern for library

```python
"""mylib — library description."""
from mylib.public import *  # noqa: F403
from mylib.public import __all__  # explicit re-export for type checkers

__version__ = "0.1.0"
```

### public.py pattern

```python
"""Public API surface for mylib."""
from __future__ import annotations

from mylib._core import process, transform

__all__ = ["process", "transform"]
```

## Workspace Project (Monorepo)

For multi-package projects with shared dependencies.

### Scaffolding

```bash
uv init --name myworkspace --python 3.12
cd myworkspace

# Create member packages
uv init --package packages/mylib
uv init --package packages/myapp

# Wire dependencies
cd packages/myapp
uv add --package mylib  # reference workspace member
```

### Structure

```
myworkspace/
├── pyproject.toml            # workspace root (no [project] section)
├── uv.lock                   # single unified lockfile
├── .python-version
├── packages/
│   ├── mylib/
│   │   ├── pyproject.toml
│   │   └── src/mylib/
│   └── myapp/
│       ├── pyproject.toml
│       └── src/myapp/
└── tests/
```

### Root pyproject.toml

```toml
[tool.uv.workspace]
members = ["packages/*"]

[dependency-groups]
dev = ["pytest>=8", "ruff>=0.11", "pyright>=1.1"]
```

### Member pyproject.toml

```toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["mylib"]

[tool.uv.sources]
mylib = { workspace = true }
```

## CLI Application Project

For command-line tools with argument parsing.

### Additional scaffolding

```bash
uv init --name mycli --python 3.12
cd mycli
uv add click           # or use argparse from stdlib
uv add --dev pytest ruff pyright pytest-cov
```

### CLI pattern with Click

```python
"""CLI entry point for mycli."""
from __future__ import annotations

import click

from mycli.core import process


@click.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.option("--output", "-o", type=click.Path(), help="Output file path")
def main(input_file: str, verbose: bool, output: str | None) -> None:
    """Process INPUT_FILE and output results."""
    result = process(input_file, verbose=verbose)
    if output:
        click.echo(f"Writing to {output}")
        # write output
    else:
        click.echo(result)


if __name__ == "__main__":
    main()
```

### CLI pattern with argparse (no external dependency)

```python
"""CLI entry point for mycli using argparse."""
from __future__ import annotations

import argparse
import sys

from mycli.core import process


def main(argv: list[str] | None = None) -> None:
    """Entry point for the CLI."""
    parser = argparse.ArgumentParser(description="Process input files")
    parser.add_argument("input_file", help="Path to input file")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("-o", "--output", help="Output file path")

    args = parser.parse_args(argv)
    result = process(args.input_file, verbose=args.verbose)

    if args.output:
        with open(args.output, "w") as f:
            f.write(result)
    else:
        print(result)


if __name__ == "__main__":
    main()
```

## Adding Dependencies Correctly

### Version specifiers

Always specify a minimum version. Avoid unbounded upper bounds unless intentional.

```bash
# Good: minimum version with reasonable upper bound
uv add "requests>=2.31,<3"

# Good: minimum version only (uv lockfile provides reproducibility)
uv add "requests>=2.31"

# Bad: no version constraint (floating, unpredictable)
uv add requests

# Bad: exact pin in pyproject.toml (too rigid for published packages)
uv add "requests==2.31.0"
```

### Dependency groups vs optional dependencies

```bash
# Dev-only tools — not included in published package
uv add --group dev pytest ruff pyright

# Optional features — included in published package but not default install
uv add --optional api httpx

# Production — always included
uv add requests
```

In pyproject.toml:

```toml
[project]
dependencies = ["requests>=2.31"]

[project.optional-dependencies]
api = ["httpx>=0.27"]

[dependency-groups]
dev = ["pytest>=8", "ruff>=0.11", "pyright>=1.1"]
```

Install optional dependency:

```bash
uv sync --extra api       # install with optional feature
uv add --group dev pytest  # add to dev dependency group
```