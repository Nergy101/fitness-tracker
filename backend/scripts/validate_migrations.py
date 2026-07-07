#!/usr/bin/env python3
"""Validate Alembic migrations: reversibility, no drop_all/create_all.

Checks:
  1. Every migration has both upgrade() and downgrade() defined
  2. No backend code uses drop_all() or create_all() for schema management
     (excludes database.py which has a guarded in-memory fallback)
"""

import ast
import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = BACKEND_DIR / "alembic" / "versions"

# Files where create_all is allowed (guarded in-memory fallback for tests)
ALLOWED_FILES = {"database.py", "seed_fake_history.py"}


def check_migration_reversibility() -> list[str]:
    """Verify every migration file has both upgrade() and downgrade()."""
    errors = []
    migration_files = sorted(MIGRATIONS_DIR.glob("*.py"))
    if not migration_files:
        errors.append("No migration files found in alembic/versions/")
        return errors

    for mf in migration_files:
        if mf.name == "__init__.py":
            continue
        content = mf.read_text()
        tree = ast.parse(content)
        funcs = {node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)}
        if "upgrade" not in funcs:
            errors.append(f"{mf.name}: missing upgrade() function")
        if "downgrade" not in funcs:
            errors.append(f"{mf.name}: missing downgrade() function")

    return errors


def check_no_destructive_patterns() -> list[str]:
    """Scan backend code for drop_all() / create_all() calls."""
    errors = []
    patterns = ["drop_all", "create_all"]
    skip_dirs = {"__pycache__", ".pytest_cache", "alembic", ".venv", "venv",
                 "site-packages", "node_modules"}

    for py_file in BACKEND_DIR.rglob("*.py"):
        if any(s in py_file.parts for s in skip_dirs):
            continue
        if py_file.name == "validate_migrations.py":
            continue

        try:
            content = py_file.read_text()
        except Exception:
            continue

        for pattern in patterns:
            if pattern not in content:
                continue

            if py_file.name in ALLOWED_FILES:
                continue

            for i, line in enumerate(content.splitlines(), 1):
                if pattern in line and not line.strip().startswith("#"):
                    errors.append(
                        f"{py_file.relative_to(BACKEND_DIR)}:{i}: "
                        f"found '{pattern}' — use Alembic migrations instead"
                    )
                    break  # one report per file per pattern

    return errors


def main() -> int:
    errors = []
    errors.extend(check_migration_reversibility())
    errors.extend(check_no_destructive_patterns())

    if errors:
        print(f"❌ Migration validation failed ({len(errors)} issue(s)):")
        for e in errors:
            print(f"  • {e}")
        return 1

    print("✅ All migration checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
