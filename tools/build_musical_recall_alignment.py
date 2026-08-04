#!/usr/bin/env python3
"""Build reusable word-level alignment for Musical Recall tracks.

This intentionally does NOT use the Lyria section timestamps as timing input.
The existing Musical Recall manifest is used only for track metadata and the
canonical lyric text/order. Timing is inferred from the actual published MP3
with Whisper word timestamps (MLX on Apple Silicon when available, otherwise
faster-whisper), then the recognized words are aligned back to the canonical
lyric tokens.

Output:
    public/audio/musical-recall/alignment.json

Typical regeneration:
    python3 tools/build_musical_recall_alignment.py --workers 1
"""

from __future__ import annotations

import argparse
import gc
import json
import math
import re
import statistics
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MUSICAL_DIR = ROOT / "public" / "audio" / "musical-recall"
MANIFEST_PATH = MUSICAL_DIR / "manifest.json"
BASE_MANIFEST_PATH = ROOT / "public" / "audio" / "tracks" / "manifest.json"
OUTPUT_PATH = MUSICAL_DIR / "alignment.json"

_MODEL: Any = None
_MODEL_NAME = "small"
_ENGINE = "faster-whisper"


@dataclass
class ExpectedToken:
    text: str
    normalized: str
    cue_index: int
    token_index: int
    role: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--engine",
        choices=["auto", "mlx-whisper", "faster-whisper"],
        default="auto",
        help="Alignment ASR engine (default: auto; prefers MLX on Apple Silicon)",
    )
    parser.add_argument("--model", help="Model name/repo. Defaults to a small multilingual model for the selected engine")
    parser.add_argument("--workers", type=int, default=1, help="Parallel model workers (default: 1; fastest on Apple Silicon in testing)")
    parser.add_argument("--cpu-threads", type=int, default=0, help="CPU threads per worker (default: 0 = CTranslate2 auto)")
    parser.add_argument("--track", action="append", help="Only process a trackId; may be repeated")
    parser.add_argument("--language", choices=["ko", "en"], help="Only process one language")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--resume", action="store_true", help="Reuse successful entries already in output")
    parser.add_argument(
        "--resume-min-match-rate",
        type=float,
        default=0.0,
        help="With --resume, reprocess existing tracks below this match rate (for quality retry passes)",
    )
    return parser.parse_args()


def normalize_token(token: str, language: str) -> str:
    value = token.lower().replace("’", "'").replace("–", "-").replace("—", "-")
    value = re.sub(r"[^\w가-힣+#'-]+", "", value, flags=re.UNICODE)
    if language == "en":
        value = value.strip("'-")
        if value.endswith("'s") and len(value) > 3:
            value = value[:-2]
    return value


def count_normalized_tokens(text: str, language: str) -> int:
    raw_tokens = re.findall(r"[\w가-힣+#’'&.-]+", text, flags=re.UNICODE)
    return sum(1 for raw in raw_tokens if normalize_token(raw, language))


def tokenize_cues(
    cues: list[dict[str, Any]],
    language: str,
    canonical_question: str,
) -> list[ExpectedToken]:
    tokens: list[ExpectedToken] = []
    first_cue = cues[0] if cues else {}
    first_text = first_cue.get("text", "")
    question_mark = re.search(r"[?？]", first_text)
    question_text = (
        first_text[: question_mark.end()]
        if question_mark
        else canonical_question
    )
    question_word_count = count_normalized_tokens(question_text, language)
    for cue_index, cue in enumerate(cues):
        raw_tokens = re.findall(r"[\w가-힣+#’'&.-]+", cue.get("text", ""), flags=re.UNICODE)
        valid_index = 0
        for token_index, raw in enumerate(raw_tokens):
            normalized = normalize_token(raw, language)
            if not normalized:
                continue
            role = (
                "question"
                if cue_index == 0 and valid_index < question_word_count
                else "answer"
            )
            tokens.append(ExpectedToken(raw, normalized, cue_index, token_index, role))
            valid_index += 1
    return tokens


