import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchYouTubeWatchPage } from '@/background/youtubeWatchPageFetch';

const videoId = 'FetchTest01';

function response(
  overrides: Partial<{
    ok: boolean;
    url: string;
    contentType: string;
    contentLength: string | null;
    html: string;
  }> = {},
) {
  const values = {
    ok: true,
    url: `https://www.youtube.com/watch?v=${videoId}&hl=en`,
    contentType: 'text/html; charset=utf-8',
    contentLength: null,
    html: '<html></html>',
    ...overrides,
  };
  return {
    ok: values.ok,
    url: values.url,
    headers: {
      get(name: string) {
        if (name === 'content-type') return values.contentType;
        if (name === 'content-length') return values.contentLength;
        return null;
      },
    },
    async text() {
      return values.html;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('YouTube watch-page fetch', () => {
  it('constructs the fixed YouTube URL and omits credentials', async () => {
    const fetchPage = vi.fn(async () => response());

    await expect(fetchYouTubeWatchPage(videoId, fetchPage)).resolves.toEqual({
      ok: true,
      html: '<html></html>',
    });
    expect(fetchPage).toHaveBeenCalledWith(
      `https://www.youtube.com/watch?v=${videoId}&hl=en`,
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
      }),
    );
  });

  it.each([
    ['HTTP error', async () => response({ ok: false }), 'http-error'],
    [
      'unexpected content type',
      async () => response({ contentType: 'application/json' }),
      'unexpected-content-type',
    ],
    [
      'redirect away from the requested watch page',
      async () => response({ url: 'https://www.youtube.com/' }),
      'invalid-response-url',
    ],
    [
      'network error',
      async () => {
        throw new Error('offline');
      },
      'network-error',
    ],
  ])('maps %s to an unknown failure', async (_name, fetchPage, reason) => {
    await expect(fetchYouTubeWatchPage(videoId, fetchPage)).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('aborts a request at the timeout without retrying', async () => {
    vi.useFakeTimers();
    const fetchPage = vi.fn(
      async (_url: string, init: RequestInit): Promise<never> =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = fetchYouTubeWatchPage(videoId, fetchPage, 100);
    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toEqual({ ok: false, reason: 'timeout' });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
