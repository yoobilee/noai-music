const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com']);
const YOUTUBE_BASE_URL = new URL('https://www.youtube.com/');

function readVideoId(url: URL): string | null {
  const decodedVideoIds = url.searchParams.getAll('v');
  if (decodedVideoIds.length !== 1) {
    return null;
  }

  const [videoId] = decodedVideoIds;
  if (videoId === undefined || !VIDEO_ID_PATTERN.test(videoId)) {
    return null;
  }

  const rawMatches = [...url.search.matchAll(/(?:^\?|&)v=([^&]*)/g)];
  return rawMatches.length === 1 && rawMatches[0]?.[1] === videoId
    ? videoId
    : null;
}

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

  return readVideoId(url);
}
