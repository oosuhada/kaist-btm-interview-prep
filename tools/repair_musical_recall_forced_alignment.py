#!/usr/bin/env python3
"""Repair low-confidence Musical Recall timings with forced audio alignment.

The first-pass Whisper ASR manifest is useful for most tracks, but singing can
cause lexical hallucination even when the audio timing is recoverable. This
tool does not transcribe the lyrics again. Instead, it takes the canonical
lyrics text and searches the *actual MP3* with Whisper cross-attention + DTW
(`whisper.timing.find_alignment`).

No Lyria timestamp is used as an alignment input.

The existing actual-audio ASR alignment is retained for high-quality cues and
as a quality baseline. Low-quality cues are searched across overlapping 30s
audio windows. Candidate occurrences are scored acoustically, de-duplicated,
and selected jointly in cue order so repeated choruses resolve to the correct
occurrence.

Typical usage (uses already-cached tiny/tiny.en models):

    python3 tools/repair_musical_recall_forced_alignment.py

The tool updates only:
    public/audio/musical-recall/alignment.json
"""

from __future__ import annotations

import argparse
import gc
import json
import math
import re
import statistics
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
import whisper
from whisper.audio import HOP_LENGTH, N_FRAMES, SAMPLE_RATE
from whisper.timing import find_alignment
from whisper.tokenizer import get_tokenizer

from build_musical_recall_alignment import (
    ExpectedToken,
    MUSICAL_DIR,
    OUTPUT_PATH,
    align_token_sequences,
    interpolate_missing_words,
    normalize_token,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE_MANIFEST = MUSICAL_DIR / "manifest.json"


@dataclass
class Candidate:
    start: float
    end: float
    score: float
    mean_probability: float
    high_probability_rate: float
    words: list[dict[str, Any]]
    window_start: float
    window_end: float
    source: str = "forced"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--alignment", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--track-threshold", type=float, default=0.80)
    parser.add_argument("--cue-threshold", type=float, default=0.80)
    parser.add_argument("--window-seconds", type=float, default=30.0)
    parser.add_argument("--window-step", type=float, default=5.0)
    parser.add_argument("--word-probability-threshold", type=float, default=0.10)
    parser.add_argument("--high-probability-threshold", type=float, default=0.25)
    parser.add_argument("--track", action="append", help="Repair only this trackId; may repeat")
    parser.add_argument("--language", choices=["ko", "en"])
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def canonical_tokens(text: str, language: str) -> list[ExpectedToken]:
    raw_tokens = re.findall(r"[\w가-힣+#’'&.-]+", text, flags=re.UNICODE)
    result: list[ExpectedToken] = []
    for token_index, raw in enumerate(raw_tokens):
        normalized = normalize_token(raw, language)
        if normalized:
            result.append(ExpectedToken(raw, normalized, 0, token_index))
    return result


def window_starts(duration: float, window: float, step: float) -> list[float]:
    if duration <= window:
        return [0.0]
    starts = [round(float(value), 3) for value in frange(0.0, max(0.0, duration - window), step)]
    last = round(max(0.0, duration - window), 3)
    if not starts or abs(starts[-1] - last) > 0.01:
        starts.append(last)
    return starts


def frange(start: float, stop: float, step: float):
    value = start
    while value <= stop + 1e-9:
        yield value
        value += step


def prepare_mel(model: Any, audio: Any, start: float, end: float):
    crop = audio[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)]
    target_samples = N_FRAMES * SAMPLE_RATE // 100
    mel = whisper.log_mel_spectrogram(
        whisper.pad_or_trim(crop, target_samples),
        n_mels=model.dims.n_mels,
    ).to(model.device)
    num_frames = min(N_FRAMES, max(1, int(len(crop) / HOP_LENGTH)))
    return mel, num_frames


