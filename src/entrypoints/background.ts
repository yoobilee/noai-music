import { createYouTubeWatchDisclosureLookupService } from '@/background/youtubeWatchDisclosureLookup';
import { isTrustedWatchDisclosureSender } from '@/background/trustedWatchDisclosureSender';
import {
  isYouTubeWatchDisclosureLookupMessage,
  type WatchDisclosureLookupResult,
} from '@/shared/youtubeWatchDisclosure';
import { createYouTubeDisclosureCache } from '@/storage/youtubeDisclosureCache';

export default defineBackground(() => {
  const cache = createYouTubeDisclosureCache({
    async get(key) {
      return browser.storage.local.get(key);
    },
    async set(items) {
      await browser.storage.local.set(items);
    },
  });
  const lookupService = createYouTubeWatchDisclosureLookupService({ cache });

  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      sender,
    ): Promise<WatchDisclosureLookupResult> | undefined => {
      if (
        !isYouTubeWatchDisclosureLookupMessage(message) ||
        !isTrustedWatchDisclosureSender(sender, browser.runtime.id)
      ) {
        return undefined;
      }

      return lookupService.lookup(message.videoId);
    },
  );
});
