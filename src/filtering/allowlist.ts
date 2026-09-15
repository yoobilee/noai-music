import type { MediaIdentity } from '@/detection/contracts';
import { isYouTubeArtistId } from '@/shared/youtubeArtistId';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';
import type { PersistedAllowlist } from '@/storage/contracts';

export function isTrackAllowed(
  videoId: string | undefined,
  allowlist: PersistedAllowlist,
): boolean {
  return (
    videoId !== undefined &&
    isYouTubeVideoId(videoId) &&
    allowlist.tracks.some((track) => track.videoId === videoId)
  );
}

export function isArtistAllowed(
  artistIds: readonly string[],
  allowlist: PersistedAllowlist,
): boolean {
  const allowedArtistIds = new Set(
    allowlist.artists.map((artist) => artist.artistId),
  );
  return artistIds.some(
    (artistId) =>
      isYouTubeArtistId(artistId) && allowedArtistIds.has(artistId),
  );
}

export function isMediaAllowed(
  identity: MediaIdentity,
  allowlist: PersistedAllowlist,
): boolean {
  const artistIds =
    identity.channelId === undefined
      ? identity.artistIds
      : [...identity.artistIds, identity.channelId];
  return (
    isTrackAllowed(identity.videoId, allowlist) ||
    isArtistAllowed(artistIds, allowlist)
  );
}
