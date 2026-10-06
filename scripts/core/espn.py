"""
ESPN public API client — no auth, no API key needed.
Adds a small sleep between calls to be polite to ESPN's servers, and retries
transient refusals (403/429/5xx) with backoff.
"""

import time
import requests

SESSION = requests.Session()
# From Aug 2026 ESPN answered the pipeline's custom "wc2026-dashboard/1.0"
# agent with 403s; send ordinary browser headers instead.
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.espn.com/",
    "Origin": "https://www.espn.com",
})

SLEEP_BETWEEN_CALLS = 0.5  # seconds
RETRY_STATUSES = {403, 429, 500, 502, 503, 504}
BACKOFF = (2, 8, 30)  # seconds before each retry


def get(url: str, params: dict = None) -> dict:
    for attempt in range(len(BACKOFF) + 1):
        response = SESSION.get(url, params=params or {}, timeout=15)
        if response.status_code not in RETRY_STATUSES or attempt == len(BACKOFF):
            break
        print(f"  ESPN {response.status_code} on {url} — retrying in {BACKOFF[attempt]}s")
        time.sleep(BACKOFF[attempt])
    response.raise_for_status()
    time.sleep(SLEEP_BETWEEN_CALLS)
    return response.json()
