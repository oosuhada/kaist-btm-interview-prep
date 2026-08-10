import fs from "node:fs";
import path from "node:path";

import { ContinuousAudioPlayer } from "@/components/continuous-audio-player";
import type { PlaylistTrack } from "@/components/continuous-audio-player";

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
  return (
    <ContinuousAudioPlayer
      tracks={manifest.tracks}
      initialTrackId={initialTrackId}
    />
  );
}
