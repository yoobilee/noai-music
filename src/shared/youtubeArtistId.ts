const ARTIST_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const YOUTUBE_BASE_URL = new URL('https://www.youtube.com/');
const YOUTUBE_MUSIC_BASE_URL = new URL('https://music.youtube.com/');
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com']);

export function isYouTubeArtistId(value: string): boolean {
  return ARTIST_ID_PATTERN.test(value);
}

function isRelativeArtistHref(
  href: string,
  site: 'youtube' | 'youtube-music',
): boolean {
  if (href.startsWith('/')) {
    return true;
  }

  return site === 'youtube-music' && href.startsWith('browse/');
}

export function parseYouTubeArtistHref(
  href: string | null | undefined,
  site: 'youtube' | 'youtube-music',
): string | null {
  if (
    !href ||
    href !== href.trim() ||
    href.includes('\\') ||
    href.startsWith('//')
  ) {
    return null;
  }

  const isRelative = isRelativeArtistHref(href, site);
  let url: URL;
  try {
    url = new URL(
      href,
      site === 'youtube' ? YOUTUBE_BASE_URL : YOUTUBE_MUSIC_BASE_URL,
    );
  } catch {
    return null;
  }

  const validHost =
    site === 'youtube'
      ? YOUTUBE_HOSTS.has(url.hostname.toLocaleLowerCase())
      : url.hostname.toLocaleLowerCase() === 'music.youtube.com';
  const pathMatch =
    site === 'youtube'
      ? /^\/channel\/(UC[A-Za-z0-9_-]{22})$/.exec(url.pathname)
      : /^\/(?:channel|browse)\/(UC[A-Za-z0-9_-]{22})$/.exec(url.pathname);

  if (
    (!isRelative && url.protocol !== 'https:') ||
    !validHost ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    pathMatch?.[1] === undefined
  ) {
    return null;
  }

  return pathMatch[1];
}
