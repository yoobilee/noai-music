import { describe, expect, it } from 'vitest';

import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import {
  createYouTubeDisclosureCache,
  YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION,
  YOUTUBE_DISCLOSURE_CACHE_MAX_ENTRIES,
  YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY,
  YOUTUBE_DISCLOSURE_CACHE_TTL_MS,
  type DisclosureCacheStorageArea,
} from '@/storage/youtubeDisclosureCache';

function createMemoryStorage(
  initial: Record<string, unknown> = {},
): DisclosureCacheStorageArea & { data: Record<string, unknown> } {
  const storage = {
    data: structuredClone(initial),
    async get(key: string) {
      return key in storage.data ? { [key]: structuredClone(storage.data[key]) } : {};
    },
    async set(items: Record<string, unknown>) {
      Object.assign(storage.data, structuredClone(items));
    },
  };
  return storage;
}

function result(
  videoId: string,
  status: WatchDisclosureLookupResult['status'],
  checkedAt: number,
): WatchDisclosureLookupResult {
  return {
    videoId,
    status,
    evidence:
      status === 'confirmed'
        ? [
            {
              source: 'youtube',
              kind: 'made-with-ai',
              matchedText: 'AI: Content was made with AI',
              confidence: 'confirmed',
              location: 'metadata-badge',
              evidenceType: 'accessibility-label',
            },
          ]
        : [],
    checkedAt,
    source: 'network',
    ...(status === 'unknown-or-error'
      ? { failureReason: 'network-error' as const }
      : {}),
  };
}

describe('YouTube disclosure storage.local cache', () => {
  it('returns a stored unexpired result as a cache hit', async () => {
    let currentTime = 1_000;
    const storage = createMemoryStorage();
    const cache = createYouTubeDisclosureCache(storage, () => currentTime);

    await cache.set(result('CacheHit001', 'confirmed', currentTime));
    currentTime += 100;

    await expect(cache.get('CacheHit001')).resolves.toMatchObject({
      videoId: 'CacheHit001',
      status: 'confirmed',
      source: 'cache',
    });
  });

  it('expires entries according to status-specific TTLs', async () => {
    let currentTime = 10_000;
    const storage = createMemoryStorage();
    const cache = createYouTubeDisclosureCache(storage, () => currentTime);

    await cache.set(result('Negative001', 'not-detected', currentTime));
    currentTime += YOUTUBE_DISCLOSURE_CACHE_TTL_MS['not-detected'];

    await expect(cache.get('Negative001')).resolves.toBeNull();
  });

  it('keeps unknown errors only for the short error TTL', async () => {
    let currentTime = 20_000;
    const storage = createMemoryStorage();
    const cache = createYouTubeDisclosureCache(storage, () => currentTime);

    await cache.set(result('Unknown0001', 'unknown-or-error', currentTime));
    currentTime += YOUTUBE_DISCLOSURE_CACHE_TTL_MS['unknown-or-error'] - 1;
    await expect(cache.get('Unknown0001')).resolves.toMatchObject({
      status: 'unknown-or-error',
      failureReason: 'network-error',
    });

    currentTime += 1;
    await expect(cache.get('Unknown0001')).resolves.toBeNull();
  });

  it('fails closed on an unsupported schema version', async () => {
    const storage = createMemoryStorage({
      [YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY]: {
        schemaVersion: YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION + 1,
        entries: {
          StaleData01: {
            videoId: 'StaleData01',
            status: 'confirmed',
            evidence: [],
            checkedAt: 1,
            expiresAt: Number.MAX_SAFE_INTEGER,
          },
        },
      },
    });
    const cache = createYouTubeDisclosureCache(storage, () => 100);

    await expect(cache.get('StaleData01')).resolves.toBeNull();
  });

  it('rejects a confirmed cache entry without confirmed official evidence', async () => {
    const storage = createMemoryStorage({
      [YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY]: {
        schemaVersion: YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION,
        entries: {
          Corrupt0001: {
            videoId: 'Corrupt0001',
            status: 'confirmed',
            evidence: [],
            checkedAt: 1,
            expiresAt: Number.MAX_SAFE_INTEGER,
          },
        },
      },
    });
    const cache = createYouTubeDisclosureCache(storage, () => 100);

    await expect(cache.get('Corrupt0001')).resolves.toBeNull();
  });

  it('evicts the oldest live entries when the size limit is exceeded', async () => {
    const entries = Object.fromEntries(
      Array.from({ length: YOUTUBE_DISCLOSURE_CACHE_MAX_ENTRIES }, (_, index) => {
        const videoId = index.toString(36).padStart(11, '0');
        return [
          videoId,
          {
            videoId,
            status: 'not-detected',
            evidence: [],
            checkedAt: index + 1,
            expiresAt:
              index +
              1 +
              YOUTUBE_DISCLOSURE_CACHE_TTL_MS['not-detected'],
          },
        ];
      }),
    );
    const storage = createMemoryStorage({
      [YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY]: {
        schemaVersion: YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION,
        entries,
      },
    });
    const cache = createYouTubeDisclosureCache(storage, () => 1_000);

    await cache.set(result('Newest00001', 'not-detected', 1_000));

    const stored = storage.data[YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY] as {
      entries: Record<string, unknown>;
    };
    expect(Object.keys(stored.entries)).toHaveLength(
      YOUTUBE_DISCLOSURE_CACHE_MAX_ENTRIES,
    );
    expect(stored.entries['00000000000']).toBeUndefined();
    expect(stored.entries.Newest00001).toBeDefined();
  });

  it('stores only the versioned minimum cache fields', async () => {
    const storage = createMemoryStorage();
    const cache = createYouTubeDisclosureCache(storage, () => 100);

    await cache.set(result('Minimal0001', 'not-detected', 100));

    expect(storage.data).toEqual({
      [YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY]: {
        schemaVersion: YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION,
        entries: {
          Minimal0001: {
            videoId: 'Minimal0001',
            status: 'not-detected',
            evidence: [],
            checkedAt: 100,
            expiresAt: 100 + YOUTUBE_DISCLOSURE_CACHE_TTL_MS['not-detected'],
          },
        },
      },
    });
  });
});
