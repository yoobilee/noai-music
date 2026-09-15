import type {
  YouTubeMusicAdapter,
  YouTubeMusicMediaCandidate,
} from '@/adapters/youtube-music';
import { decideYouTubeCardFilter } from '@/filtering/decideYouTubeCardFilter';
import type { FilterDecision } from '@/filtering/contracts';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import type { PersistedSettings } from '@/storage/contracts';
import {
  applyYouTubeMusicRowFilter,
  clearAllYouTubeMusicRowFilters,
  clearYouTubeMusicRowFilter,
  findAppliedYouTubeMusicRowFilterElements,
  isYouTubeMusicRowFilterCurrent,
} from '@/ui/youtubeMusicRowFilter';

interface CandidateResult {
  expectedKey: string;
  result: WatchDisclosureLookupResult;
}

interface YouTubeMusicRowFilterDependencies {
  adapter: Pick<
    YouTubeMusicAdapter,
    'collectCandidates' | 'getCurrentUrl' | 'getRouteKey'
  >;
  document: Document;
  getSettings(): PersistedSettings;
  lookup(videoId: string): Promise<WatchDisclosureLookupResult>;
  reasonText: string;
}

export interface YouTubeMusicRowFilterController {
  processRoots(roots: readonly ParentNode[]): void;
  dispose(): void;
}

function candidateKey(candidate: YouTubeMusicMediaCandidate): string {
  return `${candidate.surface}|${candidate.snapshot.identity.videoId}`;
}

function decisionFingerprint(
  expectedKey: string,
  result: WatchDisclosureLookupResult,
  settings: PersistedSettings,
): string {
  return JSON.stringify({
    expectedKey,
    videoId: result.videoId,
    status: result.status,
    evidence: result.evidence,
    enabled: settings.enabled,
    mode: settings.mode,
  });
}

