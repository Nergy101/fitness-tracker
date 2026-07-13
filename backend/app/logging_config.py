"""Central logging configuration.

Call `configure_logging()` once at process startup (before importing modules
that emit records at import time). The level is controlled by the LOG_LEVEL
env var (default INFO).
"""

import logging
import os


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        force=True,
    )
