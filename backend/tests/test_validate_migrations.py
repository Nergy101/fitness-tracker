"""Tests for scripts/validate_migrations.py (NER-316).

Covers:
  * false-positives: docstrings/comments that merely mention create_all/drop_all
  * true-positives: genuine create_all()/drop_all() calls in non-allowed files
  * ALLOWED_FILES exemptions and skip-dir behavior
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import validate_migrations as vm


@pytest.fixture(autouse=True)
def _isolate_backend_dir(tmp_path, monkeypatch):
    """Point the validator at a throwaway backend dir so tests don't scan the
    real codebase."""
    monkeypatch.setattr(vm, "BACKEND_DIR", tmp_path)
    monkeypatch.setattr(vm, "MIGRATIONS_DIR", tmp_path / "alembic" / "versions")
    (tmp_path / "alembic" / "versions").mkdir(parents=True)
    return tmp_path


def _write(tmp_path, name, content):
    p = tmp_path / name
    p.write_text(content)
    return p


def test_docstring_mention_of_create_all_is_not_a_violation(tmp_path):
    """Prose/docstrings mentioning create_all must not fail the scan (the NER-239
    regression that motivated the AST rewrite)."""
    _write(tmp_path, "health_check.py", (
        '"""In-memory/test DBs use create_all for a quick in-memory fallback."""\n'
        "def check():\n"
        '    """Nothing destructive here — just mentions drop_all in prose."""\n'
        "    return True\n"
    ))
    assert vm.check_no_destructive_patterns() == []


def test_comment_mention_of_create_all_is_not_a_violation(tmp_path):
    _write(tmp_path, "foo.py", (
        "# NB: legacy schema was built with create_all, migrate with Alembic.\n"
        "x = 1\n"
    ))
    assert vm.check_no_destructive_patterns() == []


def test_real_create_all_call_is_a_violation(tmp_path):
    _write(tmp_path, "bad_schema.py", (
        "from sqlalchemy import MetaData\n"
        "m = MetaData()\n"
        "m.create_all(bind=engine)\n"
    ))
    errors = vm.check_no_destructive_patterns()
    assert len(errors) == 1
    assert "bad_schema.py:3" in errors[0]


def test_real_drop_all_call_is_a_violation(tmp_path):
    _write(tmp_path, "bad_schema.py", (
        "metadata.drop_all()\n"
    ))
    errors = vm.check_no_destructive_patterns()
    assert len(errors) == 1
    assert "bad_schema.py:1" in errors[0]


def test_allowed_file_create_all_call_is_exempt(tmp_path):
    """create_all calls in ALLOWED_FILES (database.py, test_migrations.py, etc.)
    must not be flagged."""
    _write(tmp_path, "database.py", (
        "Base.metadata.create_all(bind=engine)  # guarded in-memory fallback\n"
    ))
    assert vm.check_no_destructive_patterns() == []


def test_syntax_error_file_is_skipped(tmp_path):
    _write(tmp_path, "broken.py", "def oops(:\n")
    assert vm.check_no_destructive_patterns() == []


def test_attribute_call_base_metadata_create_all_is_caught(tmp_path):
    _write(tmp_path, "unrelated.py", (
        "Base.metadata.create_all(bind=engine)\n"
    ))
    errors = vm.check_no_destructive_patterns()
    assert len(errors) == 1
    assert "unrelated.py:1" in errors[0]


# --- check_no_destructive_op_execute() (NER-317) ---

def _write_migration(tmp_path, name, content):
    versions = tmp_path / "alembic" / "versions"
    p = versions / name
    p.write_text(content)
    return p


def test_destructive_op_execute_drop_table_is_a_violation(tmp_path):
    _write_migration(tmp_path, "abc_drop.py", (
        "def upgrade():\n"
        '    op.execute("DROP TABLE IF EXISTS legacy_users")\n'
        "\n"
        "def downgrade():\n"
        "    pass\n"
    ))
    errors = vm.check_no_destructive_op_execute()
    assert len(errors) == 1
    assert "abc_drop.py:2" in errors[0]
    assert "DROP" in errors[0]


def test_destructive_op_execute_create_table_is_a_violation(tmp_path):
    _write_migration(tmp_path, "abc_create.py", (
        "def upgrade():\n"
        '    op.execute("CREATE TABLE foo (id INTEGER)")\n'
    ))
    errors = vm.check_no_destructive_op_execute()
    assert len(errors) == 1
    assert "abc_create.py:2" in errors[0]


def test_destructive_op_execute_truncate_and_delete_are_violations(tmp_path):
    _write_migration(tmp_path, "abc_data.py", (
        "def upgrade():\n"
        '    op.execute("TRUNCATE TABLE sessions")\n'
        '    op.execute("DELETE FROM weight_entries WHERE id = 1")\n'
    ))
    errors = vm.check_no_destructive_op_execute()
    # Two distinct lines, both flagged.
    assert len(errors) == 2


def test_benign_op_execute_create_index_and_drop_index_pass(tmp_path):
    """Reversible DDL (CREATE INDEX / DROP INDEX) must NOT be flagged."""
    _write_migration(tmp_path, "abc_benign.py", (
        "def upgrade():\n"
        '    op.execute("CREATE INDEX IF NOT EXISTS idx ON t (col)")\n'
        "def downgrade():\n"
        '    op.execute("DROP INDEX IF EXISTS idx")\n'
    ))
    assert vm.check_no_destructive_op_execute() == []


def test_benign_op_execute_update_with_where_passes(tmp_path):
    _write_migration(tmp_path, "abc_update.py", (
        "def upgrade():\n"
        '    op.execute("UPDATE exercises SET kcal = kcal * 1.1 WHERE id > 0")\n'
    ))
    assert vm.check_no_destructive_op_execute() == []


def test_op_execute_with_non_literal_arg_is_not_flagged(tmp_path):
    """Variable / f-string SQL args stay silent (conservative scan)."""
    _write_migration(tmp_path, "abc_var.py", (
        "sql = 'DROP TABLE foo'\n"
        "def upgrade():\n"
        "    op.execute(sql)\n"
    ))
    assert vm.check_no_destructive_op_execute() == []


def test_other_execute_methods_are_not_flagged(tmp_path):
    """Only `op.execute` is matched, not arbitrary `.execute` calls."""
    _write_migration(tmp_path, "abc_other.py", (
        "def upgrade():\n"
        '    conn.execute("DROP TABLE foo")\n'
    ))
    assert vm.check_no_destructive_op_execute() == []


def test_mention_in_docstring_comment_is_not_flagged(tmp_path):
    """Prose mentioning DROP TABLE must not be flagged."""
    _write_migration(tmp_path, "abc_prose.py", (
        "\"\"\"Note: we deliberately do NOT run DROP TABLE here.\"\"\"\n"
        "def upgrade():\n"
        "    pass\n"
    ))
    assert vm.check_no_destructive_op_execute() == []
