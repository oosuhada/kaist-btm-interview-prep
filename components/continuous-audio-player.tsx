"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Headphones,
  Languages,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  ScrollText,
  Shuffle,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PlaylistCue = {
  role: "question" | "answer";
  text: string;
  start: number;
  end: number;
  section?: string;
  matchRate?: number;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    role?: "question" | "answer";
    confidence?: number;
    matched?: boolean;
  }>;
};

export type PlaylistTrack = {
  trackId: string;
  section: "presentation" | "defense" | "application";
  id: string;
  language: "ko" | "en";
  number: number;
  title: string;
  category: string;
  question: string;
  answer: string;
  priority: "essential" | "S" | "A" | "B";
  src: string;
  duration: number;
  questionEnd: number;
  answerStart: number;
  cues: PlaylistCue[];
  musicalRecall?: {
    src: string;
    duration: number;
    style: "A" | "B" | "C";
    cues: PlaylistCue[];
    alignmentEngine?: string;
    alignmentConfidence?: number;
    matchRate?: number;
  };
};

type Section = "all" | PlaylistTrack["section"];
type Language = PlaylistTrack["language"];
type RepeatMode = "off" | "all" | "one";
type PriorityLevel = 0 | 1 | 2 | 3;
type PlaybackMode = "standard" | "musical";

const rates = [0.9, 1, 1.1, 1.25];
const sectionOrder: Section[] = ["application", "defense", "presentation", "all"];
const sectionPriority: Record<PlaylistTrack["section"], number> = {
  application: 0,
  defense: 1,
  presentation: 2,
};
const sectionLabels: Record<Section, { label: string; description: string }> = {
  application: { label: "Application Defense", description: "Part 1 · 지원서·경력·학점·활동" },
  defense: { label: "Research Defense", description: "Part 2 · 연구계획·방법론·교수 적합성" },
  presentation: { label: "연구주제 발표", description: "Part 2 · 연구주제 발표 구간" },
  all: { label: "전체", description: "Application → Research Defense → 발표" },
};
const priorityRank: Record<PlaylistTrack["priority"], number> = {
  B: 0,
  A: 1,
  S: 2,
  essential: 3,
};
const priorityLabels: Record<PriorityLevel, { label: string; description: string }> = {
  0: { label: "전체", description: "모든 트랙" },
  1: { label: "주요", description: "A 이상" },
  2: { label: "핵심", description: "S급" },
  3: { label: "면접 직전", description: "최우선만" },
};

function getMusicalRecallSrc(track: PlaylistTrack) {
  return track.musicalRecall?.src ?? null;
}

