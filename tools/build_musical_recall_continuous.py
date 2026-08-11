#!/usr/bin/env python3
"""Build lock-screen-safe continuous Musical Recall MP3s for Mobile Safari."""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MUSICAL_DIR = ROOT / "public" / "audio" / "musical-recall"
MANIFEST_PATH = MUSICAL_DIR / "manifest.json"
OUTPUT_MANIFEST = MUSICAL_DIR / "continuous.json"

PRIORITY_ORDER = [
    "application-opening-60", "application-opening-30", "application-q5",
    "defense-tom-fit", "research-1", "research-3", "application-q7",
    "application-q39", "application-q40", "application-q41", "application-q32",
    "application-extra-101", "application-q62", "application-q4", "application-q63",
    "application-q46", "application-extra-102", "application-extra-103",
    "application-q47", "application-q51", "application-q56", "application-extra-106",
    "application-extra-115", "application-q44", "application-extra-120",
]


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
            "-c:a", "libmp3lame", "-b:a", "96k", str(output),
        ], check=True)
    finally:
        list_path.unlink(missing_ok=True)


def main() -> None:
    tracks = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))["tracks"]
    track_map = {(item["trackId"], item["language"]): item for item in tracks}
    languages = {}
    for language in ("en", "ko"):
        cursor = 0.0
        entries = []
        paths = []
        for track_id in PRIORITY_ORDER:
            track = track_map[(track_id, language)]
            path = ROOT / "public" / track["src"].lstrip("/")
            track_duration = duration(path)
            entries.append({
                "trackId": track_id,
                "start": round(cursor, 3),
                "end": round(cursor + track_duration, 3),
                "duration": round(track_duration, 3),
            })
            cursor += track_duration
            paths.append(path)
        output = MUSICAL_DIR / f"continuous-{language}.mp3"
        concat(paths, output)
        languages[language] = {
            "src": f"/audio/musical-recall/{output.name}",
            "duration": round(duration(output), 3),
            "trackCount": len(entries),
            "tracks": entries,
        }
        print(f"{output.name}: {len(entries)} tracks, {output.stat().st_size / 1024 / 1024:.1f} MiB")
    OUTPUT_MANIFEST.write_text(json.dumps({
        "version": 1,
        "purpose": "single-resource lock-screen playback for Mobile Safari",
        "priorityOrder": PRIORITY_ORDER,
        "languages": languages,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
