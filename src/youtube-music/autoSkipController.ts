import { decideYouTubeMusicAutoSkip } from '@/filtering/decideYouTubeMusicAutoSkip';
import type { MediaIdentity } from '@/detection/contracts';
import { isMediaAllowed } from '@/filtering/allowlist';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import type {
  PersistedAllowlist,
  PersistedSettings,
} from '@/storage/contracts';

interface PlaybackState {
  generation: number;
  videoId: string;
  lookupStarted: boolean;
  result?: WatchDisclosureLookupResult;
  resultEvaluated: boolean;
  suppressedByAllowlist: boolean;
}

interface YouTubeMusicAutoSkipDependencies {
  getCurrentIdentity(): MediaIdentity | undefined;
  getSettings(): PersistedSettings;
  getAllowlist(): PersistedAllowlist;
  lookup(videoId: string): Promise<WatchDisclosureLookupResult>;
  clickNext(expectedVideoId: string): boolean;
}

export interface YouTubeMusicAutoSkipController {
  processCurrent(): void;
  dispose(): void;
}

export function createYouTubeMusicAutoSkipController(
  dependencies: YouTubeMusicAutoSkipDependencies,
): YouTubeMusicAutoSkipController {
  let generation = 0;
  let playback: PlaybackState | undefined;
  let blockedUntilDifferentVideoId: string | undefined;
  let disposed = false;

  const processCurrent = () => {
    if (disposed) {
      return;
    }

    const currentIdentity = dependencies.getCurrentIdentity();
    const currentVideoId = currentIdentity?.videoId;
    if (currentIdentity === undefined || currentVideoId === undefined) {
      if (playback !== undefined) {
        generation += 1;
        playback = undefined;
      }
      return;
    }

    if (blockedUntilDifferentVideoId !== undefined) {
      if (currentVideoId === blockedUntilDifferentVideoId) {
        return;
      }
      blockedUntilDifferentVideoId = undefined;
    }

    if (playback?.videoId !== currentVideoId) {
      generation += 1;
      playback = {
        generation,
        videoId: currentVideoId,
        lookupStarted: false,
        resultEvaluated: false,
        suppressedByAllowlist: false,
      };
    }

    const currentPlayback = playback;
    const settings = dependencies.getSettings();
    if (isMediaAllowed(currentIdentity, dependencies.getAllowlist())) {
      currentPlayback.suppressedByAllowlist = true;
    }
    if (currentPlayback.suppressedByAllowlist) {
      return;
    }
    if (!settings.enabled || !settings.youtubeMusicAutoSkip) {
      return;
    }

    if (currentPlayback.result !== undefined) {
      if (currentPlayback.resultEvaluated) {
        return;
      }
      currentPlayback.resultEvaluated = true;

      if (
        !decideYouTubeMusicAutoSkip({
          settings,
          expectedVideoId: currentPlayback.videoId,
          currentVideoId,
          currentIdentity,
          allowlist: dependencies.getAllowlist(),
          result: currentPlayback.result,
        })
      ) {
        return;
      }

      blockedUntilDifferentVideoId = currentPlayback.videoId;
      dependencies.clickNext(currentPlayback.videoId);
      return;
    }

    if (currentPlayback.lookupStarted) {
      return;
    }
    currentPlayback.lookupStarted = true;
    const expectedGeneration = currentPlayback.generation;
    const expectedVideoId = currentPlayback.videoId;

    void dependencies
      .lookup(expectedVideoId)
      .then((result) => {
        if (
          disposed ||
          playback?.generation !== expectedGeneration ||
          playback.videoId !== expectedVideoId ||
          dependencies.getCurrentIdentity()?.videoId !== expectedVideoId
        ) {
          return;
        }

        playback.result = result;
        processCurrent();
      })
      .catch(() => undefined);
  };

  return {
    processCurrent,
    dispose() {
      disposed = true;
      generation += 1;
      playback = undefined;
    },
  };
}
