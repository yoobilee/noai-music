import type { Browser } from 'wxt/browser';

import { createYouTubeMusicAdapter } from '@/adapters/youtube-music';
import { requestWatchDisclosure } from '@/shared/requestWatchDisclosure';
import { YOUTUBE_MUSIC_MATCH_PATTERNS } from '@/shared/sites';
import { SETTINGS_STORAGE_KEY, type PersistedSettings } from '@/storage/contracts';
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
    let settings: PersistedSettings = await loadSettings(browser.storage.local);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentVideoId: () =>
        adapter.getNowPlayingCandidate()?.snapshot.identity.videoId,
      getSettings: () => settings,
      lookup: (videoId) => requestWatchDisclosure(browser.runtime, videoId),
      clickNext: (videoId) => adapter.clickNext(videoId),
    });
    const rowFilterController = createYouTubeMusicRowFilterController({
      adapter,
      document,
      getSettings: () => settings,
      lookup: (videoId) => requestWatchDisclosure(browser.runtime, videoId),
      reasonText:
        browser.i18n.getMessage('youtubeDisclosureReason') ||
        'NoAI · YouTube AI disclosure',
    });

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
