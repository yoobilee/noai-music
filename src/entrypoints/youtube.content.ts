import type { Browser } from 'wxt/browser';

import type { DomMediaCandidate } from '@/adapters/contracts';
import { createYouTubeAdapter } from '@/adapters/youtube';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { decideYouTubeCardFilter } from '@/filtering/decideYouTubeCardFilter';
import type { FilterDecision } from '@/filtering/contracts';
import { YOUTUBE_MATCH_PATTERNS } from '@/shared/sites';
import {
  isWatchDisclosureLookupResult,
  YOUTUBE_WATCH_DISCLOSURE_MESSAGE,
  type WatchDisclosureLookupResult,
} from '@/shared/youtubeWatchDisclosure';
import { SETTINGS_STORAGE_KEY, type PersistedSettings } from '@/storage/contracts';
import {
  isPersistedSettings,
  loadSettings,
  readSettingsChange,
  saveSettings,
} from '@/storage/settings';
import {
  applyYouTubeCardFilter,
  clearAllYouTubeCardFilters,
  clearYouTubeCardFilter,
  findAppliedFilterElements,
  isYouTubeCardFilterCurrent,
} from '@/ui/youtubeCardFilter';

interface CandidateResult {
  lookupKey: string;
  result: WatchDisclosureLookupResult;
}

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

function decisionFingerprint(
  lookupKey: string,
  result: Pick<WatchDisclosureLookupResult, 'status' | 'evidence'>,
  settings: PersistedSettings,
): string {
  return JSON.stringify({
    lookupKey,
    status: result.status,
    evidence: result.evidence,
    enabled: settings.enabled,
    mode: settings.mode,
  });
}

export default defineContentScript({
  matches: YOUTUBE_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'ISOLATED',
  async main(ctx) {
    const adapter = createYouTubeAdapter();
    let settings = await loadSettings(browser.storage.local);
    let routeKey = adapter.getRouteKey(adapter.getCurrentUrl());
    let expectedLookupKeys = new WeakMap<Element, string>();
    let candidateResults = new WeakMap<Element, CandidateResult>();
    let appliedFingerprints = new WeakMap<Element, string>();
    let routeLookups = new Map<string, Promise<WatchDisclosureLookupResult>>();
    const reasonText =
      browser.i18n.getMessage('youtubeDisclosureReason') ||
      'NoAI · YouTube AI disclosure';

    const renderResult = (
      candidate: DomMediaCandidate,
      lookupKey: string,
      result: Pick<WatchDisclosureLookupResult, 'status' | 'evidence'>,
    ) => {
      const decision: FilterDecision = decideYouTubeCardFilter({
        settings,
        disclosureStatus: result.status,
        evidence: result.evidence,
      });
      const fingerprint = decisionFingerprint(lookupKey, result, settings);
      if (
        appliedFingerprints.get(candidate.element) === fingerprint &&
        isYouTubeCardFilterCurrent(candidate.element, decision)
      ) {
        return;
      }

      applyYouTubeCardFilter(candidate, decision, reasonText);
      appliedFingerprints.set(candidate.element, fingerprint);
    };

    const lookupCard = (candidate: DomMediaCandidate, lookupKey: string) => {
      const videoId = candidate.snapshot.identity.videoId;
      if (videoId === undefined) {
        clearYouTubeCardFilter(candidate.element);
        return;
      }

      if (expectedLookupKeys.get(candidate.element) === lookupKey) {
        return;
      }
      expectedLookupKeys.set(candidate.element, lookupKey);
      renderResult(candidate, lookupKey, {
        status: 'unknown-or-error',
        evidence: [],
      });

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
          candidateResults.set(candidate.element, { lookupKey, result });
          renderResult(candidate, lookupKey, result);
        }
      });
    };

    const processRoots = (roots: readonly ParentNode[]) => {
      const nextRouteKey = adapter.getRouteKey(adapter.getCurrentUrl());
      if (routeKey !== nextRouteKey) {
        clearAllYouTubeCardFilters(document);
        routeKey = nextRouteKey;
        expectedLookupKeys = new WeakMap<Element, string>();
        candidateResults = new WeakMap<Element, CandidateResult>();
        appliedFingerprints = new WeakMap<Element, string>();
        routeLookups = new Map<string, Promise<WatchDisclosureLookupResult>>();
      }

      const candidates = new Map<Element, DomMediaCandidate>();
      const filteredElements = new Set<Element>();
      for (const root of roots) {
        for (const candidate of adapter.collectCandidates(root)) {
          candidates.set(candidate.element, candidate);
        }
        for (const element of findAppliedFilterElements(root)) {
          filteredElements.add(element);
        }
      }

      for (const element of filteredElements) {
        if (!candidates.has(element)) {
          clearYouTubeCardFilter(element);
          expectedLookupKeys.delete(element);
          candidateResults.delete(element);
          appliedFingerprints.delete(element);
        }
      }

      for (const candidate of candidates.values()) {
        const videoId = candidate.snapshot.identity.videoId;
        const lookupKey = `${routeKey}|${videoId ?? 'missing'}`;

        if (candidate.surface !== 'video-card' || videoId === undefined) {
          clearYouTubeCardFilter(candidate.element);
          expectedLookupKeys.delete(candidate.element);
          candidateResults.delete(candidate.element);
          continue;
        }

        const detection = detectYouTubeOfficialDisclosure(
          adapter.readOfficialDisclosures(candidate),
        );
        if (detection.detected) {
          expectedLookupKeys.delete(candidate.element);
          candidateResults.delete(candidate.element);
          renderResult(candidate, lookupKey, {
            status: 'confirmed',
            evidence: detection.evidence,
          });
          continue;
        }

        const previousResult = candidateResults.get(candidate.element);
        if (previousResult?.lookupKey === lookupKey) {
          renderResult(candidate, lookupKey, previousResult.result);
          continue;
        }

        candidateResults.delete(candidate.element);
        lookupCard(candidate, lookupKey);
      }
    };

    const handleStorageChange = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      const changedSettings = readSettingsChange(changes, areaName);
      if (changedSettings === null) {
        return;
      }

      settings = changedSettings;
      if (!isPersistedSettings(changes[SETTINGS_STORAGE_KEY]?.newValue)) {
        void saveSettings(browser.storage.local, settings).catch(() => undefined);
      }
      processRoots([document]);
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    processRoots([document]);
    const stopObserving = adapter.observePage(processRoots);
    ctx.onInvalidated(() => {
      stopObserving();
      browser.storage.onChanged.removeListener(handleStorageChange);
      clearAllYouTubeCardFilters(document);
    });
  },
});
