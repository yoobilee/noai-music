const YOUTUBE_BASE_URL = new URL('https://www.youtube.com/');
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com']);
const HANDLE_CHARACTERS = /^[\p{L}\p{N}_.\-·]+$/u;
const HANDLE_SEPARATOR = /^[_.\-·]|[_.\-·]$/u;
const HAN_OR_HANGUL = /^[\p{Script=Han}\p{Script=Hangul}\p{N}_.\-·]+$/u;
const HAS_HAN_OR_HANGUL = /[\p{Script=Han}\p{Script=Hangul}]/u;
const ETHIOPIC_OR_KANA = /^[\p{Script=Ethiopic}\p{Script=Hiragana}\p{Script=Katakana}\p{N}_.\-·]+$/u;
const HAS_ETHIOPIC_OR_KANA = /[\p{Script=Ethiopic}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function isYouTubeChannelHandle(value: string): boolean {
  if (!value.startsWith('@')) return false;
  const name = value.slice(1);
  const length = [...name].length;
  if (
    name === '' ||
    !HANDLE_CHARACTERS.test(name) ||
    HANDLE_SEPARATOR.test(name)
  ) {
    return false;
  }
  if (HAS_HAN_OR_HANGUL.test(name) && HAN_OR_HANGUL.test(name)) {
    return length >= 1 && length <= 10;
  }
  if (HAS_ETHIOPIC_OR_KANA.test(name) && ETHIOPIC_OR_KANA.test(name)) {
    return length >= 2 && length <= 20;
  }
  return length >= 3 && length <= 30;
}

export function parseYouTubeChannelHandleHref(
  href: string | null | undefined,
): string | null {
  if (!href || href !== href.trim() || href.includes('\\') || href.startsWith('//')) {
    return null;
  }

  const isRelative = href.startsWith('/');
  let url: URL;
  try {
    url = new URL(href, YOUTUBE_BASE_URL);
  } catch {
    return null;
  }
  if (
    (!isRelative && url.protocol !== 'https:') ||
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
  const match = /^\/(@[^/]+)\/?$/.exec(pathname);
  return match?.[1] !== undefined && isYouTubeChannelHandle(match[1])
    ? match[1]
    : null;
}
