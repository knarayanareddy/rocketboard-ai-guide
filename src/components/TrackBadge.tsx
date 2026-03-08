import { Track, TRACKS } from "@/data/onboarding-data";

const trackColorMap: Record<Track, string> = {
  frontend: "bg-track-frontend/15 text-track-frontend border-track-frontend/30",
  backend: "bg-track-backend/15 text-track-backend border-track-backend/30",
  infra: "bg-track-infra/15 text-track-infra border-track-infra/30",
  "cross-repo": "bg-track-cross/15 text-track-cross border-track-cross/30",
};

export function TrackBadge({ track }: { track: Track }) {
  const info = TRACKS.find((t) => t.key === track);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${trackColorMap[track]}`}>
      {info?.label ?? track}
    </span>
  );
}
