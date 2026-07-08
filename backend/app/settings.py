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

[notifications]
private_key = ""
public_key = ""
subject = "mailto:cdijk4@gmail.com"

[backup]
path = "/backups"
"""


def _ensure_settings() -> bool:
    """Create a default settings.toml if missing. Returns True if created."""
    if SETTINGS_PATH.exists():
        return False
    password = _generate_password()
    SETTINGS_PATH.write_text(_generate_default_toml(password))
    print(f"Generated {SETTINGS_PATH} with random password: {password}")
    print(f"Change it in {SETTINGS_PATH} and restart the server.")
    return True


def load_settings() -> dict[str, Any]:
    """Load and return the settings dict."""
    _ensure_settings()
    with open(SETTINGS_PATH, "rb") as f:
        return tomllib.load(f)


# Eagerly load on import so settings are available at startup.
settings = load_settings()

# Allow overriding password via env var (useful for tests / Docker).
ENV_PASSWORD = os.getenv("FITNESS_PASSWORD")
if ENV_PASSWORD:
    settings.setdefault("auth", {})["password"] = ENV_PASSWORD
    print("Using FITNESS_PASSWORD env var (overriding settings.toml)")


def save_settings() -> None:
    """Persist settings back to settings.toml."""
    lines = []
    # Preserve any non-section comments at top
    if SETTINGS_PATH.exists():
        with open(SETTINGS_PATH) as f:
            for line in f:
                if line.startswith("[") and "=" not in line:
                    break
                if line.startswith("#"):
                    lines.append(line.rstrip())
    lines.append("")
    for section, values in settings.items():
        lines.append(f"[{section}]")
        for key, value in values.items():
            if isinstance(value, str):
                lines.append(f'{key} = "{value}"')
            else:
                lines.append(f"{key} = {value}")
        lines.append("")
    SETTINGS_PATH.write_text("\n".join(lines) + "\n")


def get_or_create_vapid() -> dict[str, str]:
    """Get existing VAPID keys or generate new ones using ecdsa.

    Returns dict with private_key, public_key, subject.
    Keys are saved to settings.toml if newly generated.
    """
    notif = settings.setdefault("notifications", {})
    private_key = notif.get("private_key", "")
    public_key = notif.get("public_key", "")
    subject = notif.get("subject", "mailto:cdijk4@gmail.com")

    if private_key and public_key:
        return {"private_key": private_key, "public_key": public_key, "subject": subject}

    # Generate new VAPID keys using py_vapid
    from py_vapid import Vapid
    from base64 import urlsafe_b64encode
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    v = Vapid()
    v.generate_keys()

    pub_raw = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    priv_raw = v.private_key.private_numbers().private_value.to_bytes(32, "big")

    notif["private_key"] = urlsafe_b64encode(priv_raw).rstrip(b"=").decode()
    notif["public_key"] = urlsafe_b64encode(pub_raw).rstrip(b"=").decode()
    notif["subject"] = subject

    save_settings()
    print(f"Generated VAPID keys and saved to {SETTINGS_PATH}")

    return {"private_key": notif["private_key"], "public_key": notif["public_key"], "subject": subject}
