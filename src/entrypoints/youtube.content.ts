import { createYouTubeAdapter } from '@/adapters/youtube';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { YOUTUBE_MATCH_PATTERNS } from '@/shared/sites';
import {
  isWatchDisclosureLookupResult,
  YOUTUBE_WATCH_DISCLOSURE_MESSAGE,
  type WatchDisclosureLookupResult,
} from '@/shared/youtubeWatchDisclosure';
import {
  hasYouTubeDevelopmentBadge,
  renderYouTubeDevelopmentBadge,
} from '@/ui/youtubeDevelopmentBadge';
import {
  hasYouTubeDevelopmentLookupBadge,
  removeYouTubeDevelopmentLookupBadge,
  renderYouTubeDevelopmentLookupBadge,
} from '@/ui/youtubeDevelopmentLookupBadge';

function createUnavailableResult(videoId: string): WatchDisclosureLookupResult {
  return {
    videoId,
    status: 'unknown-or-error',
    evidence: [],
    checkedAt: Date.now(),
    source: 'network',
    failureReason: 'background-unavailable',
  };
}

async function requestWatchDisclosure(
  videoId: string,
): Promise<WatchDisclosureLookupResult> {
  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: YOUTUBE_WATCH_DISCLOSURE_MESSAGE,
      videoId,
    });
    return isWatchDisclosureLookupResult(response) && response.videoId === videoId
      ? response
      : createUnavailableResult(videoId);
  } catch {
    return createUnavailableResult(videoId);
  }
}

export default defineContentScript({
  matches: YOUTUBE_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'ISOLATED',
  main(ctx) {
    const adapter = createYouTubeAdapter();
    let routeKey = adapter.getRouteKey(adapter.getCurrentUrl());
    let processedCandidates = new WeakMap<Element, string>();
    let expectedLookupKeys = new WeakMap<Element, string>();
    let routeLookups = new Map<string, Promise<WatchDisclosureLookupResult>>();

    const lookupCard = (
      candidate: ReturnType<typeof adapter.collectCandidates>[number],
    ) => {
      const videoId = candidate.snapshot.identity.videoId;
      if (videoId === undefined) {
        return;
      }

      const lookupKey = `${routeKey}|${videoId}`;
      expectedLookupKeys.set(candidate.element, lookupKey);
      renderYouTubeDevelopmentLookupBadge(candidate, 'checking');

      let lookup = routeLookups.get(videoId);
      if (lookup === undefined) {
        lookup = requestWatchDisclosure(videoId);
        routeLookups.set(videoId, lookup);
        void lookup.finally(() => {
          if (routeLookups.get(videoId) === lookup) {
            routeLookups.delete(videoId);
          }
        });
      }

      void lookup.then((result) => {
        if (
          expectedLookupKeys.get(candidate.element) === lookupKey &&
          candidate.element.isConnected
        ) {
          renderYouTubeDevelopmentLookupBadge(candidate, result.status);
        }
      });
    };

    const processRoots = (roots: readonly ParentNode[]) => {
      const nextRouteKey = adapter.getRouteKey(adapter.getCurrentUrl());
      if (routeKey !== nextRouteKey) {
        routeKey = nextRouteKey;
        processedCandidates = new WeakMap<Element, string>();
        expectedLookupKeys = new WeakMap<Element, string>();
        routeLookups = new Map<string, Promise<WatchDisclosureLookupResult>>();
      }

      const candidates = new Map<Element, ReturnType<typeof adapter.collectCandidates>[number]>();
      for (const root of roots) {
        for (const candidate of adapter.collectCandidates(root)) {
          candidates.set(candidate.element, candidate);
        }
      }

      for (const candidate of candidates.values()) {
        const detection = detectYouTubeOfficialDisclosure(
          adapter.readOfficialDisclosures(candidate),
        );
        const fingerprint = JSON.stringify({
          videoId: candidate.snapshot.identity.videoId,
          surface: candidate.surface,
          detection,
        });

        const markerIsCurrent = detection.detected
          ? hasYouTubeDevelopmentBadge(candidate)
          : candidate.surface === 'video-card'
            ? hasYouTubeDevelopmentLookupBadge(candidate)
            : true;
        if (
          processedCandidates.get(candidate.element) === fingerprint &&
          markerIsCurrent
        ) {
          continue;
        }

        renderYouTubeDevelopmentBadge(candidate, detection);
        if (detection.detected || candidate.surface === 'watch-page') {
          expectedLookupKeys.delete(candidate.element);
          removeYouTubeDevelopmentLookupBadge(candidate);
        } else {
          lookupCard(candidate);
        }
        processedCandidates.set(candidate.element, fingerprint);
      }
    };

    processRoots([document]);
    const stopObserving = adapter.observePage(processRoots);
    ctx.onInvalidated(stopObserving);
  },
});
