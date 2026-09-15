import type { Browser } from 'wxt/browser';

import { createYouTubeMusicAdapter } from '@/adapters/youtube-music';
import { requestWatchDisclosure } from '@/shared/requestWatchDisclosure';
import { YOUTUBE_MUSIC_MATCH_PATTERNS } from '@/shared/sites';
import {
  ALLOWLIST_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  type PersistedAllowlist,
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
  isPersistedSettings,
  loadSettings,
  readSettingsChange,
  saveSettings,
} from '@/storage/settings';
import { createYouTubeMusicAutoSkipController } from '@/youtube-music/autoSkipController';
import { createYouTubeMusicRowFilterController } from '@/youtube-music/rowFilterController';

export default defineContentScript({
  matches: YOUTUBE_MUSIC_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'ISOLATED',
  async main(ctx) {
    const adapter = createYouTubeMusicAdapter();
    let [settings, allowlist]: [PersistedSettings, PersistedAllowlist] =
      await Promise.all([
        loadSettings(browser.storage.local),
        loadAllowlist(browser.storage.local),
      ]);
    let allowlistWrite = Promise.resolve();
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
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () =>
        adapter.getNowPlayingCandidate()?.snapshot.identity,
      getSettings: () => settings,
      getAllowlist: () => allowlist,
      lookup: (videoId) => requestWatchDisclosure(browser.runtime, videoId),
      clickNext: (videoId) => adapter.clickNext(videoId),
    });
    const rowFilterController = createYouTubeMusicRowFilterController({
      adapter,
      document,
      getSettings: () => settings,
      getAllowlist: () => allowlist,
      lookup: (videoId) => requestWatchDisclosure(browser.runtime, videoId),
      reasonText:
        browser.i18n.getMessage('youtubeDisclosureReason') ||
        'NoAI · YouTube AI disclosure',
      allowTrackLabel:
        browser.i18n.getMessage('allowThisTrack') || 'Allow this track',
      allowArtistLabel:
        browser.i18n.getMessage('allowThisArtist') || 'Allow this artist',
      onAllowTrack: (candidate) => {
        const videoId = candidate.snapshot.identity.videoId;
        if (videoId !== undefined) {
          persistAllowlistUpdate((current) =>
            addAllowedTrack(current, {
              videoId,
              ...(candidate.snapshot.title === undefined
                ? {}
                : { title: candidate.snapshot.title }),
            }),
          );
        }
      },
      onAllowArtist: (_candidate, artistId) => {
        persistAllowlistUpdate((current) =>
          addAllowedArtist(current, { artistId }),
        );
      },
    });

    const handleStorageChange = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      const changedSettings = readSettingsChange(changes, areaName);
      const changedAllowlist = readAllowlistChange(changes, areaName);
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
      if (changedSettings === null && changedAllowlist === null) {
        return;
      }
      controller.processCurrent();
      rowFilterController.processRoots([document]);
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    controller.processCurrent();
    rowFilterController.processRoots([document]);
    const stopObservingPlayer = adapter.observePlayer(
      controller.processCurrent,
    );
    const stopObservingPage = adapter.observePage(
      rowFilterController.processRoots,
    );

    ctx.onInvalidated(() => {
      stopObservingPlayer();
      stopObservingPage();
      controller.dispose();
      rowFilterController.dispose();
      browser.storage.onChanged.removeListener(handleStorageChange);
    });
  },
});
