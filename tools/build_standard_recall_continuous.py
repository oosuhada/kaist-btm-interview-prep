#!/usr/bin/env python3
"""Build lock-screen-safe continuous standard interview audio playlists."""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
TRACK_DIR = ROOT / "public" / "audio" / "tracks"
MANIFEST_PATH = TRACK_DIR / "manifest.json"
OUTPUT_MANIFEST = TRACK_DIR / "continuous.json"

PRIORITY_ORDER = [
    "application-opening-60", "application-opening-30", "application-q5", "application-q6",
    "defense-tom-fit", "research-1", "research-3", "application-q40", "application-q41",
    "application-q44", "application-q39", "application-q32", "application-q7",
    "application-extra-101", "application-q62", "defense-q11", "defense-q13", "defense-q28",
]
PRIORITY = {track_id: index for index, track_id in enumerate(PRIORITY_ORDER)}
SECTION = {"application": 0, "defense": 1, "presentation": 2}


def duration(path: Path) -> float:
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True).strip())


def concat(paths: list[Path], output: Path) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as handle:
        list_path = Path(handle.name)
        for item in paths:
            handle.write("file '" + str(item).replace("'", "'\\''") + "'\n")
    try:
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(list_path),
            "-c:a", "libmp3lame", "-b:a", "48k", "-ac", "1", str(output),
        ], check=True)
    finally:
        list_path.unlink(missing_ok=True)


def sort_key(track: dict) -> tuple[int, int, int]:
    return (
        PRIORITY.get(track["id"], 1_000_000),
        SECTION.get(track["section"], 99),
        int(track["number"]),
    )


def main() -> None:
    tracks = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))["tracks"]
    languages = {}
    for language in ("en", "ko"):
        ordered = sorted([track for track in tracks if track["language"] == language], key=sort_key)
        cursor = 0.0
        entries = []
        paths = []
        for track in ordered:
            path = ROOT / "public" / urlsplit(track["src"]).path.lstrip("/")
            track_duration = duration(path)
            entries.append({
                "trackId": track["trackId"], "id": track["id"],
                "start": round(cursor, 3), "end": round(cursor + track_duration, 3),
                "duration": round(track_duration, 3),
            })
            cursor += track_duration
            paths.append(path)
        output = TRACK_DIR / f"continuous-{language}.mp3"
        concat(paths, output)
        languages[language] = {
            "src": f"/audio/tracks/{output.name}", "duration": round(duration(output), 3),
            "trackCount": len(entries), "tracks": entries,
        }
        print(f"{output.name}: {len(entries)} tracks, {output.stat().st_size / 1024 / 1024:.1f} MiB")
    OUTPUT_MANIFEST.write_text(json.dumps({
        "version": 1, "purpose": "single-resource lock-screen playback for standard interview audio",
        "languages": languages,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
