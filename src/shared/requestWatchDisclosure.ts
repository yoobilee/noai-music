import {
  isWatchDisclosureLookupResult,
  YOUTUBE_WATCH_DISCLOSURE_MESSAGE,
  type WatchDisclosureLookupResult,
} from './youtubeWatchDisclosure';

interface RuntimeMessenger {
  sendMessage(message: unknown): Promise<unknown>;
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

export async function requestWatchDisclosure(
  runtime: RuntimeMessenger,
  videoId: string,
): Promise<WatchDisclosureLookupResult> {
  try {
    const response = await runtime.sendMessage({
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
