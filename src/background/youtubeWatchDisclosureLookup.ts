import { parseYouTubeWatchPageHtml } from '@/adapters/youtube/watchPageHtml';
import { isYouTubeVideoId } from '@/adapters/youtube/videoId';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import type {
  WatchDisclosureFailureReason,
  WatchDisclosureLookupResult,
} from '@/shared/youtubeWatchDisclosure';
import type { YouTubeDisclosureCache } from '@/storage/youtubeDisclosureCache';

import {
  createRequestQueue,
  RequestQueueFullError,
  type RequestQueue,
} from './requestQueue';
import {
  fetchYouTubeWatchPage,
  type WatchPageFetchResult,
} from './youtubeWatchPageFetch';

export const WATCH_PAGE_REQUEST_CONCURRENCY = 2;
export const WATCH_PAGE_REQUEST_QUEUE_CAPACITY = 20;

export interface YouTubeWatchDisclosureLookupService {
  lookup(videoId: string): Promise<WatchDisclosureLookupResult>;
}

interface LookupDependencies {
  cache: YouTubeDisclosureCache;
  fetchPage?: (videoId: string) => Promise<WatchPageFetchResult>;
  queue?: RequestQueue;
  now?: () => number;
}

function createUnknownResult(
  videoId: string,
  checkedAt: number,
  failureReason: WatchDisclosureFailureReason,
): WatchDisclosureLookupResult {
  return {
    videoId,
    status: 'unknown-or-error',
    evidence: [],
    checkedAt,
    source: 'network',
    failureReason,
  };
}

export function createYouTubeWatchDisclosureLookupService({
  cache,
  fetchPage = fetchYouTubeWatchPage,
  queue = createRequestQueue(
    WATCH_PAGE_REQUEST_CONCURRENCY,
    WATCH_PAGE_REQUEST_QUEUE_CAPACITY,
  ),
  now = Date.now,
}: LookupDependencies): YouTubeWatchDisclosureLookupService {
  const inFlight = new Map<string, Promise<WatchDisclosureLookupResult>>();

  const lookupAfterCacheMiss = async (
    videoId: string,
  ): Promise<WatchDisclosureLookupResult> => {
    const checkedAt = now();
    let fetchResult: WatchPageFetchResult;

    try {
      fetchResult = await queue.run(() => fetchPage(videoId));
    } catch (error) {
      if (error instanceof RequestQueueFullError) {
        return createUnknownResult(videoId, checkedAt, 'queue-full');
      }
      return createUnknownResult(videoId, checkedAt, 'network-error');
    }

    let result: WatchDisclosureLookupResult;
    if (!fetchResult.ok) {
      result = createUnknownResult(videoId, checkedAt, fetchResult.reason);
    } else {
      const parsed = parseYouTubeWatchPageHtml(fetchResult.html);
      if (parsed.status === 'unknown') {
        result = {
          ...createUnknownResult(videoId, checkedAt, 'invalid-html'),
          evidence: parsed.evidence,
        };
      } else {
        const detection = detectYouTubeOfficialDisclosure(parsed.evidence);
        result = {
          videoId,
          status: detection.detected ? 'confirmed' : 'not-detected',
          evidence: detection.evidence,
          checkedAt,
          source: 'network',
        };
      }
    }

    await cache.set(result).catch(() => undefined);
    return result;
  };

  return {
    lookup(videoId) {
      if (!isYouTubeVideoId(videoId)) {
        return Promise.resolve(
          createUnknownResult(videoId, now(), 'invalid-response-url'),
        );
      }

      const pending = inFlight.get(videoId);
      if (pending !== undefined) {
        return pending;
      }

      const operation = cache
        .get(videoId)
        .catch(() => null)
        .then((cached) => cached ?? lookupAfterCacheMiss(videoId))
        .finally(() => inFlight.delete(videoId));
      inFlight.set(videoId, operation);
      return operation;
    },
  };
}
