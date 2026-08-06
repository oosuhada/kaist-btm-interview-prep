"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Pause,
  Play,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MusicalVisualWord = {
  text: string;
  start: number;
  end: number;
  role?: "question" | "answer";
  confidence?: number;
  matched?: boolean;
};

export type MusicalVisualCue = {
  section?: string;
  start: number;
  end: number;
  text: string;
  role: "question" | "answer";
  words?: MusicalVisualWord[];
};

export type MusicalVisualTrack = {
  trackId: string;
  audioTrackId: string;
  language: "ko" | "en";
  src: string;
  duration: number;
  style: "A" | "B" | "C";
  title: string;
  category: string;
  question: string;
  cues: MusicalVisualCue[];
  alignmentEngine?: string;
  alignmentConfidence?: number;
  matchRate?: number;
};

const musicalRecallPriorityOrder = [
  "application-opening-60",
  "application-opening-30",
  "application-q5",
  "defense-tom-fit",
  "research-1",
  "research-3",
  "application-q7",
  "application-q39",
  "application-q40",
  "application-q41",
  "application-q32",
  "application-extra-101",
  "application-q62",
  "application-q4",
  "application-q63",
  "application-q46",
  "application-extra-102",
  "application-extra-103",
  "application-q47",
  "application-q51",
  "application-q56",
  "application-extra-106",
  "application-extra-115",
  "application-q44",
  "application-extra-120",
] as const;

const musicalRecallPriority = new Map<string, number>(
  musicalRecallPriorityOrder.map((trackId, index) => [trackId, index])
);

function compareMusicalRecallPriority(a: MusicalVisualTrack, b: MusicalVisualTrack) {
  const aRank = musicalRecallPriority.get(a.trackId) ?? Number.MAX_SAFE_INTEGER;
  const bRank = musicalRecallPriority.get(b.trackId) ?? Number.MAX_SAFE_INTEGER;
  return aRank - bRank || a.title.localeCompare(b.title);
}

type LyricLine = {
  id: string;
  start: number;
  end: number;
  text: string;
  words: MusicalVisualWord[];
};

