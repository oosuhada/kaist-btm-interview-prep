import fs from "node:fs";
import path from "node:path";

import { ContinuousAudioPlayer } from "@/components/continuous-audio-player";
import type { PlaylistTrack } from "@/components/continuous-audio-player";
import {
  musicalAlignmentMap,
  readMusicalRecallAlignment,
} from "@/lib/musical-recall-alignment";

export default async function AudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialTrackId = Array.isArray(params.track) ? params.track[0] : params.track;
  const manifestPath = path.join(
    process.cwd(),
    "public",
    "audio",
    "tracks",
    "manifest.json"
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    tracks: PlaylistTrack[];
  };
  const musicalManifestPath = path.join(
    process.cwd(),
    "public",
    "audio",
    "musical-recall",
    "manifest.json"
  );
  const musicalManifest = fs.existsSync(musicalManifestPath)
    ? (JSON.parse(fs.readFileSync(musicalManifestPath, "utf8")) as {
        tracks: Array<{
          trackId: string;
          language: "ko" | "en";
          src: string;
          duration: number;
          style: "A" | "B" | "C";
          cues: PlaylistTrack["cues"];
        }>;
      })
    : { tracks: [] };
  const musicalMap = new Map(
    musicalManifest.tracks.map((track) => [`${track.trackId}:${track.language}`, track])
  );
  const continuousManifestPath = path.join(
    process.cwd(),
    "public",
    "audio",
    "musical-recall",
    "continuous.json"
  );
  const continuousManifest = fs.existsSync(continuousManifestPath)
    ? (JSON.parse(fs.readFileSync(continuousManifestPath, "utf8")) as {
        languages: Record<
          "ko" | "en",
          {
            src: string;
            duration: number;
            tracks: Array<{
              trackId: string;
              start: number;
              end: number;
              duration: number;
            }>;
          }
        >;
      })
    : null;
  const continuousMap = new Map<string, {
    src: string;
    playlistDuration: number;
    start: number;
    end: number;
  }>();
  if (continuousManifest) {
    for (const language of ["ko", "en"] as const) {
      const playlist = continuousManifest.languages[language];
      for (const track of playlist.tracks) {
        continuousMap.set(`${track.trackId}:${language}`, {
          src: playlist.src,
          playlistDuration: playlist.duration,
          start: track.start,
          end: track.end,
        });
      }
    }
  }
  const alignmentMap = musicalAlignmentMap(readMusicalRecallAlignment());
  const tracks = manifest.tracks.map((track) => {
    const musicalRecall = musicalMap.get(`${track.id}:${track.language}`);
    const alignment = alignmentMap.get(`${track.id}:${track.language}`);
    const continuous = continuousMap.get(`${track.id}:${track.language}`);
    return musicalRecall
      ? {
          ...track,
          musicalRecall: {
            ...musicalRecall,
            cues: alignment?.cues ?? musicalRecall.cues,
            alignmentEngine: alignment?.alignmentEngine,
            alignmentConfidence: alignment?.alignmentConfidence,
            matchRate: alignment?.matchRate,
            continuous,
          },
        }
      : track;
  });
  return (
    <ContinuousAudioPlayer
      tracks={tracks}
      initialTrackId={initialTrackId}
    />
  );
}