def forced_candidate(
    *,
    model: Any,
    tokenizer: Any,
    audio: Any,
    cue_text: str,
    language: str,
    start: float,
    end: float,
    word_probability_threshold: float,
    high_probability_threshold: float,
) -> Candidate | None:
    expected = canonical_tokens(cue_text, language)
    if not expected:
        return None
    mel, num_frames = prepare_mel(model, audio, start, end)
    timings = find_alignment(model, tokenizer, tokenizer.encode(cue_text), mel, num_frames)

    observed: list[dict[str, Any]] = []
    lexical_probabilities: list[float] = []
    high_positions: list[tuple[float, float]] = []
    for word in timings:
        raw = (word.word or "").strip()
        normalized = normalize_token(raw, language)
        if not normalized:
            continue
        probability = float(word.probability or 0.0)
        local_start = float(word.start)
        local_end = float(word.end)
        lexical_probabilities.append(probability)
        if probability >= high_probability_threshold:
            high_positions.append((local_start, local_end))
        # Very low-confidence edge tokens can stretch across long instrumental
        # gaps. Exclude them from timing anchors; interpolation will restore the
        # canonical word from nearby acoustic anchors instead.
        duration = max(0.0, local_end - local_start)
        if probability < word_probability_threshold or duration > 4.0:
            continue
        observed.append(
            {
                "text": raw,
                "normalized": normalized,
                "start": round(start + local_start, 3),
                "end": round(start + local_end, 3),
                "confidence": round(probability, 4),
            }
        )

    if not lexical_probabilities or not observed or not high_positions:
        return None

    expected_norm = [token.normalized for token in expected]
    observed_norm = [word["normalized"] for word in observed]
    mapping = align_token_sequences(expected_norm, observed_norm)
    if not mapping:
        return None

    aligned_words = interpolate_missing_words(expected, mapping, observed, end)
    for word in aligned_words:
        word.pop("cueIndex", None)

    high_rate = sum(p >= high_probability_threshold for p in lexical_probabilities) / len(lexical_probabilities)
    mean_probability = statistics.mean(lexical_probabilities)
    median_probability = statistics.median(lexical_probabilities)
    high_span = max(local_end for _, local_end in high_positions) - min(local_start for local_start, _ in high_positions)
    lexical_coverage = len(mapping) / max(1, len(expected))
    # Good windows typically exhibit many high-probability canonical words.
    # Penalize a forced match that needs almost the full 30s window for a short
    # phrase, which is characteristic of an incorrect acoustic location.
    stretch_penalty = max(0.0, high_span - 28.0) * 0.02
    score = (
        0.38 * mean_probability
        + 0.28 * high_rate
        + 0.18 * median_probability
        + 0.16 * lexical_coverage
        - stretch_penalty
    )

    reliable = [word for word in aligned_words if word.get("matched") and float(word.get("confidence") or 0.0) >= word_probability_threshold]
    if reliable:
        cue_start = min(float(word["start"]) for word in reliable)
        cue_end = max(float(word["end"]) for word in reliable)
    else:
        cue_start = min(float(word["start"]) for word in aligned_words)
        cue_end = max(float(word["end"]) for word in aligned_words)

    return Candidate(
        start=round(cue_start, 3),
        end=round(cue_end, 3),
        score=round(max(0.0, min(1.0, score)), 5),
        mean_probability=round(mean_probability, 5),
        high_probability_rate=round(high_rate, 5),
        words=aligned_words,
        window_start=round(start, 3),
        window_end=round(end, 3),
        source="forced",
    )


def dedupe_candidates(candidates: list[Candidate], max_candidates: int = 8) -> list[Candidate]:
    ordered = sorted(candidates, key=lambda item: item.score, reverse=True)
    kept: list[Candidate] = []
    for candidate in ordered:
        center = (candidate.start + candidate.end) / 2
        if any(abs(center - (other.start + other.end) / 2) < 2.5 for other in kept):
            continue
        kept.append(candidate)
        if len(kept) >= max_candidates:
            break
    return sorted(kept, key=lambda item: item.start)


