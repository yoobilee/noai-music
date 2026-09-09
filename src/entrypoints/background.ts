import { createYouTubeWatchDisclosureLookupService } from '@/background/youtubeWatchDisclosureLookup';
import {
  isYouTubeWatchDisclosureLookupMessage,
  type WatchDisclosureLookupResult,
} from '@/shared/youtubeWatchDisclosure';
import { createYouTubeDisclosureCache } from '@/storage/youtubeDisclosureCache';

function isTrustedYouTubeSender(sender: {
  id?: string;
  url?: string;
}): boolean {
  if (sender.id !== browser.runtime.id || sender.url === undefined) {
    return false;
  }

  try {
    return new URL(sender.url).origin === 'https://www.youtube.com';
  } catch {
    return false;
  }
}

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
        !isTrustedYouTubeSender(sender)
      ) {
        return undefined;
      }

      return lookupService.lookup(message.videoId);
    },
  );
});
