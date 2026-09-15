import { parseYouTubeMusicWatchVideoId } from '@/adapters/youtube-music/videoId';
import { parseYouTubeWatchVideoId } from '@/adapters/youtube/videoId';
import {
  isYouTubeArtistId,
  parseYouTubeArtistHref,
} from '@/shared/youtubeArtistId';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';

export function parseAllowlistTrackInput(value: string): string | null {
  const normalized = value.trim();
  if (isYouTubeVideoId(normalized)) {
    return normalized;
  }

  return (
    parseYouTubeWatchVideoId(normalized) ??
    parseYouTubeMusicWatchVideoId(normalized)
  );
}

export function parseAllowlistArtistInput(value: string): string | null {
  const normalized = value.trim();
  if (isYouTubeArtistId(normalized)) {
    return normalized;
  }

  return (
    parseYouTubeArtistHref(normalized, 'youtube') ??
    parseYouTubeArtistHref(normalized, 'youtube-music')
  );
}
