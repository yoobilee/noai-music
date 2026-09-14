import { readStrictYouTubeVideoIdParameter } from '@/shared/youtubeVideoId';

const YOUTUBE_WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com']);
const YOUTUBE_BASE_URL = new URL('https://www.youtube.com/');

export { isYouTubeVideoId } from '@/shared/youtubeVideoId';

export function parseYouTubeWatchVideoId(
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

  const isRelativeUrl = href.startsWith('/');
  let url: URL;

  try {
    url = new URL(href, YOUTUBE_BASE_URL);
  } catch {
    return null;
  }

  if (
    (!isRelativeUrl && url.protocol !== 'https:') ||
    !YOUTUBE_WATCH_HOSTS.has(url.hostname.toLocaleLowerCase()) ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/watch'
  ) {
    return null;
  }

  return readStrictYouTubeVideoIdParameter(url);
}
