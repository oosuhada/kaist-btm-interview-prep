"use client";

import Link from "next/link";
import {
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Lightbulb,
  Pause,
  Play,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MusicalVisualCue = {
  section?: string;
  start: number;
  end: number;
  text: string;
  role: "question" | "answer";
  words?: Array<{
    text: string;
    start: number;
    end: number;
    role?: "question" | "answer";
    confidence?: number;
    matched?: boolean;
  }>;
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

const englishStopWords = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "being", "but", "can",
  "could", "did", "does", "for", "from", "had", "has", "have", "how", "into", "its", "more",
  "most", "not", "our", "rather", "that", "the", "their", "them", "then", "there", "these", "they",
  "this", "through", "was", "were", "what", "when", "where", "which", "while", "with", "would", "your",
]);

const koreanStopWords = new Set([
  "그리고", "그래서", "하지만", "때문에", "있습니다", "했습니다", "합니다", "것입니다", "것이라고", "저는",
  "제가", "이것은", "이런", "이렇게", "대한", "통해서", "에서는", "으로", "라고", "하는", "있는", "같은",
]);

function splitPhrases(text: string) {
  const phrases = text
    .replace(/\s*\([^)]{1,80}\)\s*/g, " ")
    .split(/(?<=[.!?。！？])\s+|\s*[·•]\s*|\s*[,;:]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
  if (phrases.length > 1) return phrases.slice(0, 8);

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 8) return [text.trim()];
  const chunkSize = Math.max(4, Math.ceil(words.length / 4));
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push(words.slice(index, index + chunkSize).join(" "));
  }
  return chunks.slice(0, 6);
}

