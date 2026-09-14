import { readStrictYouTubeVideoIdParameter } from '@/shared/youtubeVideoId';

const YOUTUBE_MUSIC_BASE_URL = new URL('https://music.youtube.com/');
const SUPPORTED_WATCH_QUERY_PARAMETERS = new Set(['v', 'list', 'index']);

function isSupportedRelativeWatchUrl(href: string): boolean {
  return href.startsWith('/watch?') || href.startsWith('watch?');
}

export function parseYouTubeMusicWatchVideoId(
  href: string | null | undefined,
): string | null {
  if (
    !href ||
    href !== href.trim() ||
    href.includes('\\') ||
    href.startsWith('//')
  ) {
    return null;
  }

  const isRelativeUrl = isSupportedRelativeWatchUrl(href);
  let url: URL;

  try {
    url = new URL(href, YOUTUBE_MUSIC_BASE_URL);
  } catch {
    return null;
  }

  const hasUnsupportedQueryParameter = [...url.searchParams.keys()].some(
    (name) => !SUPPORTED_WATCH_QUERY_PARAMETERS.has(name),
  );

  if (
    (!isRelativeUrl && url.protocol !== 'https:') ||
    url.hostname.toLocaleLowerCase() !== 'music.youtube.com' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/watch' ||
    url.hash !== '' ||
    hasUnsupportedQueryParameter
  ) {
    return null;
  }

  return readStrictYouTubeVideoIdParameter(url);
}