export function createYouTubeMusicRowFilterController(
  dependencies: YouTubeMusicRowFilterDependencies,
): YouTubeMusicRowFilterController {
  let routeKey = dependencies.adapter.getRouteKey(
    dependencies.adapter.getCurrentUrl(),
  );
  let expectedKeys = new WeakMap<Element, string>();
  let candidateResults = new WeakMap<Element, CandidateResult>();
  let appliedFingerprints = new WeakMap<Element, string>();
  let routeLookups = new Map<
    string,
    Promise<WatchDisclosureLookupResult>
  >();
  let disposed = false;

  const clearCandidate = (element: Element) => {
    clearYouTubeMusicRowFilter(element);
    appliedFingerprints.delete(element);
  };

  const renderResult = (
    candidate: YouTubeMusicMediaCandidate,
    expectedKey: string,
    result: WatchDisclosureLookupResult,
  ) => {
    const settings = dependencies.getSettings();
    const videoId = candidate.snapshot.identity.videoId;
    if (videoId === undefined || result.videoId !== videoId) {
      clearCandidate(candidate.element);
      return;
    }

    const decision: FilterDecision = decideYouTubeCardFilter({
      settings,
      disclosureStatus: result.status,
      evidence: result.evidence,
    });
    const fingerprint = decisionFingerprint(expectedKey, result, settings);
    if (
      appliedFingerprints.get(candidate.element) === fingerprint &&
      isYouTubeMusicRowFilterCurrent(candidate.element, decision)
    ) {
      return;
    }

    applyYouTubeMusicRowFilter(
      candidate.element,
      decision,
      dependencies.reasonText,
    );
    appliedFingerprints.set(candidate.element, fingerprint);
  };

  const readCurrentCandidate = (
    element: Element,
  ): YouTubeMusicMediaCandidate | undefined =>
    dependencies.adapter
      .collectCandidates(element)
      .find((candidate) => candidate.element === element);

  const lookupCandidate = (
    candidate: YouTubeMusicMediaCandidate,
    expectedKey: string,
  ) => {
    const videoId = candidate.snapshot.identity.videoId;
    if (videoId === undefined) {
      clearCandidate(candidate.element);
      return;
    }

    if (expectedKeys.get(candidate.element) === expectedKey) {
      return;
    }
    expectedKeys.set(candidate.element, expectedKey);
    clearCandidate(candidate.element);

    let lookup = routeLookups.get(videoId);
    if (lookup === undefined) {
      lookup = dependencies.lookup(videoId);
      routeLookups.set(videoId, lookup);
      void lookup.then(
        () => {
          if (routeLookups.get(videoId) === lookup) {
            routeLookups.delete(videoId);
          }
        },
        () => {
          if (routeLookups.get(videoId) === lookup) {
            routeLookups.delete(videoId);
          }
        },
      );
    }

    void lookup.then(
      (result) => {
        if (
          disposed ||
          expectedKeys.get(candidate.element) !== expectedKey ||
          !candidate.element.isConnected ||
          result.videoId !== videoId
        ) {
          return;
        }

        const currentCandidate = readCurrentCandidate(candidate.element);
        if (
          currentCandidate === undefined ||
          candidateKey(currentCandidate) !== expectedKey ||
          currentCandidate.snapshot.identity.videoId !== result.videoId
        ) {
          return;
        }

        candidateResults.set(candidate.element, { expectedKey, result });
        renderResult(currentCandidate, expectedKey, result);
      },
      () => undefined,
    );
  };

  const processRoots = (roots: readonly ParentNode[]) => {
    if (disposed) {
      return;
    }

    const nextRouteKey = dependencies.adapter.getRouteKey(
      dependencies.adapter.getCurrentUrl(),
    );
    if (routeKey !== nextRouteKey) {
      clearAllYouTubeMusicRowFilters(dependencies.document);
      routeKey = nextRouteKey;
      expectedKeys = new WeakMap<Element, string>();
      candidateResults = new WeakMap<Element, CandidateResult>();
      appliedFingerprints = new WeakMap<Element, string>();
      routeLookups = new Map<string, Promise<WatchDisclosureLookupResult>>();
    }

    const candidates = new Map<Element, YouTubeMusicMediaCandidate>();
    const filteredElements = new Set<Element>();
    for (const root of roots) {
      for (const candidate of dependencies.adapter.collectCandidates(root)) {
        candidates.set(candidate.element, candidate);
      }
      for (const element of findAppliedYouTubeMusicRowFilterElements(root)) {
        filteredElements.add(element);
      }
    }

    for (const element of filteredElements) {
      if (!candidates.has(element)) {
        clearCandidate(element);
        expectedKeys.delete(element);
        candidateResults.delete(element);
      }
    }

    const settings = dependencies.getSettings();
    for (const candidate of candidates.values()) {
      const expectedKey = candidateKey(candidate);
      const previousExpectedKey = expectedKeys.get(candidate.element);

      if (previousExpectedKey !== undefined && previousExpectedKey !== expectedKey) {
        clearCandidate(candidate.element);
        expectedKeys.delete(candidate.element);
        candidateResults.delete(candidate.element);
      }

      if (!settings.enabled) {
        clearCandidate(candidate.element);
        continue;
      }

      const previousResult = candidateResults.get(candidate.element);
      if (
        previousResult?.expectedKey === expectedKey &&
        previousResult.result.videoId === candidate.snapshot.identity.videoId
      ) {
        renderResult(candidate, expectedKey, previousResult.result);
        continue;
      }

      candidateResults.delete(candidate.element);
      lookupCandidate(candidate, expectedKey);
    }
  };

  return {
    processRoots,
    dispose() {
      disposed = true;
      clearAllYouTubeMusicRowFilters(dependencies.document);
      expectedKeys = new WeakMap<Element, string>();
      candidateResults = new WeakMap<Element, CandidateResult>();
      appliedFingerprints = new WeakMap<Element, string>();
      routeLookups.clear();
    },
  };
}
