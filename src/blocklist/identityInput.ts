import { parseAllowlistArtistInput, parseAllowlistTrackInput } from '@/allowlist/identityInput';
import { isYouTubeArtistId, parseYouTubeArtistHref } from '@/shared/youtubeArtistId';

export const parseBlocklistTrackInput = parseAllowlistTrackInput;
export const parseBlocklistArtistInput = parseAllowlistArtistInput;

export function parseBlocklistChannelInput(value: string): string | null {
  const normalized = value.trim();
  return isYouTubeArtistId(normalized)
    ? normalized
    : parseYouTubeArtistHref(normalized, 'youtube');
}
