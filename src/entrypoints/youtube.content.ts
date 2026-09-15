import type { Browser } from 'wxt/browser';

import type { DomMediaCandidate } from '@/adapters/contracts';
import { createYouTubeAdapter } from '@/adapters/youtube';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { evaluateUserRules } from '@/filtering/userRules';
import { decideYouTubeCardFilter } from '@/filtering/decideYouTubeCardFilter';
import type { FilterDecision, FilterReason } from '@/filtering/contracts';
import { YOUTUBE_MATCH_PATTERNS } from '@/shared/sites';
import { requestWatchDisclosure } from '@/shared/requestWatchDisclosure';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import {
  ALLOWLIST_STORAGE_KEY,
  BLOCKLIST_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  type PersistedAllowlist,
  type PersistedBlocklist,
  type PersistedSettings,
} from '@/storage/contracts';
import {
  addAllowedArtist,
  addAllowedTrack,
  hasUnsupportedAllowlistSchemaVersion,
  isPersistedAllowlist,
  loadAllowlist,
  readAllowlistChange,
  saveAllowlist,
} from '@/storage/allowlist';
import {
  hasUnsupportedBlocklistSchemaVersion,
  isPersistedBlocklist,
  loadBlocklist,
  readBlocklistChange,
  saveBlocklist,
} from '@/storage/blocklist';
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

function decisionFingerprint(
  lookupKey: string,
  result: Pick<WatchDisclosureLookupResult, 'status' | 'evidence'>,
  settings: PersistedSettings,
  candidate: DomMediaCandidate,
): string {
  return JSON.stringify({
    lookupKey,
    status: result.status,
    evidence: result.evidence,
    enabled: settings.enabled,
    mode: settings.mode,
    videoId: candidate.snapshot.identity.videoId,
    channelId: candidate.snapshot.identity.channelId,
    channelHandle: candidate.snapshot.identity.channelHandle,
    artistIds: candidate.snapshot.identity.artistIds,
  });
}

