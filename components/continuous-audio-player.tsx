"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Headphones,
  Languages,
  ListMusic,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PlaylistCue = {
  role: "question" | "answer";
  text: string;
  start: number;
  end: number;
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
};

type Section = "all" | PlaylistTrack["section"];
type Language = PlaylistTrack["language"];
type RepeatMode = "off" | "all" | "one";
type PriorityLevel = 0 | 1 | 2 | 3;

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

function matchesPriority(track: PlaylistTrack, level: PriorityLevel) {
  return priorityRank[track.priority] >= level;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  const [showScript, setShowScript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeCueRef = useRef<HTMLButtonElement>(null);
  const autoPlayNextRef = useRef(false);

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
    ? currentTrack.cues.findIndex(
        (cue) => currentTime >= cue.start && currentTime < cue.end
      )
    : -1;

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    if (!showScript || activeCueIndex < 0) return;
    activeCueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeCueIndex, showScript]);

  useEffect(() => {
    if (!currentTrack || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: "KAIST BTM Interview Prep",
      album: currentTrack.category,
    });
  }, [currentTrack]);

  const playTrack = useCallback((trackId: string) => {
    autoPlayNextRef.current = true;
    setCurrentTrackId(trackId);
    setCurrentTime(0);
  }, []);

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
      playTrack(orderedIds[nextIndex]);
    },
    [currentIndex, currentTrack, orderedIds, playTrack, repeatMode]
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
    setCurrentTrackId(first?.trackId ?? "");
    setCurrentTime(0);
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
    setCurrentTrackId(nextCurrent?.trackId ?? "");
    setCurrentTime(0);
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

            <div className="max-h-[62vh] overflow-y-auto">
              {orderedIds.map((trackId, index) => {
                const track = trackMap.get(trackId);
                if (!track) return null;
                const active = track.trackId === currentTrack?.trackId;
                return (
                  <button
                    key={track.trackId}
                    type="button"
                    onClick={() => playTrack(track.trackId)}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition sm:px-5 ${
                      active ? "bg-cyan-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className={`mt-0.5 w-7 shrink-0 text-center text-xs font-black ${active ? "text-cyan-600" : "text-slate-300"}`}>
                      {active && isPlaying ? "▶" : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`line-clamp-2 text-sm font-black leading-5 ${active ? "text-cyan-900" : "text-slate-800"}`}>
                        {track.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                        <span className="truncate">{track.category}</span>
                        <span>·</span>
                        <span className="shrink-0">{formatTime(track.duration)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {showScript && currentTrack && (
            <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950 text-white">
              <div className="border-b border-slate-800 px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-400">Live script</div>
                <div className="mt-1 line-clamp-2 text-sm font-bold text-slate-300">{currentTrack.title}</div>
              </div>
              <div className="max-h-[62vh] space-y-2 overflow-y-auto px-4 py-5 sm:px-6">
                {currentTrack.cues.map((cue, index) => {
                  const active = index === activeCueIndex;
                  const passed = currentTime >= cue.end;
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
                          ? cue.role === "question"
                            ? "bg-violet-400/20 text-violet-100 ring-1 ring-violet-400/30"
                            : "bg-cyan-400/20 text-cyan-50 ring-1 ring-cyan-400/30"
                          : passed
                            ? "text-slate-500"
                            : "text-slate-300"
                      }`}
                    >
                      {index === 0 || currentTrack.cues[index - 1]?.role !== cue.role ? (
                        <span className={`mb-1 block text-[10px] font-black uppercase tracking-[0.16em] ${cue.role === "question" ? "text-violet-400" : "text-cyan-400"}`}>
                          {cue.role === "question" ? "Question" : "Answer"}
                        </span>
                      ) : null}
                      {cue.text}
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
              key={currentTrack.src}
              src={currentTrack.src}
              preload="auto"
              onLoadedMetadata={() => {
                if (!audioRef.current) return;
                audioRef.current.playbackRate = rate;
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
                <div className="truncate text-sm font-black">{currentTrack.title}</div>
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
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950"
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
                    className={`rounded-full px-2 py-1 text-[11px] font-black ${rate === value ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-slate-800"}`}
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
                max={Math.max(0.1, currentTrack.duration)}
                step={0.05}
                value={Math.min(currentTime, currentTrack.duration)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (audioRef.current) audioRef.current.currentTime = value;
                  setCurrentTime(value);
                }}
                className="h-1 flex-1 cursor-pointer accent-cyan-400"
                aria-label="재생 위치"
              />
              <span className="w-9 text-[10px] font-bold text-slate-500">{formatTime(currentTrack.duration)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
