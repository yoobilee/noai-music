import type { MediaIdentity } from '@/detection/contracts';
import { isMediaAllowed } from '@/filtering/allowlist';
import { isYouTubeArtistId } from '@/shared/youtubeArtistId';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';
import type { PersistedAllowlist, PersistedBlocklist } from '@/storage/contracts';

import type { DirectBlockKinds } from './contracts';

export type UserRuleDecision =
  | 'allow'
  | 'block-track'
  | 'block-artist'
  | 'block-channel'
  | 'none';

export function evaluateUserRules(
  identity: MediaIdentity,
  allowlist: PersistedAllowlist,
  blocklist: PersistedBlocklist,
  directBlockKinds: DirectBlockKinds,
): UserRuleDecision {
  if (isMediaAllowed(identity, allowlist)) return 'allow';

  if (identity.videoId !== undefined && isYouTubeVideoId(identity.videoId) && blocklist.tracks.some((item) => item.videoId === identity.videoId)) {
    return 'block-track';
  }
  if (directBlockKinds.artist) {
    const blocked = new Set(blocklist.artists.map((item) => item.artistId));
    if (identity.artistIds.some((id) => isYouTubeArtistId(id) && blocked.has(id))) return 'block-artist';
  }
  if (directBlockKinds.channel && identity.channelId !== undefined && isYouTubeArtistId(identity.channelId) && blocklist.channels.some((item) => item.channelId === identity.channelId)) {
    return 'block-channel';
  }
  return 'none';
}