export default defineContentScript({
  matches: YOUTUBE_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'ISOLATED',
  async main(ctx) {
    const adapter = createYouTubeAdapter();
    let [settings, allowlist, blocklist]: [
      PersistedSettings,
      PersistedAllowlist,
      PersistedBlocklist,
    ] =
      await Promise.all([
        loadSettings(browser.storage.local),
        loadAllowlist(browser.storage.local),
        loadBlocklist(browser.storage.local),
      ]);
    let routeKey = adapter.getRouteKey(adapter.getCurrentUrl());
    let allowlistWrite = Promise.resolve();
    let expectedLookupKeys = new WeakMap<Element, string>();
    let candidateResults = new WeakMap<Element, CandidateResult>();
    let appliedFingerprints = new WeakMap<Element, string>();
    let routeLookups = new Map<string, Promise<WatchDisclosureLookupResult>>();
    const getReasonText = (reason: FilterReason) =>
      browser.i18n.getMessage(
        reason === 'direct-block-track'
          ? 'directBlockTrackReason'
          : reason === 'direct-block-artist'
            ? 'directBlockArtistReason'
            : reason === 'direct-block-channel'
              ? 'directBlockChannelReason'
              : 'youtubeDisclosureReason',
      ) || 'NoAI · YouTube AI disclosure';

    const persistAllowlistUpdate = (
      update: (current: PersistedAllowlist) => PersistedAllowlist,
    ) => {
      allowlistWrite = allowlistWrite
        .then(async () => {
          const current = await loadAllowlist(browser.storage.local);
          allowlist = await saveAllowlist(
            browser.storage.local,
            update(current),
          );
        })
        .catch(() => undefined);
    };

    const renderResult = (
      candidate: DomMediaCandidate,
      lookupKey: string,
      result: Pick<WatchDisclosureLookupResult, 'status' | 'evidence'>,
    ) => {
      const decision: FilterDecision = decideYouTubeCardFilter({
        settings,
        identity: candidate.snapshot.identity,
        allowlist,
        blocklist,
        directBlockKinds: { artist: false, channel: true },
        disclosureStatus: result.status,
        evidence: result.evidence,
      });
      const fingerprint = decisionFingerprint(
        lookupKey,
        result,
        settings,
        candidate,
      );
      if (
        appliedFingerprints.get(candidate.element) === fingerprint &&
        isYouTubeCardFilterCurrent(candidate, decision)
      ) {
        return;
      }

      const currentArtistIds = new Set([
        ...candidate.snapshot.identity.artistIds,
        ...(candidate.snapshot.identity.channelId === undefined
          ? []
          : [candidate.snapshot.identity.channelId]),
      ]);
      const artistId =
        currentArtistIds.size === 1
          ? currentArtistIds.values().next().value
          : undefined;
      const candidateVideoId = candidate.snapshot.identity.videoId;
      applyYouTubeCardFilter(
        candidate,
        decision,
        decision.action === 'none' ? '' : getReasonText(decision.reason),
        {
        track:
          candidateVideoId === undefined
            ? undefined
            : {
                label:
                  browser.i18n.getMessage('allowThisTrack') ||
                  'Allow this track',
                onActivate: () => {
                  const currentCandidate = adapter
                    .collectCandidates(candidate.element)
                    .find(({ element }) => element === candidate.element);
                  if (
                    currentCandidate?.snapshot.identity.videoId ===
                    candidateVideoId
                  ) {
                    persistAllowlistUpdate((current) =>
                      addAllowedTrack(current, {
                        videoId: candidateVideoId,
                        ...(candidate.snapshot.title === undefined
                          ? {}
                          : { title: candidate.snapshot.title }),
                      }),
                    );
                  }
                },
              },
        artist:
          artistId === undefined
            ? undefined
            : {
                label:
                  browser.i18n.getMessage('allowThisArtist') ||
                  'Allow this artist',
                onActivate: () => {
                  const currentCandidate = adapter
                    .collectCandidates(candidate.element)
                    .find(({ element }) => element === candidate.element);
                  if (
                    currentCandidate?.snapshot.identity.artistIds.includes(
                      artistId,
                    )
                  ) {
                    persistAllowlistUpdate((current) =>
                      addAllowedArtist(current, { artistId }),
                    );
                  }
                },
              },
        },
      );
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
        lookup = requestWatchDisclosure(browser.runtime, videoId);
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

        const userRule = evaluateUserRules(
          candidate.snapshot.identity,
          allowlist,
          blocklist,
          { artist: false, channel: true },
        );
        if (userRule === 'allow') {
          clearYouTubeCardFilter(candidate.element);
          expectedLookupKeys.delete(candidate.element);
          candidateResults.delete(candidate.element);
          appliedFingerprints.delete(candidate.element);
          continue;
        }

        if (userRule !== 'none') {
          expectedLookupKeys.delete(candidate.element);
          candidateResults.delete(candidate.element);
          renderResult(candidate, lookupKey, {
            status: 'unknown-or-error',
            evidence: [],
          });
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
      const changedAllowlist = readAllowlistChange(changes, areaName);
      const changedBlocklist = readBlocklistChange(changes, areaName);
      if (changedSettings !== null) {
        settings = changedSettings;
        if (!isPersistedSettings(changes[SETTINGS_STORAGE_KEY]?.newValue)) {
          void saveSettings(browser.storage.local, settings).catch(
            () => undefined,
          );
        }
      }
      if (changedAllowlist !== null) {
        allowlist = changedAllowlist;
        if (
          !isPersistedAllowlist(changes[ALLOWLIST_STORAGE_KEY]?.newValue) &&
          !hasUnsupportedAllowlistSchemaVersion(
            changes[ALLOWLIST_STORAGE_KEY]?.newValue,
          )
        ) {
          void saveAllowlist(browser.storage.local, allowlist).catch(
            () => undefined,
          );
        }
      }
      if (changedBlocklist !== null) {
        blocklist = changedBlocklist;
        if (
          !isPersistedBlocklist(changes[BLOCKLIST_STORAGE_KEY]?.newValue) &&
          !hasUnsupportedBlocklistSchemaVersion(
            changes[BLOCKLIST_STORAGE_KEY]?.newValue,
          )
        ) {
          void saveBlocklist(browser.storage.local, blocklist).catch(
            () => undefined,
          );
        }
      }
      if (
        changedSettings === null &&
        changedAllowlist === null &&
        changedBlocklist === null
      ) {
        return;
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
