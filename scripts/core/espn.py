"""
ESPN public API client — no auth, no API key needed.
Adds a small sleep between calls to be polite to ESPN's servers.
"""

import time
import requests

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "wc2026-dashboard/1.0"})

SLEEP_BETWEEN_CALLS = 0.5  # seconds


def get(url: str, params: dict = None) -> dict:
    response = SESSION.get(url, params=params or {}, timeout=15)
    response.raise_for_status()
    time.sleep(SLEEP_BETWEEN_CALLS)
    return response.json()
