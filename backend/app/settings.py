"""TOML-based settings loader.

Looks for a settings.toml file (default: ./settings.toml, overridable via
FITNESS_SETTINGS_PATH env var). If the file doesn't exist, generates one
with a random password and prints it to the console.
"""

import os
import string
import secrets
import tomllib
from typing import Any
from pathlib import Path

SETTINGS_PATH = Path(os.getenv("FITNESS_SETTINGS_PATH", "./settings.toml"))


def _generate_password(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _generate_default_toml(password: str) -> str:
    return f"""# FitnessTracker server settings.
# Auto-generated — change the password below to something you'll remember.
[auth]
password = "{password}"

[app]
name = "FitnessTracker"
"""


def _ensure_settings() -> bool:
    """Create a default settings.toml if missing. Returns True if created."""
    if SETTINGS_PATH.exists():
        return False
    password = _generate_password()
    SETTINGS_PATH.write_text(_generate_default_toml(password))
    print(f"🔑 Generated {SETTINGS_PATH} with random password: {password}")
    print(f"   Change it in {SETTINGS_PATH} and restart the server.")
    return True


def load_settings() -> dict[str, Any]:
    """Load and return the settings dict."""
    _ensure_settings()
    with open(SETTINGS_PATH, "rb") as f:
        return tomllib.load(f)


# Eagerly load on import so settings are available at startup.
settings = load_settings()
