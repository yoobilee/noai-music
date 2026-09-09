import { parseYouTubeWatchVideoId } from '@/adapters/youtube/videoId';
import type { WatchDisclosureFailureReason } from '@/shared/youtubeWatchDisclosure';

export const WATCH_PAGE_FETCH_TIMEOUT_MS = 8_000;
export const WATCH_PAGE_RESPONSE_MAX_BYTES = 5_000_000;

interface FetchResponse {
  ok: boolean;
  url: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchWatchPage = (
  input: string,
  init: RequestInit,
) => Promise<FetchResponse>;

export type WatchPageFetchResult =
  | { ok: true; html: string }
  | { ok: false; reason: WatchDisclosureFailureReason };

export async function fetchYouTubeWatchPage(
  videoId: string,
  fetchPage: FetchWatchPage = fetch,
  timeoutMs = WATCH_PAGE_FETCH_TIMEOUT_MS,
): Promise<WatchPageFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestUrl = new URL('https://www.youtube.com/watch');
    requestUrl.searchParams.set('v', videoId);
    requestUrl.searchParams.set('hl', 'en');

    const response = await fetchPage(requestUrl.href, {
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: 'http-error' };
    }
    if (parseYouTubeWatchVideoId(response.url) !== videoId) {
      return { ok: false, reason: 'invalid-response-url' };
    }

    const contentType = response.headers.get('content-type')?.toLowerCase();
    if (!contentType?.includes('text/html')) {
      return { ok: false, reason: 'unexpected-content-type' };
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (
      Number.isFinite(contentLength) &&
      contentLength > WATCH_PAGE_RESPONSE_MAX_BYTES
    ) {
      return { ok: false, reason: 'response-too-large' };
    }

    const html = await response.text();
    if (html.length > WATCH_PAGE_RESPONSE_MAX_BYTES) {
      return { ok: false, reason: 'response-too-large' };
    }

    return { ok: true, html };
  } catch {
    return {
      ok: false,
      reason: controller.signal.aborted ? 'timeout' : 'network-error',
    };
  } finally {
    clearTimeout(timeout);
  }
}
