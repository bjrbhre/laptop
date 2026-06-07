# Script Patterns

Patterns for single-file Python scripts with inline dependency management via uv.

## PEP 723 Inline Script Metadata

uv supports PEP 723 inline script metadata — declare dependencies directly in the script file.

### Creating a script with dependencies

```bash
uv add --script myscript.py requests httpx
```

This adds a metadata block to the script:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "requests>=2.31",
#     "httpx>=0.27",
# ]
# ///

import requests
import httpx


def main() -> None:
    """Fetch data from two sources."""
    r1 = requests.get("https://example.com")
    r2 = httpx.get("https://example.org")
    print(r1.status_code, r2.status_code)


if __name__ == "__main__":
    main()
```

### Running a script

```bash
uv run myscript.py                # run with inline metadata
uv run --python 3.11 myscript.py  # override Python version
```

uv automatically creates an isolated virtual environment with only the declared dependencies.

### Adding more dependencies later

```bash
uv add --script myscript.py rich  # add rich to existing script
uv remove --script myscript.py httpx  # remove a dependency
```

## Script Templates

### HTTP client script

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "httpx>=0.27",
# ]
# ///

from __future__ import annotations

import httpx


def fetch(url: str, *, timeout: float = 30.0) -> str:
    """Fetch URL content with error handling."""
    try:
        response = httpx.get(url, timeout=timeout, follow_redirects=True)
        response.raise_for_status()
        return response.text
    except httpx.HTTPStatusError as e:
        print(f"HTTP error {e.response.status_code} for {url}")
        raise
    except httpx.RequestError as e:
        print(f"Request error for {url}: {e}")
        raise


def main() -> None:
    """Entry point."""
    content = fetch("https://example.com")
    print(content[:200])


if __name__ == "__main__":
    main()
```

### Data processing script

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "polars>=1.0",
# ]
# ///

from __future__ import annotations

import polars as pl


def process_csv(path: str) -> pl.DataFrame:
    """Read and transform a CSV file."""
    df = pl.read_csv(path)
    return df.filter(pl.col("value") > 0).sort("date")


def main() -> None:
    """Entry point."""
    df = process_csv("data.csv")
    print(df.describe())


if __name__ == "__main__":
    main()
```

### CLI script with rich output

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "rich>=13.0",
#     "click>=8.1",
# ]
# ///

from __future__ import annotations

import click
from rich.console import Console
from rich.table import Table

console = Console()


@click.command()
@click.argument("name")
@click.option("--count", "-n", default=1, help="Number of greetings")
def main(name: str, count: int) -> None:
    """Greet someone with style."""
    table = Table(title="Greetings")
    table.add_column("#", style="dim")
    table.add_column("Message")
    for i in range(count):
        table.add_row(str(i + 1), f"Hello, {name}!")
    console.print(table)


if __name__ == "__main__":
    main()
```

### Script with configurable Python version

```python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pydantic>=2.0",
# ]
# ///

from __future__ import annotations

from pydantic import BaseModel


class Item(BaseModel):
    """A data item with validation."""
    name: str
    value: float
    active: bool = True


def main() -> None:
    """Parse and display items."""
    raw = {"name": "example", "value": 42.5}
    item = Item.model_validate(raw)
    print(item.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
```

## One-off Execution Patterns

No script file needed — run Python code with temporary dependencies.

### Single command

```bash
uv run --with httpx --with rich python -c "
import httpx
from rich import print
resp = httpx.get('https://example.com')
print(f'Status: {resp.status_code}')
"
```

### Run a remote script

```bash
uv run https://example.com/script.py
```

### Run a specific package as tool

```bash
uvx ruff check .        # run ruff without installing
uvx black --check .     # run black without installing
uvx mypy .              # run mypy without installing
```

## Script Best Practices

1. **Always include `requires-python`** in the inline metadata block
2. **Pin minimum versions** for dependencies (e.g., `"requests>=2.31"`)
3. **Use `if __name__ == "__main__"`** guard for entry point
4. **Define a `main()` function** — don't put logic at module level
5. **Use `from __future__ import annotations`** for PEP 604 union syntax on Python 3.10+
6. **Handle errors explicitly** — don't let scripts fail silently
7. **Keep scripts focused** — one script, one responsibility
8. **Use `uv run`** — never `python` directly; uv ensures the right environment

## Converting Scripts to Projects

When a script grows beyond a single file:

1. Create a project: `uv init --name myproject`
2. Move script logic into `src/myproject/core.py`
3. Add script dependencies to project: `uv add <deps>`
4. Add entry point in `pyproject.toml`:
   ```toml
   [project.scripts]
   myproject = "myproject.cli:main"
   ```
5. Delete the script file and inline metadata
6. Run `uv sync` and verify with `uv run myproject`