function matchesPriority(track: PlaylistTrack, level: PriorityLevel) {
  return priorityRank[track.priority] >= level;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function displayText(value: string) {
  return value
    .replaceAll("Oosu Saloin", "Oosu Salon")
    .replace(/\bSaloin\b/g, "Salon");
}

function countLexicalTokens(text: string) {
  return (
    text.match(/[\p{L}\p{N}+#’'.-]+/gu)?.filter((token) =>
      token.replace(/[^\p{L}\p{N}+#]/gu, "").length > 0
    ).length ?? 0
  );
}

function getQuestionWordCount(track: PlaylistTrack, cue: PlaylistCue | undefined) {
  if (!cue) return 0;
  const questionMark = cue.text.search(/[?？]/);
  const count =
    questionMark >= 0
      ? countLexicalTokens(cue.text.slice(0, questionMark + 1))
      : countLexicalTokens(track.question);
  return Math.min(count, cue.words?.length ?? count);
}

function splitMusicalRecallCues(track: PlaylistTrack, cues: PlaylistCue[]) {
  return cues.flatMap((cue, cueIndex) => {
    if (!cue.words?.length) return [cue];

    const questionWordCount = cueIndex === 0 ? getQuestionWordCount(track, cue) : 0;
    const wordRole = (word: NonNullable<PlaylistCue["words"]>[number], wordIndex: number) =>
      word.role ??
      (cueIndex === 0 && wordIndex < questionWordCount ? "question" : cue.role);

    const roleChanges = cue.words.some(
      (word, wordIndex) => wordIndex > 0 && wordRole(word, wordIndex) !== wordRole(cue.words![wordIndex - 1], wordIndex - 1)
    );
    if (!roleChanges) return [cue];

    const segments: PlaylistCue[] = [];
    let segmentStart = 0;
    let segmentRole = wordRole(cue.words[0], 0);

    const pushSegment = (endExclusive: number) => {
      const words = cue.words!.slice(segmentStart, endExclusive);
      if (!words.length) return;
      const matchedWords = words.filter((word) => word.matched !== false);
      segments.push({
        ...cue,
        role: segmentRole,
        text: words.map((word) => word.text).join(" "),
        start: words[0].start,
        end: words[words.length - 1].end,
        words,
        matchRate: matchedWords.length / words.length,
      });
    };

    for (let wordIndex = 1; wordIndex < cue.words.length; wordIndex += 1) {
      const nextRole = wordRole(cue.words[wordIndex], wordIndex);
      if (nextRole === segmentRole) continue;
      pushSegment(wordIndex);
      segmentStart = wordIndex;
      segmentRole = nextRole;
    }
    pushSegment(cue.words.length);
    return segments;
  });
}

function shuffled(ids: string[], keepFirst?: string) {
  const rest = ids.filter((id) => id !== keepFirst);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return keepFirst && ids.includes(keepFirst) ? [keepFirst, ...rest] : rest;
}

export function ContinuousAudioPlayer({
  tracks,
  initialTrackId,
}: {
  tracks: PlaylistTrack[];
  initialTrackId?: string;
}) {
  const deepLinkedTrack = initialTrackId
    ? tracks.find((track) => track.trackId === initialTrackId)
    : undefined;
  const defaultTrack =
    deepLinkedTrack ??
    tracks.find(
      (track) => track.language === "en" && track.section === "application"
    ) ??
    tracks.find((track) => track.language === "ko");
  const [section, setSection] = useState<Section>(
    deepLinkedTrack?.section ?? "application"
  );
  const [language, setLanguage] = useState<Language>(deepLinkedTrack?.language ?? "en");
  const [rate, setRate] = useState(1);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("all");
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>(0);
  const [currentTrackId, setCurrentTrackId] = useState(defaultTrack?.trackId ?? "");
  const [shuffleOrder, setShuffleOrder] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("standard");
  const [mediaDuration, setMediaDuration] = useState(defaultTrack?.duration ?? 0);
  const [showScript, setShowScript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeCueRef = useRef<HTMLButtonElement>(null);
  const autoPlayNextRef = useRef(false);
  const timeSyncFrameRef = useRef<number | null>(null);
  const lastTimeSyncRef = useRef(0);

  const filteredTracks = useMemo(() => {
    const selected = tracks.filter(
      (track) =>
        track.language === language &&
        matchesPriority(track, priorityLevel) &&
        (section === "all" || track.section === section)
    );
    if (section !== "all") return selected;
    return [...selected].sort((a, b) => {
      const sectionDiff = sectionPriority[a.section] - sectionPriority[b.section];
      return sectionDiff || a.number - b.number;
    });
  }, [tracks, language, priorityLevel, section]);

  const trackMap = useMemo(
    () => new Map(filteredTracks.map((track) => [track.trackId, track])),
    [filteredTracks]
  );

  const currentTrack =
    trackMap.get(currentTrackId) ?? filteredTracks[0] ?? null;

  const musicalRecallSrc = currentTrack ? getMusicalRecallSrc(currentTrack) : null;
  const currentSrc =
    currentTrack && playbackMode === "musical" && musicalRecallSrc
      ? musicalRecallSrc
      : currentTrack?.src ?? "";
  const currentDuration = mediaDuration || currentTrack?.duration || 0;
  const currentCues = useMemo(() => {
    if (!currentTrack) return [];
    if (playbackMode === "musical" && currentTrack.musicalRecall) {
      return splitMusicalRecallCues(currentTrack, currentTrack.musicalRecall.cues);
    }
    return currentTrack.cues;
  }, [currentTrack, playbackMode]);

  const orderedIds = useMemo(() => {
    const natural = filteredTracks.map((track) => track.trackId);
    if (!shuffleEnabled) return natural;
    const valid = shuffleOrder.filter((id) => trackMap.has(id));
    return valid.length === natural.length
      ? valid
      : shuffled(natural, currentTrack?.trackId);
  }, [currentTrack?.trackId, filteredTracks, shuffleEnabled, shuffleOrder, trackMap]);

  const currentIndex = currentTrack
    ? Math.max(0, orderedIds.indexOf(currentTrack.trackId))
    : 0;

  const activeCueIndex = currentTrack
    ? currentCues.findIndex(
        (cue) => currentTime >= cue.start && currentTime < cue.end
      )
    : -1;

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    if (!isPlaying || playbackMode !== "musical" || !showScript) return;

    let cancelled = false;
    const syncTime = (now: number) => {
      if (cancelled) return;
      const audio = audioRef.current;
      if (audio && now - lastTimeSyncRef.current >= 32) {
        lastTimeSyncRef.current = now;
        setCurrentTime(audio.currentTime);
      }
      timeSyncFrameRef.current = window.requestAnimationFrame(syncTime);
    };

    timeSyncFrameRef.current = window.requestAnimationFrame(syncTime);
    return () => {
      cancelled = true;
      if (timeSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(timeSyncFrameRef.current);
        timeSyncFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackMode, showScript]);

  useEffect(() => {
    if (!showScript || activeCueIndex < 0) return;
    activeCueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeCueIndex, showScript]);

  useEffect(() => {
    if (!currentTrack || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: playbackMode === "musical" ? `Musical Recall · ${currentTrack.title}` : currentTrack.title,
      artist: "KAIST BTM Interview Prep",
      album: currentTrack.category,
    });
  }, [currentTrack, playbackMode]);

  const playTrack = useCallback(
    (trackId: string, mode: PlaybackMode = "standard") => {
      const track = tracks.find((item) => item.trackId === trackId);
      const nextMode = mode === "musical" && track && getMusicalRecallSrc(track) ? "musical" : "standard";
      if (trackId === currentTrackId && nextMode === playbackMode && audioRef.current) {
        if (audioRef.current.paused) void audioRef.current.play();
        else audioRef.current.pause();
        return;
      }
      autoPlayNextRef.current = true;
      setPlaybackMode(nextMode);
      setCurrentTrackId(trackId);
      setCurrentTime(0);
      setMediaDuration(track?.duration ?? 0);
    },
    [currentTrackId, playbackMode, tracks]
  );

  const moveTrack = useCallback(
    (direction: 1 | -1, fromEnded = false) => {
      if (!orderedIds.length || !currentTrack) return;
      if (repeatMode === "one" && fromEnded) {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          void audio.play();
        }
        return;
      }

      let nextIndex = currentIndex + direction;
      if (nextIndex >= orderedIds.length || nextIndex < 0) {
        if (repeatMode === "all" || !fromEnded) {
          nextIndex = direction > 0 ? 0 : orderedIds.length - 1;
        } else {
          setIsPlaying(false);
          return;
        }
      }
      const nextTrackId = orderedIds[nextIndex];
      const nextTrack = trackMap.get(nextTrackId);
      const nextMode =
        playbackMode === "musical" && nextTrack && getMusicalRecallSrc(nextTrack)
          ? "musical"
          : "standard";
      playTrack(nextTrackId, nextMode);
    },
    [currentIndex, currentTrack, orderedIds, playbackMode, playTrack, repeatMode, trackMap]
  );

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("nexttrack", () => moveTrack(1));
    navigator.mediaSession.setActionHandler("previoustrack", () => moveTrack(-1));
    return () => {
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, [moveTrack]);

  const cycleRepeat = () => {
    setRepeatMode((current) =>
      current === "off" ? "all" : current === "all" ? "one" : "off"
    );
  };

  const applyFilter = (nextSection: Section, nextLanguage: Language) => {
    audioRef.current?.pause();
    autoPlayNextRef.current = false;
    const nextTracks = tracks.filter(
      (track) =>
        track.language === nextLanguage &&
        matchesPriority(track, priorityLevel) &&
        (nextSection === "all" || track.section === nextSection)
    );
    if (nextSection === "all") {
      nextTracks.sort((a, b) => {
        const sectionDiff = sectionPriority[a.section] - sectionPriority[b.section];
        return sectionDiff || a.number - b.number;
      });
    }
    const first = nextTracks[0];
    setSection(nextSection);
    setLanguage(nextLanguage);
    setPlaybackMode("standard");
    setCurrentTrackId(first?.trackId ?? "");
    setCurrentTime(0);
    setMediaDuration(first?.duration ?? 0);
    setIsPlaying(false);
    setShuffleOrder(
      shuffleEnabled
        ? shuffled(
            nextTracks.map((track) => track.trackId),
            first?.trackId
          )
        : []
    );
  };

  const applyPriorityFilter = (nextLevel: PriorityLevel) => {
    audioRef.current?.pause();
    autoPlayNextRef.current = false;
    const nextTracks = tracks.filter(
      (track) =>
        track.language === language &&
        matchesPriority(track, nextLevel) &&
        (section === "all" || track.section === section)
    );
    if (section === "all") {
      nextTracks.sort((a, b) => {
        const sectionDiff = sectionPriority[a.section] - sectionPriority[b.section];
        return sectionDiff || a.number - b.number;
      });
    }
    const currentStillVisible = nextTracks.find(
      (track) => track.trackId === currentTrack?.trackId
    );
    const nextCurrent = currentStillVisible ?? nextTracks[0];
    setPriorityLevel(nextLevel);
    setPlaybackMode("standard");
    setCurrentTrackId(nextCurrent?.trackId ?? "");
    setCurrentTime(0);
    setMediaDuration(nextCurrent?.duration ?? 0);
    setIsPlaying(false);
    setShuffleOrder(
      shuffleEnabled
        ? shuffled(
            nextTracks.map((track) => track.trackId),
            nextCurrent?.trackId
          )
        : []
    );
  };

  const toggleShuffle = () => {
    setShuffleEnabled((current) => {
      const next = !current;
      setShuffleOrder(
        next
          ? shuffled(
              filteredTracks.map((track) => track.trackId),
              currentTrack?.trackId
            )
          : []
      );
      return next;
    });
  };

  const totalDuration = filteredTracks.reduce(
    (sum, track) => sum + track.duration,
    0
  );
  const unfilteredTrackCount = tracks.filter(
    (track) =>
      track.language === language &&
      (section === "all" || track.section === section)
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-32 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Headphones className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-tight">KAIST BTM 면접 오디오</div>
              <div className="text-xs font-bold text-slate-400">Charon · 질문 + 답변 트랙 플레이리스트</div>
            </div>
          </div>
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> 면접 카드
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
              {sectionOrder.map((value) => {
                const option = sectionLabels[value];
                const count = tracks.filter(
                  (track) =>
                    track.language === language &&
                    matchesPriority(track, priorityLevel) &&
                    (value === "all" || track.section === value)
                ).length;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => applyFilter(value, language)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      section === value
                        ? "border-cyan-300 bg-cyan-50 ring-2 ring-cyan-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-black text-slate-900">{option.label}</div>
                    <div className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-400">{count} tracks</div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                <Languages className="ml-2 h-4 w-4 text-slate-400" />
                {(["ko", "en"] as Language[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => applyFilter(section, value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black ${
                      language === value ? "bg-slate-900 text-white" : "text-slate-500"
                    }`}
                  >
                    {value === "ko" ? "한국어" : "English"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleShuffle}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                  shuffleEnabled
                    ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <Shuffle className="h-4 w-4" /> 셔플
              </button>
              <button
                type="button"
                onClick={cycleRepeat}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                  repeatMode !== "off"
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat2 className="h-4 w-4" />}
                {repeatMode === "one" ? "한 트랙 반복" : repeatMode === "all" ? "전체 반복" : "반복 끔"}
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <SlidersHorizontal className="h-4 w-4 text-cyan-600" /> 우선순위 필터
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  강하게 걸수록 면접 직전에 꼭 들을 트랙만 남깁니다.
                </div>
              </div>
              <div className="text-right">
                <div className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black text-white">
                  {priorityLabels[priorityLevel].label} · {priorityLabels[priorityLevel].description}
                </div>
                <div className="mt-1 text-[11px] font-bold text-slate-400">
                  {filteredTracks.length} / {unfilteredTrackCount} tracks
                </div>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={priorityLevel}
              onChange={(event) =>
                applyPriorityFilter(Number(event.target.value) as PriorityLevel)
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-600"
              aria-label="오디오 트랙 우선순위 필터"
            />
            <div className="mt-2 grid grid-cols-4 text-[10px] font-black text-slate-400 sm:text-xs">
              <span className={priorityLevel === 0 ? "text-slate-900" : ""}>전체</span>
              <span className={`text-center ${priorityLevel === 1 ? "text-slate-900" : ""}`}>주요</span>
              <span className={`text-center ${priorityLevel === 2 ? "text-slate-900" : ""}`}>핵심</span>
              <span className={`text-right ${priorityLevel === 3 ? "text-slate-900" : ""}`}>면접 직전</span>
            </div>
          </div>
        </section>

        <div className={`mt-4 grid gap-4 ${showScript ? "lg:grid-cols-[1.05fr_0.95fr]" : "grid-cols-1"}`}>
          <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <ListMusic className="h-4 w-4 text-cyan-600" /> Playlist
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  {filteredTracks.length} tracks · {formatTime(totalDuration)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-2 text-[11px] font-black text-violet-700 sm:flex">
                  <Music2 className="h-3.5 w-3.5" /> Musical Recall 22
                </div>
                <button
                  type="button"
                  onClick={() => setShowScript((current) => !current)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition ${
                    showScript ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <ScrollText className="h-4 w-4" /> Script
                </button>
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto">
              {orderedIds.map((trackId, index) => {
                const track = trackMap.get(trackId);
                if (!track) return null;
                const active = track.trackId === currentTrack?.trackId;
                const trackMusicalSrc = getMusicalRecallSrc(track);
                const standardActive = active && playbackMode === "standard";
                const musicalActive = active && playbackMode === "musical";
                return (
                  <div
                    key={track.trackId}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition sm:px-5 ${
                      active
                        ? playbackMode === "musical"
                          ? "bg-violet-50"
                          : "bg-cyan-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className={`mt-0.5 w-7 shrink-0 text-center text-xs font-black ${active ? playbackMode === "musical" ? "text-violet-600" : "text-cyan-600" : "text-slate-300"}`}>
                      {active && isPlaying ? "▶" : index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => playTrack(track.trackId, "standard")}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className={`line-clamp-2 text-sm font-black leading-5 ${active ? playbackMode === "musical" ? "text-violet-900" : "text-cyan-900" : "text-slate-800"}`}>
                        {displayText(track.title)}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                        <span className="truncate">{track.category}</span>
                        <span>·</span>
                        <span className="shrink-0">{formatTime(track.duration)}</span>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => playTrack(track.trackId, "standard")}
                        className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black transition ${
                          standardActive
                            ? "border-cyan-300 bg-cyan-600 text-white"
                            : "border-slate-200 bg-white text-slate-500 hover:border-cyan-200 hover:text-cyan-700"
                        }`}
                        aria-label={`${displayText(track.title)} 일반 음성 ${standardActive && isPlaying ? "일시정지" : "재생"}`}
                        title="일반 음성"
                      >
                        {standardActive && isPlaying ? (
                          <Pause className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                        <span className="hidden sm:inline">음성</span>
                      </button>
                      {trackMusicalSrc && (
                        <button
                          type="button"
                          onClick={() => playTrack(track.trackId, "musical")}
                          className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black transition ${
                            musicalActive
                              ? "border-violet-300 bg-violet-600 text-white"
                              : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                          }`}
                          aria-label={`${displayText(track.title)} Musical Recall ${musicalActive && isPlaying ? "일시정지" : "재생"}`}
                          title="Musical Recall"
                        >
                          {musicalActive && isPlaying ? (
                            <Pause className="h-3.5 w-3.5 fill-current" />
                          ) : (
                            <Music2 className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">Musical</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {showScript && currentTrack && (
            <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950 text-white">
              <div className="border-b border-slate-800 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`text-xs font-black uppercase tracking-[0.16em] ${playbackMode === "musical" ? "text-violet-400" : "text-cyan-400"}`}>
                    {playbackMode === "musical" ? "Musical Recall · synced lyrics" : "Live script"}
                  </div>
                  {playbackMode === "musical" && currentTrack.musicalRecall?.alignmentEngine && (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">
                      word sync {Math.round((currentTrack.musicalRecall.matchRate ?? currentTrack.musicalRecall.alignmentConfidence ?? 0) * 100)}%
                    </span>
                  )}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-bold text-slate-300">{displayText(currentTrack.title)}</div>
              </div>
              <div className="max-h-[62vh] space-y-2 overflow-y-auto px-4 py-5 sm:px-6">
                {currentCues.map((cue, index) => {
                  const active = index === activeCueIndex;
                  const passed = currentTime >= cue.end;
                  const questionWordCount =
                    playbackMode === "musical" && index === 0
                      ? getQuestionWordCount(currentTrack, cue)
                      : 0;
                  const activeWordIndex =
                    cue.words?.findIndex(
                      (word) => currentTime >= word.start && currentTime < word.end
                    ) ?? -1;
                  const effectiveRole: "question" | "answer" =
                    playbackMode === "musical" && index === 0 && activeWordIndex >= 0
                      ? activeWordIndex < questionWordCount
                        ? "question"
                        : "answer"
                      : cue.role;
                  return (
                    <button
                      key={`${cue.start}-${index}`}
                      ref={active ? activeCueRef : null}
                      type="button"
                      onClick={() => {
                        if (!audioRef.current) return;
                        audioRef.current.currentTime = cue.start;
                        setCurrentTime(cue.start);
                      }}
                      className={`block w-full rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold leading-7 transition sm:text-base ${
                        active
                          ? effectiveRole === "question"
                            ? "bg-amber-400/15 text-amber-50 ring-1 ring-amber-300/30"
                            : "bg-cyan-400/20 text-cyan-50 ring-1 ring-cyan-400/30"
                          : passed
                            ? "text-slate-500"
                            : "text-slate-300"
                      }`}
                    >
                      {playbackMode === "musical" || index === 0 || currentCues[index - 1]?.role !== cue.role ? (
                        <span
                          className={`mb-1 block text-[10px] font-black uppercase tracking-[0.16em] ${
                            playbackMode === "musical"
                              ? effectiveRole === "question"
                                ? "text-amber-300"
                                : "text-cyan-300"
                              : cue.role === "question"
                                ? "text-violet-400"
                                : "text-cyan-400"
                          }`}
                        >
                          {playbackMode === "musical"
                            ? effectiveRole === "question"
                                ? "Question · Interviewer"
                                : "Answer · Me"
                            : cue.role === "question"
                              ? "Question"
                              : "Answer"}
                        </span>
                      ) : null}
                      {playbackMode === "musical" && cue.words?.length ? (
                        <span className="leading-8">
                          {cue.words.map((word, wordIndex) => {
                            const wordActive = currentTime >= word.start && currentTime < word.end;
                            const wordPassed = currentTime >= word.end;
                            const wordRole: "question" | "answer" =
                              word.role ??
                              (index === 0 && wordIndex < questionWordCount ? "question" : "answer");
                            return (
                              <Fragment key={`${word.start}-${word.text}-${wordIndex}`}>
                                <span
                                  className={`inline-block rounded px-0.5 transition-all duration-100 ${
                                  wordActive
                                    ? wordRole === "question"
                                      ? "scale-110 bg-amber-300/10 font-black text-amber-100 [text-shadow:0_0_18px_rgba(251,191,36,.6)]"
                                      : "scale-110 bg-cyan-300/10 font-black text-cyan-50 [text-shadow:0_0_18px_rgba(103,232,249,.65)]"
                                    : wordPassed
                                      ? wordRole === "question"
                                        ? "text-amber-200/75"
                                        : "text-cyan-100/85"
                                      : wordRole === "question"
                                        ? "text-amber-200/35"
                                        : "text-slate-500"
                                  }`}
                                >
                                  {displayText(word.text)}
                                </span>
                                {wordIndex < cue.words!.length - 1 ? " " : null}
                              </Fragment>
                            );
                          })}
                        </span>
                      ) : displayText(cue.text)}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {currentTrack && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/98 text-white shadow-[0_-16px_40px_rgba(15,23,42,0.25)] backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            <audio
              ref={audioRef}
              key={`${currentTrack.trackId}:${playbackMode}:${currentSrc}`}
              src={currentSrc}
              preload="auto"
              onLoadedMetadata={() => {
                if (!audioRef.current) return;
                audioRef.current.playbackRate = rate;
                setMediaDuration(audioRef.current.duration || currentTrack.duration);
                if (autoPlayNextRef.current) {
                  autoPlayNextRef.current = false;
                  void audioRef.current.play();
                }
              }}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => moveTrack(1, true)}
            />

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {playbackMode === "musical" && (
                    <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-300">
                      Musical
                    </span>
                  )}
                  <div className="truncate text-sm font-black">{displayText(currentTrack.title)}</div>
                  {playbackMode === "musical" && currentTrack.musicalRecall && (
                    <Link
                      href={`/visual?track=${encodeURIComponent(currentTrack.id)}&lang=${currentTrack.language}#musical-recall-motion`}
                      className="hidden shrink-0 rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-violet-200 transition hover:bg-violet-400/20 sm:inline-flex"
                    >
                      Motion lyrics
                    </Link>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                  {currentIndex + 1} / {orderedIds.length} · {currentTrack.category}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={() => moveTrack(-1)} className="rounded-full p-2 text-slate-300 hover:bg-slate-800" aria-label="이전 트랙">
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    if (audio.paused) void audio.play();
                    else audio.pause();
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-slate-950 ${
                    playbackMode === "musical" ? "bg-violet-300" : "bg-white"
                  }`}
                  aria-label={isPlaying ? "일시정지" : "재생"}
                >
                  {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </button>
                <button type="button" onClick={() => moveTrack(1)} className="rounded-full p-2 text-slate-300 hover:bg-slate-800" aria-label="다음 트랙">
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                {rates.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRate(value)}
                    className={`rounded-full px-2 py-1 text-[11px] font-black ${
                      rate === value
                        ? playbackMode === "musical"
                          ? "bg-violet-300 text-slate-950"
                          : "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="w-9 text-right text-[10px] font-bold text-slate-500">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, currentDuration)}
                step={0.05}
                value={Math.min(currentTime, currentDuration)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (audioRef.current) audioRef.current.currentTime = value;
                  setCurrentTime(value);
                }}
                className={`h-1 flex-1 cursor-pointer ${
                  playbackMode === "musical" ? "accent-violet-300" : "accent-cyan-400"
                }`}
                aria-label="재생 위치"
              />
              <span className="w-9 text-[10px] font-bold text-slate-500">{formatTime(currentDuration)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
