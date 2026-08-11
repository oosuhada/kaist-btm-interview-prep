"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  Languages,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type LingoRecallItem = {
  id: string;
  rank: number;
  ko: { question: string; answer: string };
  en: { question: string; answer: string };
};

type Language = "ko" | "en";

type PoolToken = {
  id: string;
  text: string;
  position: number;
};

function displayText(value: string) {
  return value
    .replaceAll("Oosu Saloin", "Oosu Salon")
    .replace(/\bSaloin\b/g, "Salon");
}

function splitSentences(value: string) {
  const normalized = displayText(value).replace(/\s+/g, " ").trim();
  return (
    normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g)?.map((part) => part.trim()) ??
    [normalized]
  ).filter(Boolean);
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(values: T[], seedText: string) {
  const result = [...values];
  let seed = hashSeed(seedText) || 1;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function LingoRecallGame({ items }: { items: LingoRecallItem[] }) {
  const [language, setLanguage] = useState<Language>("en");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [wrongToken, setWrongToken] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState<string[]>([]);
  const [round, setRound] = useState(0);

  const item = items[questionIndex];
  const copy = item?.[language];
  const sentences = useMemo(() => (copy ? splitSentences(copy.answer) : []), [copy]);
  const sentence = sentences[sentenceIndex] ?? "";
  const tokens = useMemo<PoolToken[]>(
    () =>
      sentence
        .split(/\s+/)
        .filter(Boolean)
        .map((text, position) => ({ id: `${position}:${text}`, text, position })),
    [sentence]
  );
  const pool = useMemo(
    () => seededShuffle(tokens, `${item?.id}:${language}:${sentenceIndex}:${round}`),
    [item?.id, language, round, sentenceIndex, tokens]
  );

  const sentenceComplete = Boolean(tokens.length) && selectedCount >= tokens.length;
  const questionComplete = sentenceComplete && sentenceIndex >= sentences.length - 1;
  const progressUnits = items.reduce(
    (sum, recallItem) => sum + splitSentences(recallItem[language].answer).length,
    0
  );
  const completedUnits =
    items.slice(0, questionIndex).reduce(
      (sum, recallItem) => sum + splitSentences(recallItem[language].answer).length,
      0
    ) + sentenceIndex + (sentenceComplete ? 1 : 0);
  const progress = progressUnits ? Math.min(100, (completedUnits / progressUnits) * 100) : 0;

  useEffect(() => {
    setSentenceIndex(0);
    setSelectedCount(0);
    setWrongToken(null);
    setRound((value) => value + 1);
  }, [language]);

  const resetSentence = () => {
    setSelectedCount(0);
    setWrongToken(null);
    setRound((value) => value + 1);
  };

  const chooseToken = (token: PoolToken) => {
    if (sentenceComplete || token.position < selectedCount) return;
    if (token.position !== selectedCount) {
      setWrongToken(token.id);
      setMistakes((value) => value + 1);
      window.setTimeout(() => setWrongToken(null), 320);
      return;
    }
    setWrongToken(null);
    setSelectedCount((value) => value + 1);
  };

  const continueForward = () => {
    if (!sentenceComplete) return;
    if (questionComplete) {
      setCompletedQuestions((current) =>
        current.includes(item.id) ? current : [...current, item.id]
      );
      setStreak((value) => value + 1);
      setQuestionIndex((value) => (value + 1) % items.length);
      setSentenceIndex(0);
      setSelectedCount(0);
      setRound((value) => value + 1);
      return;
    }
    setSentenceIndex((value) => value + 1);
    setSelectedCount(0);
    setRound((value) => value + 1);
  };

  const moveQuestion = (direction: 1 | -1) => {
    setQuestionIndex((value) => (value + direction + items.length) % items.length);
    setSentenceIndex(0);
    setSelectedCount(0);
    setWrongToken(null);
    setRound((value) => value + 1);
  };

  if (!item || !copy) return null;

  return (
    <main className="min-h-screen bg-white text-slate-800 selection:bg-green-200">
      <header className="border-b-2 border-slate-100 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#58cc02] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm font-black text-orange-500"><Flame className="h-5 w-5 fill-current" /> {streak}</div>
          <div className="flex items-center gap-1 text-sm font-black text-rose-500"><Heart className="h-5 w-5 fill-current" /> {Math.max(0, 3 - Math.min(3, mistakes))}</div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-74px)] max-w-4xl flex-col px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[#58cc02]">Secret Recall · {questionIndex + 1}/{items.length}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">문장 {sentenceIndex + 1}/{Math.max(1, sentences.length)} · 단어를 순서대로 선택</div>
          </div>
          <div className="flex items-center gap-1 rounded-xl border-2 border-slate-200 bg-white p-1">
            <Languages className="ml-1 h-4 w-4 text-slate-400" />
            {(["en", "ko"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setLanguage(value)} className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${language === value ? "bg-[#58cc02] text-white" : "text-slate-400"}`}>{value === "en" ? "EN" : "KO"}</button>
            ))}
          </div>
        </div>

        <section className="rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#d7ffb8] text-[#46a302]"><Sparkles className="h-6 w-6" /></div>
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Interviewer</div>
              <h1 className="mt-1 text-xl font-black leading-8 tracking-tight text-slate-900 sm:text-2xl sm:leading-9">{displayText(copy.question)}</h1>
            </div>
          </div>
        </section>

        <section className="mt-6 min-h-[160px] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Build the answer</div>
            <button type="button" onClick={resetSentence} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black text-slate-400 hover:bg-white hover:text-slate-700"><RotateCcw className="h-3.5 w-3.5" /> 다시</button>
          </div>
          <div className="flex min-h-[72px] flex-wrap content-start gap-x-2 gap-y-2 text-base font-bold leading-8 sm:text-lg">
            {tokens.slice(0, selectedCount).map((token) => <span key={token.id} className="rounded-lg bg-white px-1.5 text-slate-900 shadow-sm">{token.text}</span>)}
            {!selectedCount && <span className="text-sm font-bold text-slate-300">아래 word pool에서 첫 단어를 선택하세요.</span>}
          </div>
        </section>

        <section data-six-tap-ignore className="mt-6 flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {pool.map((token) => {
            const used = token.position < selectedCount;
            const wrong = wrongToken === token.id;
            return <button key={token.id} type="button" disabled={used || sentenceComplete} onClick={() => chooseToken(token)} className={`min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-black transition active:translate-y-1 active:border-b-2 sm:text-base ${used ? "border-slate-100 bg-slate-50 text-slate-200" : wrong ? "animate-[shake_.25s_ease-in-out] border-red-400 border-b-4 bg-red-50 text-red-500" : "border-slate-200 border-b-4 bg-white text-slate-700 hover:bg-slate-50"}`}>{token.text}</button>;
          })}
        </section>

        <div className="mt-auto pt-8">
          {sentenceComplete ? <div className="rounded-2xl border-2 border-[#b7e98d] bg-[#d7ffb8] p-4 text-[#2f7d00]"><div className="flex items-center gap-2 text-lg font-black">{questionComplete ? <Trophy className="h-5 w-5" /> : <Check className="h-5 w-5" />}{questionComplete ? "문항 완료" : "정답"}</div><div className="mt-1 text-sm font-bold opacity-80">{questionComplete ? "이 답변의 마지막 문장까지 조립했습니다." : "다음 문장으로 이어갑니다."}</div></div> : null}
        </div>
      </div>

      <footer className={`fixed inset-x-0 bottom-0 border-t-2 p-3 sm:p-4 ${sentenceComplete ? "border-[#b7e98d] bg-[#d7ffb8]" : "border-slate-100 bg-white"}`}>
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button type="button" onClick={() => moveQuestion(-1)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-b-4 border-slate-200 bg-white text-slate-500 active:translate-y-1 active:border-b-2" aria-label="이전 문항"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" disabled={!sentenceComplete} onClick={continueForward} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-b-4 px-5 text-sm font-black uppercase tracking-wide transition active:translate-y-1 active:border-b-2 ${sentenceComplete ? "border-[#46a302] bg-[#58cc02] text-white" : "border-slate-200 bg-slate-200 text-slate-400"}`}>{questionComplete ? "Next question" : "Continue"}<ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => moveQuestion(1)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-b-4 border-slate-200 bg-white text-slate-500 active:translate-y-1 active:border-b-2" aria-label="다음 문항"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </footer>
      <div className="sr-only" aria-live="polite">완료 문항 {completedQuestions.length}개</div>
    </main>
  );
}