function extractKeywords(text: string, language: "ko" | "en") {
  const raw = text
    .replace(/[“”"'‘’()[\]{}.,!?;:]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const scored = raw
    .map((token, index) => {
      const clean = token.replace(/[^\p{L}\p{N}+#·-]/gu, "");
      const lower = clean.toLowerCase();
      const isAcronym = /^[A-Z][A-Z0-9+.-]{1,}$/.test(clean) || /[A-Z].*[A-Z]/.test(clean);
      const isKnown = /RAG|KAIST|BTM|GfK|AskOosu|AI|UX|CSCW|HCI/i.test(clean);
      const valid =
        clean.length >= (language === "ko" ? 2 : 4) &&
        !(language === "ko" ? koreanStopWords.has(clean) : englishStopWords.has(lower));
      return {
        token: clean,
        index,
        score: (isKnown ? 9 : 0) + (isAcronym ? 6 : 0) + Math.min(5, clean.length / 3) + (index < 10 ? 1 : 0),
        valid,
      };
    })
    .filter((item) => item.valid && item.token);

  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = item.token.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((item) => item.token);
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function countLexicalTokens(text: string) {
  return (
    text.match(/[\p{L}\p{N}+#’'.-]+/gu)?.filter((token) =>
      token.replace(/[^\p{L}\p{N}+#]/gu, "").length > 0
    ).length ?? 0
  );
}

function getQuestionWordCount(track: MusicalVisualTrack, cue: MusicalVisualCue | null) {
  if (!cue) return 0;
  const questionMark = cue.text.search(/[?？]/);
  const count =
    questionMark >= 0
      ? countLexicalTokens(cue.text.slice(0, questionMark + 1))
      : countLexicalTokens(track.question);
  return Math.min(count, cue.words?.length ?? count);
}

export function MusicalRecallVisualizer({
  tracks,
  initialTrackId,
  initialLanguage,
}: {
  tracks: MusicalVisualTrack[];
  initialTrackId?: string;
  initialLanguage?: "ko" | "en";
}) {
  const resolvedInitialLanguage =
    initialLanguage ?? tracks.find((track) => track.trackId === initialTrackId)?.language ?? "ko";
  const [language, setLanguage] = useState<"ko" | "en">(resolvedInitialLanguage);
  const languageTracks = useMemo(() => tracks.filter((track) => track.language === language), [language, tracks]);
  const [currentTrackId, setCurrentTrackId] = useState(() =>
    tracks.find(
      (track) =>
        track.trackId === initialTrackId &&
        track.language === resolvedInitialLanguage
    )?.trackId ??
    tracks.find((track) => track.language === resolvedInitialLanguage)?.trackId ??
    tracks[0]?.trackId ??
    ""
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [activePhraseIndex, setActivePhraseIndex] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef(0);

  const currentTrack =
    languageTracks.find((track) => track.trackId === currentTrackId) ?? languageTracks[0] ?? null;
  const trackIndex = currentTrack ? languageTracks.findIndex((track) => track.trackId === currentTrack.trackId) : 0;
  const activeCue = currentTrack?.cues[activeCueIndex] ?? currentTrack?.cues[0] ?? null;
  const phrases = useMemo(() => (activeCue ? splitPhrases(activeCue.text) : []), [activeCue]);
  const activePhrase = phrases[Math.min(activePhraseIndex, Math.max(0, phrases.length - 1))] ?? activeCue?.text ?? "";
  const cueWords = activeCue?.words ?? [];
  const lyricChunkSize = language === "ko" ? 4 : 6;
  const activeWordChunk = Math.floor(Math.max(0, activeWordIndex) / lyricChunkSize);
  const activeLyricWords = cueWords.length
    ? cueWords.slice(activeWordChunk * lyricChunkSize, activeWordChunk * lyricChunkSize + lyricChunkSize)
    : [];
  const questionWordCount = currentTrack
    ? getQuestionWordCount(currentTrack, currentTrack.cues[0] ?? null)
    : 0;
  const alignedActiveWordRole = cueWords[activeWordIndex]?.role;
  const activeRole: "question" | "answer" =
    alignedActiveWordRole ??
    (activeCueIndex === 0 && cueWords.length > 0
      ? activeWordIndex < questionWordCount
        ? "question"
        : "answer"
      : activeCue?.role ?? "answer");
  const isQuestion = activeRole === "question";
  const keywords = useMemo(() => extractKeywords(activeCue?.text ?? currentTrack?.question ?? "", language), [activeCue?.text, currentTrack?.question, language]);

  const stopVisualizer = useCallback(() => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const drawVisualizer = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    const stage = stageRef.current;
    if (!analyser || !canvas || !audio) return;

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
    const bands = 44;
    const sampleSize = Math.max(1, Math.floor(data.length / bands));
    const values = Array.from({ length: bands }, (_, band) => {
      let sum = 0;
      for (let offset = 0; offset < sampleSize; offset += 1) sum += data[band * sampleSize + offset] ?? 0;
      return sum / sampleSize / 255;
    });
    const lowEnergy = values.slice(0, 12).reduce((sum, value) => sum + value, 0) / 12;
    const totalEnergy = values.reduce((sum, value) => sum + value, 0) / values.length;
    stage?.style.setProperty("--music-energy", String(Math.max(0.04, totalEnergy)));
    stage?.style.setProperty("--bass-energy", String(Math.max(0.04, lowEnergy)));

    context.clearRect(0, 0, width, height);
    const gradient = context.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, "rgba(139,92,246,0.05)");
    gradient.addColorStop(0.55, "rgba(34,211,238,0.36)");
    gradient.addColorStop(1, "rgba(244,114,182,0.78)");
    context.fillStyle = gradient;
    const gap = 4 * dpr;
    const barWidth = Math.max(2 * dpr, (width - gap * (bands - 1)) / bands);
    values.forEach((value, index) => {
      const shaped = Math.pow(value, 1.45);
      const barHeight = Math.max(2 * dpr, shaped * height * 0.54);
      const x = index * (barWidth + gap);
      context.globalAlpha = 0.18 + shaped * 0.82;
      context.beginPath();
      context.roundRect(x, height - barHeight, barWidth, barHeight, Math.min(barWidth / 2, 8 * dpr));
      context.fill();
    });
    context.globalAlpha = 1;

    const now = performance.now();
    if (now - lastUiUpdateRef.current > 75) {
      lastUiUpdateRef.current = now;
      const time = audio.currentTime;
      setCurrentTime(time);
      if (currentTrack) {
        const cueIndex = currentTrack.cues.findIndex((cue) => time >= cue.start && time < cue.end);
        const previousCueIndex = currentTrack.cues.reduce(
          (best, cue, index) => (cue.start <= time ? index : best),
          0
        );
        const resolvedCueIndex = cueIndex >= 0 ? cueIndex : previousCueIndex;
        setActiveCueIndex((previous) => (previous === resolvedCueIndex ? previous : resolvedCueIndex));
        const cue = currentTrack.cues[resolvedCueIndex];
        if (cue) {
          const wordIndex = cue.words?.findIndex((word) => time >= word.start && time < word.end) ?? -1;
          if (wordIndex >= 0) {
            setActiveWordIndex((previous) => (previous === wordIndex ? previous : wordIndex));
          } else if (cue.words?.length) {
            const nearest = cue.words.reduce((best, word, index) => {
              const distance = Math.min(Math.abs(time - word.start), Math.abs(time - word.end));
              return distance < best.distance ? { index, distance } : best;
            }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
            setActiveWordIndex((previous) => (previous === nearest ? previous : nearest));
          }
          const cuePhrases = splitPhrases(cue.text);
          const progress = Math.min(0.999, Math.max(0, (time - cue.start) / Math.max(0.5, cue.end - cue.start)));
          const phraseIndex = Math.min(cuePhrases.length - 1, Math.floor(progress * cuePhrases.length));
          setActivePhraseIndex((previous) => (previous === phraseIndex ? previous : phraseIndex));
        }
      }
    }

    animationRef.current = window.requestAnimationFrame(drawVisualizer);
  }, [currentTrack]);

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioContextRef.current) {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.84;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
    if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
    if (animationRef.current === null) animationRef.current = window.requestAnimationFrame(drawVisualizer);
  }, [drawVisualizer]);

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
    setActiveCueIndex(0);
    setActivePhraseIndex(0);
    setActiveWordIndex(0);
    if (autoplay) {
      window.setTimeout(() => {
        void ensureAudioGraph().then(() => audioRef.current?.play());
      }, 30);
    }
  }, [ensureAudioGraph]);

  const moveTrack = useCallback((direction: 1 | -1, autoplay = isPlaying) => {
    if (!languageTracks.length) return;
    const nextIndex = (trackIndex + direction + languageTracks.length) % languageTracks.length;
    selectTrack(languageTracks[nextIndex].trackId, autoplay);
  }, [isPlaying, languageTracks, selectTrack, trackIndex]);

  useEffect(() => {
    const next = tracks.find((track) => track.language === language && track.trackId === currentTrackId)
      ?? tracks.find((track) => track.language === language);
    if (next && next.trackId !== currentTrackId) selectTrack(next.trackId, false);
  }, [currentTrackId, language, selectTrack, tracks]);

  useEffect(() => () => {
    stopVisualizer();
    void audioContextRef.current?.close();
  }, [stopVisualizer]);

  if (!currentTrack) return null;

  const cueProgress = activeCue
    ? Math.min(1, Math.max(0, (currentTime - activeCue.start) / Math.max(0.5, activeCue.end - activeCue.start)))
    : 0;
  const songProgress = Math.min(1, Math.max(0, currentTime / Math.max(1, currentTrack.duration)));
  const keywordPositions = [
    "left-[3%] top-[18%] -rotate-6",
    "right-[4%] top-[16%] rotate-6",
    "left-[8%] top-[44%] rotate-3",
    "right-[7%] top-[46%] -rotate-3",
    "left-[5%] bottom-[20%] -rotate-3",
    "right-[5%] bottom-[18%] rotate-3",
    "left-[23%] bottom-[8%] rotate-2",
    "right-[23%] bottom-[7%] -rotate-2",
  ];

  return (
    <section id="musical-recall-motion" className="mb-6 scroll-mt-24 overflow-hidden rounded-[32px] border border-violet-200/70 bg-white shadow-[0_24px_70px_rgba(76,29,149,0.09)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">
            <Sparkles className="h-3.5 w-3.5" /> Musical Recall · Motion Lyrics
          </div>
          <div className="mt-1 text-sm font-bold text-slate-500">노래를 듣는 동시에 가사·키워드·파형을 하나의 장면으로 기억합니다.</div>
        </div>
        <div className="flex items-center gap-2">
          {(["ko", "en"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLanguage(item)}
              className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                language === item ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-400"
              }`}
            >
              {item === "ko" ? "한국어" : "English"}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={stageRef}
        className="visual-music-stage relative min-h-[510px] overflow-hidden bg-[#050711] text-white [--bass-energy:0.08] [--music-energy:0.08]"
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
          onLoadedMetadata={(event) => setCurrentTime(Math.min(event.currentTarget.currentTime, event.currentTarget.duration || 0))}
        />

        <div
          className={`pointer-events-none absolute inset-0 transition-colors duration-700 ${
            isQuestion
              ? "bg-[radial-gradient(circle_at_50%_35%,rgba(251,191,36,.16),transparent_42%),linear-gradient(135deg,rgba(244,63,94,.10),transparent_55%)]"
              : "bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,.13),transparent_42%),linear-gradient(135deg,rgba(139,92,246,.12),transparent_55%)]"
          }`}
        />
        <div className={`visual-music-aurora visual-music-aurora-a pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-[95px] ${isQuestion ? "bg-rose-500/25" : "bg-violet-500/25"}`} />
        <div className={`visual-music-aurora visual-music-aurora-b pointer-events-none absolute h-[380px] w-[380px] rounded-full blur-[100px] ${isQuestion ? "bg-amber-400/18" : "bg-cyan-400/20"}`} />
        <div className={`visual-music-aurora visual-music-aurora-c pointer-events-none absolute h-[330px] w-[330px] rounded-full blur-[90px] ${isQuestion ? "bg-orange-500/15" : "bg-pink-500/15"}`} />
        <div className="visual-cinema-grid pointer-events-none absolute inset-0 opacity-20" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] w-full opacity-90" />
        <div
          key={`${currentTrack.trackId}-${activeRole}`}
          className={`visual-role-ghost pointer-events-none absolute right-[3%] top-1/2 -translate-y-1/2 select-none text-[clamp(12rem,31vw,28rem)] font-black leading-none tracking-[-0.09em] ${
            isQuestion ? "text-amber-200/[0.035]" : "text-cyan-200/[0.035]"
          }`}
          aria-hidden="true"
        >
          {isQuestion ? "Q" : "A"}
        </div>

        {keywords.map((keyword, index) => (
          <div
            key={`${activeCueIndex}-${keyword}`}
            className={`visual-music-keyword pointer-events-none absolute hidden ${keywordPositions[index]} rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black tracking-[0.12em] text-white/45 backdrop-blur md:block`}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            {keyword}
          </div>
        ))}

        <div className="relative z-10 flex min-h-[510px] flex-col justify-between p-5 sm:p-7 lg:p-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-white/55">
                  TRACK {String(trackIndex + 1).padStart(2, "0")} / {String(languageTracks.length).padStart(2, "0")}
                </span>
                <span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-300/10 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-fuchsia-200">
                  STYLE {currentTrack.style}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-cyan-200">
                  <Waves className="h-3 w-3" /> LIVE AUDIO REACTIVE
                </span>
                {currentTrack.alignmentEngine && (
                  <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black tracking-[0.12em] text-emerald-200">
                    WORD SYNC · {Math.round((currentTrack.matchRate ?? currentTrack.alignmentConfidence ?? 0) * 100)}%
                  </span>
                )}
              </div>
              <div className="mt-3 max-w-2xl truncate text-sm font-black text-white/90 sm:text-base">{currentTrack.title}</div>
              <div className={`mt-2 flex max-w-3xl items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold leading-5 transition-colors ${
                isQuestion
                  ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
                  : "border-white/10 bg-black/20 text-white/45"
              }`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${isQuestion ? "bg-amber-300 text-slate-950" : "bg-white/10 text-white/55"}`}>Q</span>
                <span>{currentTrack.question}</span>
              </div>
            </div>
            <Link
              href={`/audio?track=${encodeURIComponent(currentTrack.audioTrackId)}`}
              className="flex shrink-0 items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[10px] font-black text-white/60 backdrop-blur transition hover:bg-white/10 hover:text-white"
            >
              <Headphones className="h-3.5 w-3.5" /> Audio page
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-8 text-center">
            <div
              key={`${currentTrack.trackId}-${activeRole}-disc`}
              className={`visual-role-switch visual-music-disc mb-5 flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur ${
                isQuestion
                  ? "border-amber-300/30 bg-amber-300/10 shadow-[0_0_80px_rgba(251,191,36,0.22)]"
                  : "border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_80px_rgba(34,211,238,0.18)]"
              }`}
            >
              {isQuestion ? <CircleHelp className="h-9 w-9 text-amber-200" /> : <Lightbulb className="h-9 w-9 text-cyan-200" />}
            </div>
            <div
              key={`${currentTrack.trackId}-${activeRole}-label`}
              className={`visual-role-switch rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] ${
                isQuestion
                  ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                  : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
              }`}
            >
              {isQuestion ? "QUESTION · 면접관" : "ANSWER · 나"}
            </div>
            {!isQuestion && (
              <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                {activeCue?.section ?? `LYRIC ${activeCueIndex + 1}`} · RESPONSE FLOW
              </div>
            )}
            <div key={`${currentTrack.trackId}-${activeCueIndex}-${activeWordChunk}-${activePhraseIndex}`} className="visual-lyric-pop mt-4 max-w-4xl text-balance text-[clamp(1.75rem,4.7vw,4.3rem)] font-black leading-[1.05] tracking-[-0.05em] text-white">
              {activeLyricWords.length > 0
                ? activeLyricWords.map((word, index) => {
                    const active = currentTime >= word.start && currentTime < word.end;
                    const passed = currentTime >= word.end;
                    const absoluteWordIndex = activeWordChunk * lyricChunkSize + index;
                    const wordRole: "question" | "answer" =
                      word.role ??
                      (activeCueIndex === 0 && absoluteWordIndex < questionWordCount ? "question" : "answer");
                    return (
                      <span
                        key={`${word.start}-${word.text}-${index}`}
                        className={`visual-karaoke-word inline-block px-[0.08em] transition-all duration-150 ${
                          active
                            ? wordRole === "question"
                              ? "visual-karaoke-word-active text-amber-200 [text-shadow:0_0_30px_rgba(251,191,36,.5)]"
                              : "visual-karaoke-word-active text-cyan-200 [text-shadow:0_0_30px_rgba(103,232,249,.55)]"
                            : passed
                              ? "text-white"
                              : "text-white/32"
                        }`}
                      >
                        {word.text}{index < activeLyricWords.length - 1 ? " " : ""}
                      </span>
                    );
                  })
                : activePhrase}
            </div>
            <div className="mt-7 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ${
                  isQuestion
                    ? "bg-gradient-to-r from-rose-400 via-orange-300 to-amber-200"
                    : "bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300"
                }`}
                style={{ width: `${cueProgress * 100}%` }}
              />
            </div>
            <div className="mt-3 text-[10px] font-bold tabular-nums tracking-[0.12em] text-white/30">
              {cueWords.length > 0
                ? `WORD ${Math.min(activeWordIndex + 1, cueWords.length)} / ${cueWords.length}`
                : `PHRASE ${Math.min(activePhraseIndex + 1, Math.max(1, phrases.length))} / ${Math.max(1, phrases.length)}`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl sm:p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => moveTrack(-1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/10 hover:text-white"
                aria-label="이전 Musical Recall"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void togglePlay()}
                className="visual-music-play flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_0_40px_rgba(255,255,255,0.18)] transition hover:scale-105"
                aria-label={isPlaying ? "일시정지" : "재생"}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
              </button>
              <button
                type="button"
                onClick={() => moveTrack(1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/10 hover:text-white"
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

              <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black text-white/40 sm:flex">
                <Volume2 className="h-3.5 w-3.5" /> {Math.round(songProgress * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-slate-50/70 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
        {languageTracks.map((track, index) => {
          const active = track.trackId === currentTrack.trackId;
          return (
            <button
              key={track.trackId}
              type="button"
              onClick={() => selectTrack(track.trackId, isPlaying)}
              className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black transition ${
                active
                  ? "border-violet-300 bg-violet-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-700"
              }`}
              title={track.title}
            >
              {String(index + 1).padStart(2, "0")} · {track.title.length > 18 ? `${track.title.slice(0, 18)}…` : track.title}
            </button>
          );
        })}
      </div>
    </section>
  );
}
