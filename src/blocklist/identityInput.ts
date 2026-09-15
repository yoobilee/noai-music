import { parseAllowlistArtistInput, parseAllowlistTrackInput } from '@/allowlist/identityInput';
import { isYouTubeArtistId, parseYouTubeArtistHref } from '@/shared/youtubeArtistId';
import { isYouTubeChannelHandle, parseYouTubeChannelHandleHref } from '@/shared/youtubeChannelHandle';
import type { BlockedChannel } from '@/storage/contracts';

export const parseBlocklistTrackInput = parseAllowlistTrackInput;
export const parseBlocklistArtistInput = parseAllowlistArtistInput;

export function parseBlocklistChannelInput(value: string): BlockedChannel | null {
  const normalized = value.trim();
  if (isYouTubeArtistId(normalized)) {
    return { identityType: 'channel-id', channelId: normalized };
  }
  if (isYouTubeChannelHandle(normalized)) {
    return { identityType: 'handle', handle: normalized };
  }
  const channelId = parseYouTubeArtistHref(normalized, 'youtube');
  if (channelId !== null) {
    return { identityType: 'channel-id', channelId };
  }
  const handle = parseYouTubeChannelHandleHref(normalized);
  return handle === null ? null : { identityType: 'handle', handle };
}
