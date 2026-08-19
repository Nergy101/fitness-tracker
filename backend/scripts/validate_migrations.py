#!/usr/bin/env python3
"""Validate Alembic migrations: reversibility, no drop_all/create_all.

Checks:
  1. Every migration has both upgrade() and downgrade() defined
  2. No backend code uses drop_all() or create_all() for schema management
     (excludes database.py which has a guarded in-memory fallback)
  3. No migration uses destructive SQL via ``op.execute()`` (DROP/CREATE TABLE,
     TRUNCATE, DELETE FROM) — those silently destroy/rebuild data and bypass
     Alembic's reversible ops.

The destructive-pattern scan is AST-aware: it only flags actual calls to
``create_all`` / ``drop_all`` (e.g. ``Base.metadata.create_all(...)`` or a bare
``create_all(...)``), so docstrings, comments, and prose that merely *mention*
these tokens are not treated as violations. The ``op.execute()`` scan is
similarly conservative: it only flags the canonical ``op.execute(<string
literal>)`` form and stays silent for variable/f-string arguments and for
benign, reversible SQL (DROP INDEX, DROP COLUMN, UPDATE ... WHERE, etc.).
"""

import ast
import re
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = BACKEND_DIR / "alembic" / "versions"

# Files where create_all is allowed: guarded in-memory fallback (database.py,
# seed_fake_history.py) and the migration tests, which use create_all to
# simulate legacy pre-Alembic databases.
ALLOWED_FILES = {"database.py", "seed_fake_history.py", "test_migrations.py"}

# Destructive/schema-management call names we reject outside ALLOWED_FILES.
DESTRUCTIVE_CALLS = {"create_all", "drop_all"}

# Destructive SQL passed to op.execute() in migrations. These silently destroy
# or rebuild data and bypass Alembic's reversible ops. Deliberately NOT
# including DROP INDEX / DROP COLUMN / UPDATE ... WHERE — those are reversible
# via Alembic and legitimate.
DESTRUCTIVE_SQL_PATTERNS = [
    re.compile(r"\bDROP\s+TABLE\b", re.IGNORECASE),
    re.compile(r"\bCREATE\s+TABLE\b", re.IGNORECASE),
    re.compile(r"\bTRUNCATE\b", re.IGNORECASE),
    re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE),
]


def _called_function_name(call: ast.Call) -> str | None:
    """Return the function name invoked by ``call``, or None if not applicable.

    Handles both bare calls (``create_all(...)`` -> ``Name``) and attribute
    calls (``Base.metadata.create_all(...)`` -> ``Attribute`` with ``attr``).
    """
    func = call.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


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


def _find_destructive_calls(tree: ast.AST) -> list[int]:
    """Return line numbers of real create_all/drop_all calls in ``tree``."""
    lines = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = _called_function_name(node)
            if name in DESTRUCTIVE_CALLS:
                lines.append(node.lineno)
    return sorted(lines)


def check_no_destructive_patterns() -> list[str]:
    """Scan backend code for drop_all() / create_all() calls (AST-aware)."""
    errors = []
    skip_dirs = {"__pycache__", ".pytest_cache", "alembic", ".venv", "venv",
                 "site-packages", "node_modules"}

    for py_file in BACKEND_DIR.rglob("*.py"):
        if any(s in py_file.parts for s in skip_dirs):
            continue
        if py_file.name == "validate_migrations.py":
            continue
        if py_file.name in ALLOWED_FILES:
            continue

        try:
            tree = ast.parse(py_file.read_text())
        except (SyntaxError, OSError):
            continue

        for lineno in _find_destructive_calls(tree):
            errors.append(
                f"{py_file.relative_to(BACKEND_DIR)}:{lineno}: "
                f"found create_all()/drop_all() call — use Alembic migrations instead"
            )

    return errors


def _op_execute_sql(node: ast.Call) -> str | None:
    """Return the SQL string passed to an ``op.execute(...)`` call, or None.

    Only matches the canonical ``op.execute(<string literal>)`` form used in
    Alembic migrations. Non-literal arguments (variables, f-strings) return
    None — we stay conservative and only flag literal SQL.
    """
    func = node.func
    if not isinstance(func, ast.Attribute):
        return None
    if func.attr != "execute":
        return None
    value = func.value
    if not isinstance(value, ast.Name) or value.id != "op":
        return None
    if not node.args:
        return None
    first = node.args[0]
    if isinstance(first, ast.Constant) and isinstance(first.value, str):
        return first.value
    return None


def _find_destructive_op_execute(tree: ast.AST) -> list[int]:
    """Return line numbers of op.execute() calls with destructive DDL/DML SQL."""
    lines = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        sql = _op_execute_sql(node)
        if sql is None:
            continue
        for pat in DESTRUCTIVE_SQL_PATTERNS:
            if pat.search(sql):
                lines.append(node.lineno)
                break
    return sorted(lines)


def check_no_destructive_op_execute() -> list[str]:
    """Scan migration files for destructive SQL passed to op.execute()."""
    errors = []
    migration_files = sorted(MIGRATIONS_DIR.glob("*.py"))
    for mf in migration_files:
        if mf.name == "__init__.py":
            continue
        try:
            tree = ast.parse(mf.read_text())
        except (SyntaxError, OSError):
            continue
        for lineno in _find_destructive_op_execute(tree):
            errors.append(
                f"{mf.name}:{lineno}: destructive SQL in op.execute() "
                f"(DROP/CREATE TABLE, TRUNCATE, DELETE FROM) — "
                f"use Alembic reversible ops instead"
            )
    return errors


def main() -> int:
    errors = []
    errors.extend(check_migration_reversibility())
    errors.extend(check_no_destructive_patterns())
    errors.extend(check_no_destructive_op_execute())

    if errors:
        print(f"❌ Migration validation failed ({len(errors)} issue(s)):")
        for e in errors:
            print(f"  • {e}")
        return 1

    print("✅ All migration checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
