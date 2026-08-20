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


# --- check_single_head() (NER-320) ---

def _write_revision_migration(tmp_path, name, revision, down_revision=None):
    content = f"revision: str = '{revision}'\n"
    if down_revision is not None:
        content += f"down_revision: Union[str, None] = '{down_revision}'\n"
    content += "\ndef upgrade() -> None:\n    pass\n\n\ndef downgrade() -> None:\n    pass\n"
    _write_migration(tmp_path, name, content)


def test_single_head_chain_passes(tmp_path):
    """A linear chain (one head, no fork) must not be flagged."""
    _write_revision_migration(tmp_path, "a_initial.py", "aaaa", None)
    _write_revision_migration(tmp_path, "b_next.py", "bbbb", "aaaa")
    _write_revision_migration(tmp_path, "c_head.py", "cccc", "bbbb")
    assert vm.check_single_head() == []


def test_forked_down_revision_is_a_violation(tmp_path):
    """Two migrations sharing the same down_revision fork the chain → flagged."""
    _write_revision_migration(tmp_path, "a_initial.py", "aaaa", None)
    _write_revision_migration(tmp_path, "b_left.py", "bbbb", "aaaa")
    _write_revision_migration(tmp_path, "c_right.py", "cccc", "aaaa")
    errors = vm.check_single_head()
    assert len(errors) == 1
    assert "multiple Alembic heads" in errors[0]
    assert "bbbb" in errors[0] and "cccc" in errors[0]


def test_duplicate_revision_is_a_violation(tmp_path):
    """A duplicated revision id must be flagged."""
    _write_revision_migration(tmp_path, "a_one.py", "aaaa", None)
    _write_revision_migration(tmp_path, "b_two.py", "aaaa", "ffff")
    errors = vm.check_single_head()
    assert any("duplicated" in e and "aaaa" in e for e in errors)


def test_dangling_down_revision_is_a_violation(tmp_path):
    """A down_revision pointing at an undeclared revision must be flagged."""
    _write_revision_migration(tmp_path, "a_initial.py", "aaaa", None)
    _write_revision_migration(tmp_path, "b_orphan.py", "bbbb", "zzzz")
    errors = vm.check_single_head()
    assert any("not declared" in e and "zzzz" in e for e in errors)


def test_initial_migration_no_down_revision_is_ok(tmp_path):
    """A lone initial migration (no down_revision) is a valid single head."""
    _write_revision_migration(tmp_path, "a_initial.py", "aaaa", None)
    assert vm.check_single_head() == []


def test_annotated_assignment_form_is_parsed(tmp_path):
    """The `revision: str = '...'` annotated form (as Alembic emits) parses."""
    versions = tmp_path / "alembic" / "versions"
    (versions / "a_initial.py").write_text(
        "from typing import Sequence, Union\n\n"
        "revision: str = 'aaaa'\n"
        "down_revision: Union[str, None] = None\n"
        "branch_labels: Union[str, Sequence[str], None] = None\n"
        "\n\ndef upgrade() -> None:\n    pass\n\n\ndef downgrade() -> None:\n    pass\n"
    )
    assert vm.check_single_head() == []
