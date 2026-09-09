import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createYouTubeWatchDisclosureLookupService } from '@/background/youtubeWatchDisclosureLookup';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import type { YouTubeDisclosureCache } from '@/storage/youtubeDisclosureCache';

const disclosedHtml = await readFile(
  resolve('tests/fixtures/youtube/watch-page-data.disclosed.html'),
  'utf8',
);
const ordinaryHtml = await readFile(
  resolve('tests/fixtures/youtube/watch-page-data.ordinary.html'),
  'utf8',
);
const unknownHtml = await readFile(
  resolve('tests/fixtures/youtube/watch-page-data.unknown.html'),
  'utf8',
);

function createMemoryCache(
  initial?: WatchDisclosureLookupResult,
): YouTubeDisclosureCache & {
  get: ReturnType<typeof vi.fn<YouTubeDisclosureCache['get']>>;
  set: ReturnType<typeof vi.fn<YouTubeDisclosureCache['set']>>;
} {
  const entries = new Map<string, WatchDisclosureLookupResult>();
  if (initial) entries.set(initial.videoId, initial);

  return {
    get: vi.fn(async (videoId) => entries.get(videoId) ?? null),
    set: vi.fn(async (result) => {
      entries.set(result.videoId, { ...result, source: 'cache' });
    }),
  };
}

describe('YouTube watch disclosure lookup service', () => {
  it('returns a cache hit without a network request', async () => {
    const cached: WatchDisclosureLookupResult = {
      videoId: 'CachedVid01',
      status: 'confirmed',
      evidence: [],
      checkedAt: 100,
      source: 'cache',
    };
    const cache = createMemoryCache(cached);
    const fetchPage = vi.fn(async () => ({ ok: true as const, html: ordinaryHtml }));
    const service = createYouTubeWatchDisclosureLookupService({ cache, fetchPage });

    await expect(service.lookup(cached.videoId)).resolves.toBe(cached);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('fetches a cache miss, reuses the detector and stores a confirmed result', async () => {
    const cache = createMemoryCache();
    const fetchPage = vi.fn(async () => ({ ok: true as const, html: disclosedHtml }));
    const service = createYouTubeWatchDisclosureLookupService({
      cache,
      fetchPage,
      now: () => 1234,
    });

    await expect(service.lookup('Disclose001')).resolves.toMatchObject({
      videoId: 'Disclose001',
      status: 'confirmed',
      checkedAt: 1234,
      source: 'network',
    });
    expect(cache.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' }),
    );
  });

  it('stores a recognized ordinary page as not detected', async () => {
    const cache = createMemoryCache();
    const service = createYouTubeWatchDisclosureLookupService({
      cache,
      fetchPage: async () => ({ ok: true, html: ordinaryHtml }),
    });

    await expect(service.lookup('Ordinary001')).resolves.toMatchObject({
      status: 'not-detected',
      evidence: [],
    });
  });

  it('does not turn an incomplete page into a permanent false result', async () => {
    const cache = createMemoryCache();
    const service = createYouTubeWatchDisclosureLookupService({
      cache,
      fetchPage: async () => ({ ok: true, html: unknownHtml }),
    });

    const result = await service.lookup('UnknownVid1');
    expect(result).toMatchObject({
      status: 'unknown-or-error',
      failureReason: 'invalid-html',
    });
    expect(cache.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unknown-or-error' }),
    );
  });

  it('deduplicates simultaneous requests for the same video ID', async () => {
    let release!: (value: { ok: true; html: string }) => void;
    const pendingFetch = new Promise<{ ok: true; html: string }>((resolve) => {
      release = resolve;
    });
    const cache = createMemoryCache();
    const fetchPage = vi.fn(() => pendingFetch);
    const service = createYouTubeWatchDisclosureLookupService({ cache, fetchPage });

    const first = service.lookup('DedupeVid01');
    const second = service.lookup('DedupeVid01');
    release({ ok: true, html: ordinaryHtml });

    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { status: 'not-detected' },
      { status: 'not-detected' },
    ]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it.each(['network-error', 'timeout', 'http-error'] as const)(
    'keeps %s distinct from not detected',
    async (reason) => {
      const cache = createMemoryCache();
      const service = createYouTubeWatchDisclosureLookupService({
        cache,
        fetchPage: async () => ({ ok: false, reason }),
      });

      await expect(service.lookup('FailureVid1')).resolves.toMatchObject({
        status: 'unknown-or-error',
        failureReason: reason,
      });
      expect(cache.set).toHaveBeenCalledWith(
        expect.not.objectContaining({ status: 'not-detected' }),
      );
    },
  );
});