def existing_candidate(cue: dict[str, Any]) -> Candidate:
    words = cue.get("words") or []
    confidences = [float(word.get("confidence") or 0.0) for word in words if word.get("matched")]
    mean_probability = statistics.mean(confidences) if confidences else 0.0
    match_rate = float(cue.get("matchRate") or 0.0)
    score = min(1.0, 0.58 * match_rate + 0.42 * mean_probability)
    return Candidate(
        start=float(cue.get("start") or 0.0),
        end=float(cue.get("end") or 0.0),
        score=score,
        mean_probability=mean_probability,
        high_probability_rate=match_rate,
        words=words,
        window_start=float(cue.get("start") or 0.0),
        window_end=float(cue.get("end") or 0.0),
        source="existing-asr",
    )


def choose_ordered_candidates(candidate_sets: list[list[Candidate]]) -> list[Candidate]:
    """Pick the highest-scoring monotonic occurrence sequence across cues."""
    if not candidate_sets:
        return []

    dp: list[list[float]] = [[-math.inf] * len(candidates) for candidates in candidate_sets]
    prev: list[list[int | None]] = [[None] * len(candidates) for candidates in candidate_sets]
    for index, candidate in enumerate(candidate_sets[0]):
        dp[0][index] = candidate.score

    for cue_index in range(1, len(candidate_sets)):
        for current_index, current in enumerate(candidate_sets[cue_index]):
            best_score = -math.inf
            best_prev: int | None = None
            for previous_index, previous in enumerate(candidate_sets[cue_index - 1]):
                if not math.isfinite(dp[cue_index - 1][previous_index]):
                    continue
                # Lyrics can overlap slightly in generated music, but a later
                # cue must not jump back to a clearly earlier occurrence.
                if current.start < previous.start + 0.35:
                    continue
                overlap = max(0.0, previous.end - current.start)
                # Canonical lyric cues are sequential. A tiny overlap can
                # happen because sung word boundaries are fuzzy, but several
                # seconds of overlap almost always means ASR attached a
                # repeated refrain to the wrong occurrence.
                if overlap > 0.75:
                    continue
                transition_penalty = min(0.12, overlap * 0.08)
                score = dp[cue_index - 1][previous_index] + current.score - transition_penalty
                if score > best_score:
                    best_score = score
                    best_prev = previous_index
            dp[cue_index][current_index] = best_score
            prev[cue_index][current_index] = best_prev

    last_index = max(range(len(candidate_sets[-1])), key=lambda idx: dp[-1][idx])
    if not math.isfinite(dp[-1][last_index]):
        # Conservative fallback: choose best local candidates and sort by cue
        # center expectation rather than writing an invalid backward timeline.
        return [max(candidates, key=lambda item: item.score) for candidates in candidate_sets]

    chosen = [candidate_sets[-1][last_index]]
    for cue_index in range(len(candidate_sets) - 1, 0, -1):
        previous_index = prev[cue_index][last_index]
        if previous_index is None:
            return [max(candidates, key=lambda item: item.score) for candidates in candidate_sets]
        last_index = previous_index
        chosen.append(candidate_sets[cue_index - 1][last_index])
    chosen.reverse()
    return chosen


