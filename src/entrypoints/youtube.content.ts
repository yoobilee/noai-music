import { createYouTubeAdapter } from '@/adapters/youtube';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { YOUTUBE_MATCH_PATTERNS } from '@/shared/sites';
import {
  hasYouTubeDevelopmentBadge,
  renderYouTubeDevelopmentBadge,
} from '@/ui/youtubeDevelopmentBadge';

export default defineContentScript({
  matches: YOUTUBE_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'ISOLATED',
  main(ctx) {
    const adapter = createYouTubeAdapter();
    let routeKey = adapter.getRouteKey(adapter.getCurrentUrl());
    let processedCandidates = new WeakMap<Element, string>();

    const processRoots = (roots: readonly ParentNode[]) => {
      const nextRouteKey = adapter.getRouteKey(adapter.getCurrentUrl());
      if (routeKey !== nextRouteKey) {
        routeKey = nextRouteKey;
        processedCandidates = new WeakMap<Element, string>();
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
        const fingerprint = JSON.stringify(detection);

        if (
          processedCandidates.get(candidate.element) === fingerprint &&
          (!detection.detected || hasYouTubeDevelopmentBadge(candidate))
        ) {
          continue;
        }

        renderYouTubeDevelopmentBadge(candidate, detection);
        processedCandidates.set(candidate.element, fingerprint);
      }
    };

    processRoots([document]);
    const stopObserving = adapter.observePage(processRoots);
    ctx.onInvalidated(stopObserving);
  },
});
