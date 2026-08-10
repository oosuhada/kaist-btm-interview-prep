import fs from "node:fs";
import path from "node:path";

import { InterviewKnowledgeGraph } from "@/components/interview-knowledge-graph";
import type { MusicalVisualTrack } from "@/components/musical-recall-visualizer";
import {
  musicalAlignmentMap,
  readMusicalRecallAlignment,
} from "@/lib/musical-recall-alignment";

type BaseTrack = {
  trackId: string;
  id: string;
  language: "ko" | "en";
  title: string;
  category: string;
  question: string;
};

export default async function VisualPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialMusicalTrackId = Array.isArray(params.track) ? params.track[0] : params.track;
  const requestedLanguage = Array.isArray(params.lang) ? params.lang[0] : params.lang;
  const initialMusicalLanguage = requestedLanguage === "en" ? "en" : requestedLanguage === "ko" ? "ko" : undefined;
  const baseManifest = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "audio", "tracks", "manifest.json"), "utf8")
  ) as { tracks: BaseTrack[] };
  const musicalManifestPath = path.join(process.cwd(), "public", "audio", "musical-recall", "manifest.json");
  const musicalManifest = fs.existsSync(musicalManifestPath)
    ? (JSON.parse(fs.readFileSync(musicalManifestPath, "utf8")) as {
        tracks: Array<{
          trackId: string;
          language: "ko" | "en";
          src: string;
          duration: number;
          style: "A" | "B" | "C";
          cues: MusicalVisualTrack["cues"];
        }>;
      })
    : { tracks: [] };

  const baseMap = new Map(baseManifest.tracks.map((track) => [`${track.id}:${track.language}`, track]));
  const alignmentMap = musicalAlignmentMap(readMusicalRecallAlignment());
  const musicalTracks: MusicalVisualTrack[] = musicalManifest.tracks.flatMap((track) => {
    const base = baseMap.get(`${track.trackId}:${track.language}`);
    if (!base) return [];
    const alignment = alignmentMap.get(`${track.trackId}:${track.language}`);
    return [{
      ...track,
      cues: alignment?.cues ?? track.cues,
      alignmentEngine: alignment?.alignmentEngine,
      alignmentConfidence: alignment?.alignmentConfidence,
      matchRate: alignment?.matchRate,
      audioTrackId: base.trackId,
      title: base.title,
      category: base.category,
      question: base.question,
    }];
  });

  return (
    <InterviewKnowledgeGraph
      musicalTracks={musicalTracks}
      initialMusicalTrackId={initialMusicalTrackId}
      initialMusicalLanguage={initialMusicalLanguage}
    />
  );
}
