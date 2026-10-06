"""Small JSON + date helpers shared by every competition pipeline."""

import json
from datetime import date, timedelta
from pathlib import Path


def load_json(path: Path, default=None):
    if path.exists():
        return json.loads(path.read_text())
    return {} if default is None else default


def save_json(path: Path, data, compact: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:  # ~40% smaller; for files the browser downloads
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    else:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  Wrote {path}")


def date_range(start: str, end: str):
    """Yield YYYYMMDD strings from start to min(end, today)."""
    s = date(int(start[:4]), int(start[4:6]), int(start[6:]))
    e = min(date(int(end[:4]), int(end[4:6]), int(end[6:])), date.today())
    current = s
    while current <= e:
        yield current.strftime("%Y%m%d")
        current += timedelta(days=1)
