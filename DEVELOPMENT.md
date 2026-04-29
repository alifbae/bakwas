# Development Guide

## Setting Up Development Environment

### Install Development Dependencies

```bash
pip install -r requirements-dev.txt
```

This installs:

- **pre-commit** - Git hook framework
- **black** - Python code formatter
- **flake8** - Python linter
- **isort** - Python import sorter

### Initialize Pre-commit Hooks

```bash
pre-commit install
```

This sets up Git hooks that will automatically run before each commit.

## Code Quality Tools

### Automatic Formatting (Pre-commit Hooks)

Pre-commit hooks will automatically run when you commit. They will:

1. **Format Python code** with Black
2. **Sort Python imports** with isort
3. **Lint Python code** with Flake8
4. **Format JS/CSS/HTML** with Prettier
5. **Check file issues** (trailing whitespace, file endings, etc.)

### Manual Checks

Run pre-commit on all files:

```bash
pre-commit run --all-files
```

Run pre-commit on staged files only:

```bash
pre-commit run
```

Run specific hooks:

```bash
pre-commit run black --all-files
pre-commit run prettier --all-files
```

### Python Formatting

Format Python files manually:

```bash
black .
```

Check without making changes:

```bash
black --check .
```

### Python Import Sorting

Sort imports manually:

```bash
isort .
```

Check without making changes:

```bash
isort --check .
```

### Python Linting

Lint Python files:

```bash
flake8 src/ run.py
```

### JavaScript/CSS/HTML Formatting

Format with Prettier manually:

```bash
npx prettier --write "**/*.{js,css,html,json,md}"
```

Check without making changes:

```bash
npx prettier --check "**/*.{js,css,html,json,md}"
```

## Configuration Files

- **`.pre-commit-config.yaml`** - Pre-commit hooks configuration
- **`.prettierrc`** - Prettier formatting rules
- **`.prettierignore`** - Files to exclude from Prettier
- **`requirements-dev.txt`** - Development dependencies

## Code Style Guidelines

### Python

- Line length: 100 characters (Black default)
- Use Black for formatting
- Sort imports with isort (Black-compatible profile)
- Follow PEP 8 (enforced by Flake8)

### JavaScript

- 2 spaces indentation
- Semicolons required
- Double quotes for strings
- Line length: 100 characters

### CSS

- 2 spaces indentation
- Follow Prettier defaults

### HTML

- 2 spaces indentation
- Follow Prettier defaults

## Skipping Pre-commit Hooks

If you need to skip pre-commit hooks (not recommended):

```bash
git commit --no-verify
```

## Updating Hooks

Update pre-commit hooks to latest versions:

```bash
pre-commit autoupdate
```

## Troubleshooting

### Pre-commit failing on commit

If pre-commit modifies files:

1. The files will be auto-formatted
2. Review the changes
3. Stage the changes: `git add .`
4. Commit again

### Clear pre-commit cache

```bash
pre-commit clean
```

### Reinstall pre-commit hooks

```bash
pre-commit uninstall
pre-commit install
```