def duration_seconds(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return 0.0


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if len(a) >= 4 and len(b) >= 4 and (a in b or b in a):
        return 0.91
    return SequenceMatcher(None, a, b, autojunk=False).ratio()


def align_token_sequences(expected: list[str], observed: list[str]) -> dict[int, tuple[int, float]]:
    """Needleman-Wunsch style ordered fuzzy token alignment."""
    n, m = len(expected), len(observed)
    gap = -0.72
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    move = [[0] * (m + 1) for _ in range(n + 1)]  # 1 diag, 2 up, 3 left

    for i in range(1, n + 1):
        dp[i][0] = i * gap
        move[i][0] = 2
    for j in range(1, m + 1):
        dp[0][j] = j * gap
        move[0][j] = 3

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sim = similarity(expected[i - 1], observed[j - 1])
            match_score = 2.15 * sim - (0.35 if sim >= 0.55 else 1.15)
            diagonal = dp[i - 1][j - 1] + match_score
            up = dp[i - 1][j] + gap
            left = dp[i][j - 1] + gap
            if diagonal >= up and diagonal >= left:
                dp[i][j] = diagonal
                move[i][j] = 1
            elif up >= left:
                dp[i][j] = up
                move[i][j] = 2
            else:
                dp[i][j] = left
                move[i][j] = 3

    mapping: dict[int, tuple[int, float]] = {}
    i, j = n, m
    while i > 0 or j > 0:
        step = move[i][j]
        if step == 1 and i > 0 and j > 0:
            sim = similarity(expected[i - 1], observed[j - 1])
            if sim >= 0.56:
                mapping[i - 1] = (j - 1, sim)
            i -= 1
            j -= 1
        elif step == 2 and i > 0:
            i -= 1
        elif j > 0:
            j -= 1
        else:
            break
    return mapping


def interpolate_missing_words(
    expected_tokens: list[ExpectedToken],
    mapping: dict[int, tuple[int, float]],
    observed_words: list[dict[str, Any]],
    duration: float,
) -> list[dict[str, Any]]:
    if not expected_tokens:
        return []

    matched_positions: list[tuple[int, float, float]] = []
    durations = []
    for expected_index, (observed_index, _) in mapping.items():
        word = observed_words[observed_index]
        start = duration_seconds(word["start"])
        end = duration_seconds(word["end"])
        matched_positions.append((expected_index, start, end))
        if end > start:
            durations.append(end - start)
    matched_positions.sort()
    median_word_duration = statistics.median(durations) if durations else 0.34
    median_word_duration = min(0.7, max(0.16, median_word_duration))

    anchors = {index: (start, end) for index, start, end in matched_positions}
    result: list[dict[str, Any]] = []
    for index, token in enumerate(expected_tokens):
        if index in mapping:
            observed_index, lexical_similarity = mapping[index]
            source = observed_words[observed_index]
            result.append(
                {
                    "text": token.text,
                    "start": duration_seconds(source["start"]),
                    "end": duration_seconds(source["end"]),
                    "role": token.role,
                    "confidence": round(float(source.get("confidence") or 0.0), 4),
                    "matched": True,
                    "matchSimilarity": round(lexical_similarity, 4),
                    "recognizedText": source.get("text", "").strip(),
                    "cueIndex": token.cue_index,
                }
            )
            continue

        previous = next(((i, anchors[i]) for i in range(index - 1, -1, -1) if i in anchors), None)
        following = next(((i, anchors[i]) for i in range(index + 1, len(expected_tokens)) if i in anchors), None)

        if previous and following:
            prev_i, (_, prev_end) = previous
            next_i, (next_start, _) = following
            span = max(0.01, next_start - prev_end)
            slots = next_i - prev_i
            position = index - prev_i
            center = prev_end + span * position / slots
            local = min(median_word_duration, max(0.08, span / max(1, slots) * 0.82))
            start = max(prev_end, center - local / 2)
            end = min(next_start, center + local / 2)
        elif previous:
            prev_i, (_, prev_end) = previous
            start = prev_end + (index - prev_i - 1) * median_word_duration
            end = min(duration, start + median_word_duration * 0.84)
        elif following:
            next_i, (next_start, _) = following
            end = max(0.0, next_start - (next_i - index - 1) * median_word_duration)
            start = max(0.0, end - median_word_duration * 0.84)
        else:
            slot = duration / max(1, len(expected_tokens))
            start = index * slot
            end = min(duration, start + slot * 0.84)

        result.append(
            {
                "text": token.text,
                "start": round(max(0.0, start), 3),
                "end": round(max(start, end), 3),
                "role": token.role,
                "confidence": 0.0,
                "matched": False,
                "matchSimilarity": 0.0,
                "recognizedText": None,
                "cueIndex": token.cue_index,
            }
        )

    # Enforce nondecreasing timestamps after interpolation.
    last_start = 0.0
    for word in result:
        proposed_start = max(last_start, float(word["start"]))
        if proposed_start >= duration:
            # Canonical lyrics may contain a trailing ad-lib/repetition that
            # is not actually present in the rendered MP3. Never invent time
            # beyond the real media duration; mark it as an unmatched zero-
            # length boundary token so downstream karaoke will not highlight
            # it as if it had been sung.
            word["start"] = round(duration, 3)
            word["end"] = round(duration, 3)
            word["matched"] = False
            word["confidence"] = 0.0
            word["matchSimilarity"] = 0.0
            word["recognizedText"] = None
            last_start = duration
            continue

        word["start"] = round(proposed_start, 3)
        proposed_end = max(float(word["start"]) + 0.03, float(word["end"]))
        word["end"] = round(min(duration, proposed_end), 3)
        last_start = word["start"]
    return result


def build_cues(source_cues: list[dict[str, Any]], aligned_words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cues: list[dict[str, Any]] = []
    for cue_index, source in enumerate(source_cues):
        words = [
            {k: value for k, value in word.items() if k != "cueIndex"}
            for word in aligned_words
            if word.get("cueIndex") == cue_index
        ]
        matched = [word for word in words if word.get("matched")]
        if words:
            start = min(word["start"] for word in words)
            end = max(word["end"] for word in words)
        else:
            start = end = 0.0
        cues.append(
            {
                "section": source.get("section"),
                "role": source.get("role", "answer"),
                "text": source.get("text", ""),
                "start": round(start, 3),
                "end": round(end, 3),
                "words": words,
                "matchRate": round(len(matched) / max(1, len(words)), 4),
            }
        )
    return cues


def resolve_engine(requested: str) -> str:
    if requested != "auto":
        return requested
    try:
        import mlx_whisper  # noqa: F401

        return "mlx-whisper"
    except ImportError:
        return "faster-whisper"


def init_worker(engine: str, model_name: str, cpu_threads: int) -> None:
    global _MODEL, _MODEL_NAME, _ENGINE
    _MODEL_NAME = model_name
    _ENGINE = engine
    if engine == "mlx-whisper":
        import mlx_whisper

        _MODEL = mlx_whisper
        return

    from faster_whisper import WhisperModel

    _MODEL = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=cpu_threads)


def process_track(track: dict[str, Any]) -> dict[str, Any]:
    started = time.time()
    language = track["language"]
    language_code = "ko" if language == "ko" else "en"
    audio_path = ROOT / "public" / track["src"].lstrip("/")
    if not audio_path.exists():
        raise FileNotFoundError(audio_path)

    source_cues = track.get("cues") or []
    lyrics = " ".join(cue.get("text", "").strip() for cue in source_cues if cue.get("text"))
    canonical_question = track.get("canonicalQuestion") or (
        source_cues[0].get("text", "") if source_cues else ""
    )
    expected_tokens = tokenize_cues(source_cues, language, canonical_question)
    if not expected_tokens:
        raise ValueError("No canonical lyric tokens")

    observed_words: list[dict[str, Any]] = []
    transcripts: list[str] = []
    if _ENGINE == "mlx-whisper":
        response = _MODEL.transcribe(
            str(audio_path),
            path_or_hf_repo=_MODEL_NAME,
            language=language_code,
            word_timestamps=True,
            initial_prompt=lyrics,
            condition_on_previous_text=True,
            temperature=0.0,
            verbose=False,
        )
        for segment in response.get("segments", []):
            text = (segment.get("text") or "").strip()
            if text:
                transcripts.append(text)
            for word in segment.get("words") or []:
                word_text = (word.get("word") or "").strip()
                normalized = normalize_token(word_text, language)
                if not normalized:
                    continue
                observed_words.append(
                    {
                        "text": word_text,
                        "normalized": normalized,
                        "start": round(float(word.get("start") or 0.0), 3),
                        "end": round(float(word.get("end") or 0.0), 3),
                        "confidence": round(float(word.get("probability") or 0.0), 4),
                    }
                )
    else:
        segments, _info = _MODEL.transcribe(
            str(audio_path),
            language=language_code,
            beam_size=5,
            word_timestamps=True,
            vad_filter=False,
            initial_prompt=lyrics,
            condition_on_previous_text=True,
            temperature=0.0,
        )
        for segment in list(segments):
            if segment.text:
                transcripts.append(segment.text.strip())
            for word in segment.words or []:
                word_text = (word.word or "").strip()
                normalized = normalize_token(word_text, language)
                if not normalized:
                    continue
                observed_words.append(
                    {
                        "text": word_text,
                        "normalized": normalized,
                        "start": round(float(word.start), 3),
                        "end": round(float(word.end), 3),
                        "confidence": round(float(word.probability or 0.0), 4),
                    }
                )

    if not observed_words:
        raise ValueError("ASR returned no word timestamps")

    expected_norm = [token.normalized for token in expected_tokens]
    observed_norm = [word["normalized"] for word in observed_words]
    mapping = align_token_sequences(expected_norm, observed_norm)
    duration = float(track["duration"])
    aligned_words = interpolate_missing_words(expected_tokens, mapping, observed_words, duration)
    cues = build_cues(source_cues, aligned_words)

    matched_words = [word for word in aligned_words if word["matched"]]
    match_rate = len(matched_words) / max(1, len(aligned_words))
    mean_probability = statistics.mean(word["confidence"] for word in matched_words) if matched_words else 0.0
    mean_similarity = statistics.mean(word["matchSimilarity"] for word in matched_words) if matched_words else 0.0
    confidence = match_rate * (0.55 * mean_probability + 0.45 * mean_similarity)

    compact_words = [{k: value for k, value in word.items() if k != "cueIndex"} for word in aligned_words]
    result = {
        "trackId": track["trackId"],
        "language": language,
        "src": track["src"],
        "duration": round(duration, 3),
        "alignmentEngine": f"{_ENGINE}/{_MODEL_NAME}",
        "alignmentMethod": "actual-mp3 word timestamps + canonical-lyrics fuzzy forced matching",
        "canonicalQuestion": canonical_question,
        "lyrics": lyrics,
        "rawTranscript": " ".join(transcripts).strip(),
        "words": compact_words,
        "cues": cues,
        "matchRate": round(match_rate, 4),
        "meanMatchedWordConfidence": round(mean_probability, 4),
        "meanLexicalSimilarity": round(mean_similarity, 4),
        "alignmentConfidence": round(confidence, 4),
        "recognizedWordCount": len(observed_words),
        "canonicalWordCount": len(aligned_words),
        "matchedWordCount": len(matched_words),
        "processingSeconds": round(time.time() - started, 2),
    }
    if _ENGINE == "mlx-whisper":
        # mlx-whisper allocates Metal buffers per transcription. Explicitly
        # release cached buffers between songs so a 44-track run does not
        # progressively slow down or hit memory pressure.
        try:
            import mlx.core as mx

            mx.clear_cache()
        except Exception:  # noqa: BLE001 - cache cleanup is best-effort
            pass
        gc.collect()
    return result


def write_alignment_manifest(
    output: Path,
    results: list[dict[str, Any]],
    failures: list[dict[str, Any]],
    selected_tracks: list[dict[str, Any]],
    total_manifest_tracks: int,
    engine: str,
    model_name: str,
) -> None:
    ordered_results = sorted(results, key=lambda item: (item["trackId"], item["language"]))
    success_keys = {(item["trackId"], item["language"]) for item in ordered_results}
    selected_keys = {(item["trackId"], item["language"]) for item in selected_tracks}
    selected_success = len(success_keys & selected_keys)
    failure_keys = {(item.get("trackId"), item.get("language")) for item in failures}
    selected_failure = len(failure_keys & selected_keys)
    selected_pending = max(0, len(selected_keys) - selected_success - selected_failure)
    track_engines = sorted({item.get("alignmentEngine") for item in ordered_results if item.get("alignmentEngine")})
    payload = {
        "version": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceOfTruth": "actual published Musical Recall MP3 audio",
        "timingPolicy": "Lyria section timestamps are not used as final timing; canonical lyrics provide text/order only.",
        "semanticRolePolicy": "Each aligned word stores role=question|answer; the canonical interview question defines the first role boundary, including mixed first lyric cues.",
        "alignmentEngine": {
            "name": "mixed" if len(track_engines) > 1 else engine,
            "model": model_name,
            "trackEngines": track_engines,
            "lastRunEngine": f"{engine}/{model_name}",
            "device": "Apple Silicon / Metal" if engine == "mlx-whisper" else "cpu",
            "computeType": "MLX" if engine == "mlx-whisper" else "int8",
            "wordTimestamps": True,
            "lyricsBiasedInitialPrompt": True,
            "canonicalMatching": "ordered fuzzy token alignment with audio-timestamp anchors",
        },
        "googleSpeechToTextProbe": {
            "project": "flai-oosuhada-20260506",
            "api": "Cloud Speech-to-Text",
            "model": "latest_long",
            "result": "rejected as final aligner because the music-heavy sample returned timing result boundaries but empty lexical alternatives",
        },
        "summary": {
            "requestedTracks": len(selected_keys),
            "success": selected_success,
            "failed": selected_failure,
            "pending": selected_pending,
            "totalManifestTracks": total_manifest_tracks,
        },
        "tracks": ordered_results,
        "failures": failures,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    engine = resolve_engine(args.engine)
    model_name = args.model or (
        "mlx-community/whisper-small-mlx" if engine == "mlx-whisper" else "small"
    )
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    tracks: list[dict[str, Any]] = list(manifest.get("tracks") or [])
    base_manifest = json.loads(BASE_MANIFEST_PATH.read_text(encoding="utf-8"))
    base_map = {
        (track.get("id"), track.get("language")): track
        for track in base_manifest.get("tracks", [])
    }
    for track in tracks:
        base = base_map.get((track.get("trackId"), track.get("language")))
        if base:
            track["canonicalQuestion"] = base.get("question", "")
    if args.track:
        wanted = set(args.track)
        tracks = [track for track in tracks if track.get("trackId") in wanted]
    if args.language:
        tracks = [track for track in tracks if track.get("language") == args.language]

    existing: dict[tuple[str, str], dict[str, Any]] = {}
    if args.resume and args.output.exists():
        previous = json.loads(args.output.read_text(encoding="utf-8"))
        existing = {
            (track["trackId"], track["language"]): track
            for track in previous.get("tracks", [])
            if track.get("words")
            and track.get("alignmentConfidence") is not None
            and float(track.get("matchRate") or 0.0) >= args.resume_min_match_rate
        }

    pending = [track for track in tracks if (track["trackId"], track["language"]) not in existing]
    results = list(existing.values())
    failures: list[dict[str, Any]] = []
    workers = max(1, min(args.workers, len(pending) or 1))

    print(
        f"Building alignment for {len(tracks)} tracks; pending={len(pending)} "
        f"workers={workers} engine={engine} model={model_name}",
        flush=True,
    )
    if pending:
        if workers == 1:
            init_worker(engine, model_name, args.cpu_threads)
            for completed, track in enumerate(pending, start=1):
                try:
                    result = process_track(track)
                    results.append(result)
                    print(
                        f"[{completed:02d}/{len(pending):02d}] OK {result['trackId']}:{result['language']} "
                        f"match={result['matchRate']:.1%} confidence={result['alignmentConfidence']:.3f} "
                        f"({result['processingSeconds']:.1f}s)",
                        flush=True,
                    )
                    write_alignment_manifest(
                        args.output,
                        results,
                        failures,
                        tracks,
                        len(manifest.get("tracks") or []),
                        engine,
                        model_name,
                    )
                except Exception as exc:  # noqa: BLE001 - persist per-track failures
                    failure = {
                        "trackId": track.get("trackId"),
                        "language": track.get("language"),
                        "src": track.get("src"),
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                    failures.append(failure)
                    print(f"[{completed:02d}/{len(pending):02d}] FAIL {failure}", file=sys.stderr, flush=True)
                    write_alignment_manifest(
                        args.output,
                        results,
                        failures,
                        tracks,
                        len(manifest.get("tracks") or []),
                        engine,
                        model_name,
                    )
        else:
            with ProcessPoolExecutor(
                max_workers=workers,
                initializer=init_worker,
                initargs=(engine, model_name, args.cpu_threads),
            ) as pool:
                future_map = {pool.submit(process_track, track): track for track in pending}
                completed = 0
                for future in as_completed(future_map):
                    track = future_map[future]
                    completed += 1
                    try:
                        result = future.result()
                        results.append(result)
                        print(
                            f"[{completed:02d}/{len(pending):02d}] OK {result['trackId']}:{result['language']} "
                            f"match={result['matchRate']:.1%} confidence={result['alignmentConfidence']:.3f} "
                            f"({result['processingSeconds']:.1f}s)",
                            flush=True,
                        )
                        write_alignment_manifest(
                            args.output,
                            results,
                            failures,
                            tracks,
                            len(manifest.get("tracks") or []),
                            engine,
                            model_name,
                        )
                    except Exception as exc:  # noqa: BLE001 - persist per-track failures
                        failure = {
                            "trackId": track.get("trackId"),
                            "language": track.get("language"),
                            "src": track.get("src"),
                            "error": f"{type(exc).__name__}: {exc}",
                        }
                        failures.append(failure)
                        print(f"[{completed:02d}/{len(pending):02d}] FAIL {failure}", file=sys.stderr, flush=True)
                        write_alignment_manifest(
                            args.output,
                            results,
                            failures,
                            tracks,
                            len(manifest.get("tracks") or []),
                            engine,
                            model_name,
                        )

    write_alignment_manifest(
        args.output,
        results,
        failures,
        tracks,
        len(manifest.get("tracks") or []),
        engine,
        model_name,
    )
    selected_keys = {(item["trackId"], item["language"]) for item in tracks}
    success_keys = {(item["trackId"], item["language"]) for item in results}
    selected_success = len(selected_keys & success_keys)
    selected_failure = len(selected_keys) - selected_success
    print(f"Wrote {args.output} success={selected_success} failed={selected_failure}", flush=True)


if __name__ == "__main__":
    main()
