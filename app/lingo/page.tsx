import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

import { LingoRecallGame, type LingoRecallItem } from "@/components/lingo-recall-game";

export const metadata: Metadata = {
  title: "Secret Recall",
  robots: { index: false, follow: false },
};

const CORE_IDS = [
  "application-opening-60",
  "application-q5",
  "application-q6",
  "defense-tom-fit",
  "research-1",
  "research-3",
  "application-q40",
  "application-q41",
  "application-q44",
  "application-q39",
  "application-q32",
  "application-q7",
] as const;

type BaseTrack = {
  id: string;
  language: "ko" | "en";
  question: string;
  answer: string;
};

export default function LingoPage() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "audio", "tracks", "manifest.json"), "utf8")
  ) as { tracks: BaseTrack[] };
  const map = new Map(manifest.tracks.map((track) => [`${track.id}:${track.language}`, track]));
  const items: LingoRecallItem[] = CORE_IDS.flatMap((id, index) => {
    const ko = map.get(`${id}:ko`);
    const en = map.get(`${id}:en`);
    if (!ko || !en) return [];
    return [{ id, rank: index + 1, ko: { question: ko.question, answer: ko.answer }, en: { question: en.question, answer: en.answer } }];
  });
  return <LingoRecallGame items={items} />;
}