function normalizeToken(value: string) {
  return value.replace(/[^\p{L}\p{N}+#]/gu, "").toLowerCase();
}

function displayText(value: string) {
  return value
    .replaceAll("Oosu Saloin", "Oosu Salon")
    .replace(/\bSaloin\b/g, "Salon");
}

function questionTokenCount(track: MusicalVisualTrack, cue: MusicalVisualCue) {
  const cueTextBeforeQuestionMark = cue.text.match(/^.*?[?？]/)?.[0];
  const source = cueTextBeforeQuestionMark ?? track.question;
  const tokens = source
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
  return Math.min(tokens.length, cue.words?.length ?? tokens.length);
}

function resolvedWordRole(
  track: MusicalVisualTrack,
  cue: MusicalVisualCue,
  cueIndex: number,
  word: MusicalVisualWord,
  wordIndex: number
) {
  if (word.role) return word.role;
  if (cueIndex !== 0) return cue.role;
  return wordIndex < questionTokenCount(track, cue) ? "question" : "answer";
}

function buildAnswerLines(track: MusicalVisualTrack): LyricLine[] {
  const maxWords = track.language === "ko" ? 6 : 9;
  const minWordsBeforePunctuationBreak = track.language === "ko" ? 3 : 4;
  const lines: LyricLine[] = [];

  track.cues.forEach((cue, cueIndex) => {
    const answerWords = (cue.words ?? []).filter(
      (word, wordIndex) => resolvedWordRole(track, cue, cueIndex, word, wordIndex) === "answer"
    );
    if (!answerWords.length) return;

    let buffer: MusicalVisualWord[] = [];
    const flush = () => {
      if (!buffer.length) return;
      const first = buffer[0];
      const last = buffer[buffer.length - 1];
      lines.push({
        id: `${cueIndex}:${first.start}:${last.end}`,
        start: first.start,
        end: last.end,
        text: buffer.map((word) => word.text).join(" "),
        words: buffer,
      });
      buffer = [];
    };

    answerWords.forEach((word, index) => {
      const previous = answerWords[index - 1];
      if (previous && word.start - previous.end > 1.35 && buffer.length >= 2) flush();
      buffer.push(word);

      const punctuation = /[.!?。！？,;:]$/.test(word.text);
      const longEnoughForPunctuation = buffer.length >= minWordsBeforePunctuationBreak;
      if (buffer.length >= maxWords || (punctuation && longEnoughForPunctuation)) flush();
    });
    flush();
  });

  return lines;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MusicalRecallVisualizer({
  tracks,
  initialTrackId,
  initialLanguage,
  onClose,
}: {
  tracks: MusicalVisualTrack[];
  initialTrackId?: string;
  initialLanguage?: "ko" | "en";
  onClose?: () => void;
}) {
  const resolvedInitialLanguage =
    initialLanguage ?? tracks.find((track) => track.trackId === initialTrackId)?.language ?? "ko";
  const [language, setLanguage] = useState<"ko" | "en">(resolvedInitialLanguage);
  const languageTracks = useMemo(
    () =>
      tracks
        .filter((track) => track.language === language)
        .sort(compareMusicalRecallPriority),
    [language, tracks]
  );
  const [currentTrackId, setCurrentTrackId] = useState(() =>
    tracks.find(
      (track) =>
        track.trackId === initialTrackId &&
        track.language === resolvedInitialLanguage
    )?.trackId ??
    [...tracks]
      .filter((track) => track.language === resolvedInitialLanguage)
      .sort(compareMusicalRecallPriority)[0]?.trackId ??
    tracks[0]?.trackId ??
    ""
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const currentTrack =
    languageTracks.find((track) => track.trackId === currentTrackId) ?? languageTracks[0] ?? null;
  const trackIndex = currentTrack
    ? languageTracks.findIndex((track) => track.trackId === currentTrack.trackId)
    : 0;
  const answerLines = useMemo(
    () => (currentTrack ? buildAnswerLines(currentTrack) : []),
    [currentTrack]
  );
  const activeLineIndex = useMemo(() => {
    if (!answerLines.length) return -1;
    const exact = answerLines.findIndex(
      (line) => currentTime >= line.start && currentTime < line.end
    );
    if (exact >= 0) return exact;
    const previous = answerLines.reduce(
      (best, line, index) => (line.start <= currentTime ? index : best),
      -1
    );
    return previous >= 0 ? previous : 0;
  }, [answerLines, currentTime]);
  const firstAnswerStart = answerLines[0]?.start ?? Number.POSITIVE_INFINITY;
  const questionActive = currentTime < firstAnswerStart;
  const previousLine = activeLineIndex > 0 ? answerLines[activeLineIndex - 1] : null;
  const currentLine = activeLineIndex >= 0 ? answerLines[activeLineIndex] : null;
  const nextLine =
    activeLineIndex >= 0 && activeLineIndex < answerLines.length - 1
      ? answerLines[activeLineIndex + 1]
      : null;
  const motionVariant = Math.max(0, activeLineIndex) % 4;

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioContextRef.current) {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
  }, []);

  const drawFrame = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const audio = audioRef.current;
    if (!analyser || !canvas || !audio) return;

    setCurrentTime(audio.currentTime);
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const bands = 36;
    const sampleSize = Math.max(1, Math.floor(data.length / bands));
    const values = Array.from({ length: bands }, (_, band) => {
      let sum = 0;
      for (let offset = 0; offset < sampleSize; offset += 1) {
        sum += data[band * sampleSize + offset] ?? 0;
      }
      return sum / sampleSize / 255;
    });
    const lowEnergy = values.slice(0, 10).reduce((sum, value) => sum + value, 0) / 10;
    const totalEnergy = values.reduce((sum, value) => sum + value, 0) / values.length;
    stage?.style.setProperty("--music-energy", String(Math.max(0.04, totalEnergy)));
    stage?.style.setProperty("--bass-energy", String(Math.max(0.04, lowEnergy)));

    context.clearRect(0, 0, width, height);
    const gradient = context.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, "rgba(76,29,149,0.02)");
    gradient.addColorStop(0.55, "rgba(34,211,238,0.13)");
    gradient.addColorStop(1, "rgba(196,181,253,0.30)");
    context.fillStyle = gradient;
    const gap = 5 * dpr;
    const barWidth = Math.max(2 * dpr, (width - gap * (bands - 1)) / bands);
    values.forEach((value, index) => {
      const shaped = Math.pow(value, 1.6);
      const barHeight = Math.max(1.5 * dpr, shaped * height * 0.42);
      const x = index * (barWidth + gap);
      context.globalAlpha = 0.08 + shaped * 0.42;
      context.beginPath();
      context.roundRect(
        x,
        height - barHeight,
        barWidth,
        barHeight,
        Math.min(barWidth / 2, 7 * dpr)
      );
      context.fill();
    });
    context.globalAlpha = 1;
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (now - lastPaint >= 32) {
        lastPaint = now;
        drawFrame();
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [drawFrame, isPlaying]);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
    },
    []
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    await ensureAudioGraph();
    if (audio.paused) await audio.play();
    else audio.pause();
  }, [currentTrack, ensureAudioGraph]);

  const selectTrack = useCallback((trackId: string, autoplay = false) => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setCurrentTrackId(trackId);
    setCurrentTime(0);
    if (autoplay) {
      window.setTimeout(() => {
        void ensureAudioGraph().then(() => audioRef.current?.play());
      }, 40);
    }
  }, [ensureAudioGraph]);

  const moveTrack = useCallback(
    (direction: 1 | -1, autoplay = isPlaying) => {
      if (!languageTracks.length) return;
      const nextIndex = (trackIndex + direction + languageTracks.length) % languageTracks.length;
      selectTrack(languageTracks[nextIndex].trackId, autoplay);
    },
    [isPlaying, languageTracks, selectTrack, trackIndex]
  );

  const changeLanguage = (nextLanguage: "ko" | "en") => {
    if (nextLanguage === language) return;
    const sameTrack = tracks.find(
      (track) => track.language === nextLanguage && track.trackId === currentTrackId
    );
    const nextTrack = sameTrack ?? tracks.find((track) => track.language === nextLanguage);
    audioRef.current?.pause();
    setLanguage(nextLanguage);
    setCurrentTrackId(nextTrack?.trackId ?? "");
    setCurrentTime(0);
  };

  if (!currentTrack) return null;

  return (
    <section
      id="musical-recall-motion"
      className="overflow-hidden rounded-[28px] border border-slate-800 bg-[#050711] text-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="text-xs font-black tracking-[0.14em] text-violet-300">
            MUSICAL RECALL · MOTION LYRICS
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-white/55">
            {String(trackIndex + 1).padStart(2, "0")} / {String(languageTracks.length).padStart(2, "0")} · {displayText(currentTrack.title)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">
            {(["ko", "en"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeLanguage(item)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-black transition ${
                  language === item ? "bg-white text-slate-950" : "text-white/45 hover:text-white"
                }`}
              >
                {item === "ko" ? "한국어" : "English"}
              </button>
            ))}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/10 hover:text-white"
              aria-label="Musical Recall 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={stageRef}
        className="visual-music-stage relative min-h-[600px] overflow-hidden [--bass-energy:0.08] [--music-energy:0.08]"
      >
        <audio
          ref={audioRef}
          src={currentTrack.src}
          preload="metadata"
          onPlay={() => {
            setIsPlaying(true);
            void ensureAudioGraph();
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => moveTrack(1, true)}
          onLoadedMetadata={(event) =>
            setCurrentTime(Math.min(event.currentTarget.currentTime, event.currentTarget.duration || 0))
          }
          onTimeUpdate={(event) => {
            if (!isPlaying) setCurrentTime(event.currentTarget.currentTime);
          }}
        />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(124,58,237,.16),transparent_36%),radial-gradient(circle_at_22%_75%,rgba(34,211,238,.08),transparent_30%),linear-gradient(180deg,#050711_0%,#080b17_100%)]" />
        <div className="visual-music-aurora visual-music-aurora-a pointer-events-none absolute h-[430px] w-[430px] rounded-full bg-violet-500/14 blur-[110px]" />
        <div className="visual-music-aurora visual-music-aurora-b pointer-events-none absolute h-[390px] w-[390px] rounded-full bg-cyan-400/10 blur-[110px]" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] w-full opacity-70"
        />

        <div className="relative z-10 flex min-h-[600px] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
          <div className="mx-auto w-full max-w-5xl text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/70">
              Question
            </div>
            <div
              className={`mx-auto mt-2 max-w-4xl text-balance text-lg font-black leading-7 transition-all duration-500 sm:text-2xl sm:leading-8 ${
                questionActive
                  ? "scale-[1.02] text-amber-100 [text-shadow:0_0_22px_rgba(251,191,36,.25)]"
                  : "text-white/45"
              }`}
            >
              {displayText(currentTrack.question)}
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-10 text-center sm:py-12">
            <div className="min-h-8 text-sm font-bold leading-6 text-white/22 sm:text-base">
              {displayText(previousLine?.text ?? "")}
            </div>

            <div
              key={`${currentTrack.trackId}:${activeLineIndex}`}
              className={`visual-answer-line visual-answer-line-${motionVariant} mx-auto my-5 max-w-5xl text-balance text-[clamp(2rem,5.2vw,4.9rem)] font-black leading-[1.06] tracking-[-0.045em] text-white`}
            >
              {currentLine
                ? currentLine.words.map((word, wordIndex) => {
                    const active = currentTime >= word.start && currentTime < word.end;
                    const passed = currentTime >= word.end;
                    const activeMotion = wordIndex % 4;
                    return (
                      <Fragment key={`${word.start}:${word.text}:${wordIndex}`}>
                        <span
                          className={`visual-karaoke-word inline-block px-[0.07em] transition-colors duration-150 ${
                          active
                            ? `visual-karaoke-word-active visual-word-motion-${activeMotion} text-cyan-100 [text-shadow:0_0_28px_rgba(103,232,249,.45)]`
                            : passed
                              ? "text-white"
                              : "text-white/30"
                          }`}
                        >
                          {displayText(word.text)}
                        </span>
                        {wordIndex < currentLine.words.length - 1 ? " " : null}
                      </Fragment>
                    );
                  })
                : ""}
            </div>

            <div className="min-h-8 text-sm font-bold leading-6 text-white/30 sm:text-base">
              {displayText(nextLine?.text ?? "")}
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl sm:p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => moveTrack(-1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="이전 Musical Recall"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void togglePlay()}
                className="visual-music-play flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 transition hover:scale-105"
                aria-label={isPlaying ? "일시정지" : "재생"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={() => moveTrack(1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="다음 Musical Recall"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <input
                  type="range"
                  min={0}
                  max={currentTrack.duration || 1}
                  step={0.05}
                  value={Math.min(currentTime, currentTrack.duration || 0)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (audioRef.current) audioRef.current.currentTime = value;
                    setCurrentTime(value);
                  }}
                  className="h-1.5 w-full cursor-pointer accent-violet-300"
                  aria-label="Musical Recall 재생 위치"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] font-bold tabular-nums text-white/30">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(currentTrack.duration)}</span>
                </div>
              </div>

              <select
                value={currentTrack.trackId}
                onChange={(event) => selectTrack(event.target.value, isPlaying)}
                className="hidden max-w-[230px] rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-white/70 outline-none sm:block"
                aria-label="Musical Recall 트랙 선택"
              >
                {languageTracks.map((track, index) => (
                  <option key={track.trackId} value={track.trackId}>
                    {String(index + 1).padStart(2, "0")} · {displayText(track.title)}
                  </option>
                ))}
              </select>

              <Link
                href={`/audio?track=${encodeURIComponent(currentTrack.audioTrackId)}`}
                className="hidden h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black text-white/45 transition hover:bg-white/10 hover:text-white md:flex"
              >
                <Headphones className="h-3.5 w-3.5" /> Audio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
