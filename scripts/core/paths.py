"""Repo-level paths shared by every competition pipeline."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "data"          # pipeline caches, one folder per competition
WEB_DATA_DIR = PROJECT_ROOT / "web" / "data"  # what the Next.js app reads
