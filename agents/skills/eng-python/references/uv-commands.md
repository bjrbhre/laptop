# uv Commands Reference

Complete reference for uv commands used in engineering Python projects.

## Project Management

### `uv init`

Create a new project.

```bash
uv init                        # create in current directory
uv init myproject              # create in new directory
uv init --name myproject       # set project name explicitly
uv init --python 3.12          # set Python version requirement
uv init --lib                  # create a library project
uv init --app                  # create an application project (default)
uv init --package              # create a package with src layout
```

### `uv add`

Add dependencies to the project. Updates `pyproject.toml` and `uv.lock`, installs into the project environment.

```bash
uv add requests                    # production dependency (latest compatible)
uv add "requests>=2.31"           # with version specifier
uv add --dev pytest ruff pyright  # dev dependencies
uv add --group lint ruff          # add to named dependency group
uv add --optional api httpx       # add as optional dependency
uv add --script myscript.py httpx # add to script inline metadata
```

### `uv remove`

Remove dependencies from the project.

```bash
uv remove requests
uv remove --dev pytest
uv remove --group lint ruff
```

### `uv run`

Run a command in the project environment. Creates or syncs the environment automatically.

```bash
uv run python main.py             # run Python script
uv run pytest                     # run test suite
uv run ruff check .               # run linter
uv run --with httpx python -c "import httpx"  # one-off extra dependency
uv run --isolated python app.py   # ignore project dependencies
uv run --python 3.11 python app.py  # override Python version
uv run --no-project python app.py # ignore project, use ambient env
```

### `uv sync`

Update the project environment to match the lockfile.

```bash
uv sync                           # sync all dependencies
uv sync --dev                     # include dev dependencies (default)
uv sync --no-dev                  # exclude dev dependencies
uv sync --only-group lint         # only install specific group
uv sync --frozen                  # don't update lockfile
uv sync --python 3.12             # sync with specific Python version
```

### `uv lock`

Update the lockfile without installing.

```bash
uv lock                           # update lockfile
uv lock --check                   # verify lockfile is up to date
uv lock --upgrade-package requests # upgrade specific package
uv lock --upgrade                 # upgrade all packages
```

### `uv export`

Export the lockfile to alternate formats.

```bash
uv export                         # export as requirements.txt
uv export --format pylock.toml    # export as PEP 751 pylock.toml
uv export --hash                  # include hashes
uv export --no-dev                # exclude dev dependencies
```

### `uv tree`

Display the dependency tree.

```bash
uv tree
uv tree --depth 1                 # limit depth
uv tree --invert                  # show what depends on each package
```

### `uv version`

Read or update the project version.

```bash
uv version                        # print current version
uv version patch                  # bump patch (1.0.0 -> 1.0.1)
uv version minor                  # bump minor (1.0.0 -> 1.1.0)
uv version major                  # bump major (1.0.0 -> 2.0.0)
uv version 2.3.4                  # set explicit version
```

## Python Version Management

### `uv python install`

Install Python versions.

```bash
uv python install 3.12            # latest 3.12 patch
uv python install 3.12.3          # exact version
uv python install 3.10 3.11 3.12  # multiple versions
uv python install pypy3.10         # PyPy
uv python install --default 3.12  # install + set as default
```

### `uv python pin`

Pin a Python version for the current project.

```bash
uv python pin 3.12                # pin in .python-version
uv python pin --global 3.12       # pin globally
```

### `uv python list`

List available Python versions.

```bash
uv python list                    # list installed versions
uv python list --all-versions     # list all downloadable versions
uv python list --only-installed   # only installed on system
```

### `uv python upgrade`

Upgrade managed Python installations to latest patch.

```bash
uv python upgrade 3.12            # upgrade 3.12 to latest patch
uv python upgrade                  # upgrade all managed versions
```

### `uv python find`

Find a Python interpreter.

```bash
uv python find 3.12               # find Python 3.12
uv python find --system 3.12      # only system installations
```

## Tool Management

### `uvx` / `uv tool run`

Run a tool in an ephemeral environment.

```bash
uvx ruff check .                  # run ruff without installing
uvx pycowsay "hello"              # run any package as tool
uvx --from httpx httpx            # specify package for command
uvx --python 3.11 ruff check .    # use specific Python version
```

### `uv tool install`

Install a tool globally.

```bash
uv tool install ruff
uv tool install ruff --python 3.12
uv tool install --force ruff      # reinstall/upgrade
```

### `uv tool list` / `uv tool upgrade` / `uv tool uninstall`

```bash
uv tool list                      # list installed tools
uv tool upgrade ruff               # upgrade a tool
uv tool upgrade --all             # upgrade all tools
uv tool uninstall ruff             # remove a tool
```

## Virtual Environments

### `uv venv`

Create a virtual environment.

```bash
uv venv                           # create .venv with project Python
uv venv --python 3.12             # specific version
uv venv .venv                     # explicit path
uv venv --seed                    # include pip and setuptools
```

## pip-compatible Interface

Use only for legacy workflows or non-project environments. Prefer project commands.

### `uv pip install` / `uv pip sync` / `uv pip compile`

```bash
uv pip install requests           # install into active venv
uv pip install -r requirements.txt
uv pip sync requirements.txt      # exact install from lockfile
uv pip compile requirements.in -o requirements.txt  # compile
uv pip compile --universal requirements.in  # cross-platform lock
uv pip list                       # list installed packages
uv pip show requests              # show package info
uv pip freeze                     # pip freeze format
```

## Build and Publish

### `uv build`

Build distributions.

```bash
uv build                          # build sdist and wheel
uv build --wheel                  # build wheel only
uv build --sdist                  # build sdist only
uv build --out-dir dist/          # output directory
```

### `uv publish`

Publish to a package index.

```bash
uv publish                        # publish to PyPI
uv publish --index testpypi       # publish to TestPyPI
uv publish --token $TOKEN         # with API token
```

## Cache Management

### `uv cache`

```bash
uv cache dir                      # show cache directory
uv cache clean                    # clear all caches
uv cache clean requests           # clear specific package cache
```

## Workspaces

### `uv workspace`

```bash
uv workspace list                 # list workspace members
uv workspace add --package subpkg # add member to workspace
uv workspace remove subpkg        # remove member
```

In workspace root `pyproject.toml`:

```toml
[tool.uv.workspace]
members = ["packages/*"]
```

In member `pyproject.toml`:

```toml
[tool.uv.sources]
mylib = { workspace = true }
```

## Global Flags

Useful across most commands:

| Flag | Purpose |
|------|---------|
| `--project <dir>` | Run against project in directory |
| `--directory <dir>` | Change working directory |
| `--python <ver>` | Override Python version |
| `--no-cache` | Bypass cache |
| `--offline` | No network access |
| `--verbose` / `-v` | Detailed output |
| `--quiet` / `-q` | Minimal output |
| `--no-config` | Ignore config files |