def remap_words_to_track_cue(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for word in words:
        cleaned.append({k: value for k, value in word.items() if k != "cueIndex"})
    return cleaned


def repair_track(
    *,
    track: dict[str, Any],
    source_track: dict[str, Any],
    model: Any,
    tokenizer: Any,
    cue_threshold: float,
    window_seconds: float,
    window_step: float,
    word_probability_threshold: float,
    high_probability_threshold: float,
) -> dict[str, Any]:
    language = track["language"]
    audio_path = ROOT / "public" / track["src"].lstrip("/")
    audio = whisper.load_audio(str(audio_path))
    duration = float(track["duration"])
    source_cues = source_track.get("cues") or []
    current_cues = track.get("cues") or []
    if len(source_cues) != len(current_cues):
        raise ValueError(f"Cue count mismatch {len(source_cues)} != {len(current_cues)}")

    candidate_sets: list[list[Candidate]] = []
    starts = window_starts(duration, window_seconds, window_step)

    for cue_index, (source_cue, current_cue) in enumerate(zip(source_cues, current_cues)):
        current_match = float(current_cue.get("matchRate") or 0.0)
        existing = existing_candidate(current_cue)
        # Existing actual-ASR timings are valid candidates, but they are not
        # treated as immovable anchors: repeated sung phrases can receive a
        # lexically perfect ASR timestamp at the wrong occurrence. Strong
        # existing cues get a modest floor while forced candidates may replace
        # them when the full cue order supports a different occurrence.
        if current_match >= cue_threshold:
            existing.score = min(0.96, max(0.88, existing.score))
        candidates: list[Candidate] = [existing]
        for window_start in starts:
            window_end = min(duration, window_start + window_seconds)
            candidate = forced_candidate(
                model=model,
                tokenizer=tokenizer,
                audio=audio,
                cue_text=source_cue.get("text", ""),
                language=language,
                start=window_start,
                end=window_end,
                word_probability_threshold=word_probability_threshold,
                high_probability_threshold=high_probability_threshold,
            )
            if candidate is not None:
                candidates.append(candidate)

        candidates = dedupe_candidates(candidates)
        if not candidates:
            candidates = [existing]
        candidate_sets.append(candidates)

    chosen = choose_ordered_candidates(candidate_sets)
    repaired_cues: list[dict[str, Any]] = []
    forced_scores: list[float] = []
    forced_word_probabilities: list[float] = []
    repaired_count = 0

    for cue_index, (source_cue, current_cue, selected) in enumerate(
        zip(source_cues, current_cues, chosen)
    ):
        if selected.source == "existing-asr":
            repaired_cues.append(current_cue)
            continue

        repaired_count += 1
        words = remap_words_to_track_cue(selected.words)
        reliable_probabilities = [
            float(word.get("confidence") or 0.0)
            for word in words
            if word.get("matched")
        ]
        forced_word_probabilities.extend(reliable_probabilities)
        forced_scores.append(selected.score)
        acoustic_match_rate = (
            sum(probability >= high_probability_threshold for probability in reliable_probabilities)
            / max(1, len(words))
        )
        repaired_cues.append(
            {
                "section": source_cue.get("section"),
                "role": source_cue.get("role", "answer"),
                "text": source_cue.get("text", ""),
                "start": round(selected.start, 3),
                "end": round(selected.end, 3),
                "words": words,
                "matchRate": round(acoustic_match_rate, 4),
                "alignmentMethod": "forced-attention-dtw",
                "forcedAlignmentScore": round(selected.score, 4),
                "forcedAlignmentMeanProbability": round(selected.mean_probability, 4),
                "searchWindow": {
                    "start": selected.window_start,
                    "end": selected.window_end,
                },
                "initialAsrMatchRate": round(float(current_cue.get("matchRate") or 0.0), 4),
            }
        )

    all_words: list[dict[str, Any]] = []
    for cue in repaired_cues:
        all_words.extend(cue.get("words") or [])

    original_match_rate = float(track.get("matchRate") or 0.0)
    weighted_cue_match = sum(
        float(cue.get("matchRate") or 0.0) * max(1, len(cue.get("words") or []))
        for cue in repaired_cues
    ) / max(1, sum(max(1, len(cue.get("words") or [])) for cue in repaired_cues))
    forced_mean = statistics.mean(forced_word_probabilities) if forced_word_probabilities else 0.0
    forced_score_mean = statistics.mean(forced_scores) if forced_scores else 0.0
    # The final confidence combines acoustic coverage and forced-attention
    # probability. It is intentionally independent of Lyria metadata.
    repaired_confidence = 0.55 * weighted_cue_match + 0.30 * forced_mean + 0.15 * forced_score_mean

    result = dict(track)
    result.update(
        {
            "alignmentEngine": f"{track.get('alignmentEngine', 'unknown')} + openai-whisper/{'tiny.en' if language == 'en' else 'tiny'} forced-attention-dtw",
            "alignmentMethod": "actual-mp3 ASR anchors + canonical-lyrics forced attention DTW repair",
            "words": all_words,
            "cues": repaired_cues,
            "initialAsrMatchRate": round(original_match_rate, 4),
            "matchRate": round(weighted_cue_match, 4),
            "alignmentConfidence": round(max(float(track.get("alignmentConfidence") or 0.0), repaired_confidence), 4),
            "forcedAlignedCueCount": repaired_count,
            "forcedAlignmentMeanProbability": round(forced_mean, 4),
            "forcedAlignmentMeanScore": round(forced_score_mean, 4),
        }
    )
    return result


def main() -> None:
    args = parse_args()
    alignment = json.loads(args.alignment.read_text(encoding="utf-8"))
    source = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    source_map = {(track["trackId"], track["language"]): track for track in source.get("tracks", [])}

    requested_ids = set(args.track or [])
    targets = [
        track
        for track in alignment.get("tracks", [])
        if float(track.get("matchRate") or 0.0) < args.track_threshold
        and (not requested_ids or track.get("trackId") in requested_ids)
        and (not args.language or track.get("language") == args.language)
    ]

    if not targets:
        print("No tracks require forced-alignment repair.")
        return

    print(f"Forced-alignment repair targets: {len(targets)}", flush=True)
    model_cache: dict[str, Any] = {}
    tokenizer_cache: dict[str, Any] = {}
    track_map = {(track["trackId"], track["language"]): track for track in alignment.get("tracks", [])}

    for index, track in enumerate(targets, start=1):
        language = track["language"]
        model_name = "tiny.en" if language == "en" else "tiny"
        if model_name not in model_cache:
            model_cache[model_name] = whisper.load_model(model_name, device="cpu")
            tokenizer_cache[language] = get_tokenizer(
                multilingual=model_cache[model_name].is_multilingual,
                language=language,
                task="transcribe",
            )

        key = (track["trackId"], language)
        source_track = source_map.get(key)
        if not source_track:
            print(f"[{index:02d}/{len(targets):02d}] SKIP {key}: source lyrics missing", flush=True)
            continue

        repaired = repair_track(
            track=track,
            source_track=source_track,
            model=model_cache[model_name],
            tokenizer=tokenizer_cache[language],
            cue_threshold=args.cue_threshold,
            window_seconds=args.window_seconds,
            window_step=args.window_step,
            word_probability_threshold=args.word_probability_threshold,
            high_probability_threshold=args.high_probability_threshold,
        )
        track_map[key] = repaired
        print(
            f"[{index:02d}/{len(targets):02d}] {track['trackId']}:{language} "
            f"{float(track.get('matchRate') or 0):.1%} -> {float(repaired.get('matchRate') or 0):.1%} "
            f"forced_cues={repaired.get('forcedAlignedCueCount')} "
            f"confidence={float(repaired.get('alignmentConfidence') or 0):.3f}",
            flush=True,
        )

        if not args.dry_run:
            updated_tracks = sorted(track_map.values(), key=lambda item: (item["trackId"], item["language"]))
            alignment["tracks"] = updated_tracks
            alignment["generatedAt"] = datetime.now(timezone.utc).isoformat()
            alignment["forcedAlignmentRepair"] = {
                "engine": "openai-whisper tiny/tiny.en cross-attention DTW",
                "source": "actual published Musical Recall MP3 audio + canonical lyrics text",
                "usesLyriaTiming": False,
                "trackThreshold": args.track_threshold,
                "cueThreshold": args.cue_threshold,
                "windowSeconds": args.window_seconds,
                "windowStep": args.window_step,
            }
            args.alignment.write_text(json.dumps(alignment, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if not args.dry_run:
        final_tracks = list(track_map.values())
        alignment["tracks"] = sorted(final_tracks, key=lambda item: (item["trackId"], item["language"]))
        alignment["summary"] = {
            **(alignment.get("summary") or {}),
            "success": len(final_tracks),
            "failed": len(alignment.get("failures") or []),
            "pending": 0,
            "forcedRepairedTracks": sum(1 for item in final_tracks if item.get("forcedAlignedCueCount")),
            "meanMatchRate": round(statistics.mean(float(item.get("matchRate") or 0.0) for item in final_tracks), 4),
            "medianMatchRate": round(statistics.median(float(item.get("matchRate") or 0.0) for item in final_tracks), 4),
        }
        args.alignment.write_text(json.dumps(alignment, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {args.alignment}", flush=True)

    model_cache.clear()
    gc.collect()
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()


if __name__ == "__main__":
    main()
