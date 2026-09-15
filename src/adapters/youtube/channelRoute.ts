import { isYouTubeArtistId } from '@/shared/youtubeArtistId';
import { isYouTubeChannelHandle } from '@/shared/youtubeChannelHandle';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com']);

export type YouTubeChannelVideosRouteIdentity =
  | {
      surface: 'videos';
      identityType: 'channel-id';
      channelId: string;
    }
  | {
      surface: 'videos';
      identityType: 'handle';
      channelHandle: string;
    };

export function parseYouTubeChannelRouteIdentity(
  url: URL,
): YouTubeChannelVideosRouteIdentity | null {
  if (
    url.protocol !== 'https:' ||
    !YOUTUBE_HOSTS.has(url.hostname.toLocaleLowerCase()) ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return null;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const handleMatch = /^\/(@[^/]+)\/videos\/?$/.exec(pathname);
  if (
    handleMatch?.[1] !== undefined &&
    isYouTubeChannelHandle(handleMatch[1])
  ) {
    return {
      surface: 'videos',
      identityType: 'handle',
      channelHandle: handleMatch[1],
    };
  }

  const channelIdMatch = /^\/channel\/(UC[^/]+)\/videos\/?$/.exec(pathname);
  if (
    channelIdMatch?.[1] !== undefined &&
    isYouTubeArtistId(channelIdMatch[1])
  ) {
    return {
      surface: 'videos',
      identityType: 'channel-id',
      channelId: channelIdMatch[1],
    };
  }

  return null;
}
