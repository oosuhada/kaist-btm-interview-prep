import fs from "node:fs";
import path from "node:path";

export type MusicalAlignmentWord = {
  text: string;
  start: number;
  end: number;
  role?: "question" | "answer";
  confidence?: number;
  matched?: boolean;
  matchSimilarity?: number;
  recognizedText?: string | null;
};

export type MusicalAlignmentCue = {
  section?: string;
  role: "question" | "answer";
  text: string;
  start: number;
  end: number;
  words: MusicalAlignmentWord[];
  matchRate?: number;
};

export type MusicalAlignmentTrack = {
  trackId: string;
  language: "ko" | "en";
  src: string;
  duration: number;
  alignmentEngine: string;
  alignmentMethod?: string;
  lyrics?: string;
  rawTranscript?: string;
  words: MusicalAlignmentWord[];
  cues: MusicalAlignmentCue[];
  matchRate?: number;
  meanMatchedWordConfidence?: number;
  meanLexicalSimilarity?: number;
  alignmentConfidence?: number;
};

export type MusicalAlignmentManifest = {
  version: number;
  generatedAt: string;
  sourceOfTruth: string;
  timingPolicy?: string;
  summary?: {
    requestedTracks?: number;
    success?: number;
    failed?: number;
    totalManifestTracks?: number;
  };
  tracks: MusicalAlignmentTrack[];
  failures?: Array<{
    trackId?: string;
    language?: string;
    src?: string;
    error: string;
  }>;
};

export function readMusicalRecallAlignment(): MusicalAlignmentManifest | null {
  const alignmentPath = path.join(
    process.cwd(),
    "public",
    "audio",
    "musical-recall",
    "alignment.json"
  );
  if (!fs.existsSync(alignmentPath)) return null;
  return JSON.parse(fs.readFileSync(alignmentPath, "utf8")) as MusicalAlignmentManifest;
}

export function musicalAlignmentMap(manifest: MusicalAlignmentManifest | null) {
  return new Map(
    (manifest?.tracks ?? []).map((track) => [
      `${track.trackId}:${track.language}`,
      track,
    ])
  );
}
