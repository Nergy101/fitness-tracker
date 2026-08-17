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
