import { describe, expect, it, vi } from 'vitest';

import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import { DEFAULT_SETTINGS } from '@/storage/contracts';
import { createYouTubeMusicAutoSkipController } from '@/youtube-music/autoSkipController';

const confirmedEvidence: OfficialDisclosureEvidence[] = [
  {
    source: 'youtube',
    kind: 'made-with-ai',
    matchedText: 'AI: Content was made with AI',
    confidence: 'confirmed',
    location: 'metadata-badge',
    evidenceType: 'accessibility-label',
  },
];

function lookupResult(
  videoId: string,
  status: WatchDisclosureLookupResult['status'] = 'confirmed',
): WatchDisclosureLookupResult {
  return {
    videoId,
    status,
    evidence: status === 'confirmed' ? confirmedEvidence : [],
    checkedAt: 1,
    source: 'network',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('YouTube Music auto-skip playback lifecycle', () => {
  it('clicks once per playback generation and allows sequential confirmed tracks', async () => {
    let currentVideoId: string | undefined = 'PlaybackA01';
    const pending = new Map<
      string,
      ReturnType<typeof deferred<WatchDisclosureLookupResult>>
    >();
    const lookup = vi.fn((videoId: string) => {
      const request = deferred<WatchDisclosureLookupResult>();
      pending.set(videoId, request);
      return request.promise;
    });
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentVideoId: () => currentVideoId,
      getSettings: () => DEFAULT_SETTINGS,
      lookup,
      clickNext,
    });

    controller.processCurrent();
    controller.processCurrent();
    expect(lookup).toHaveBeenCalledTimes(1);

    pending.get('PlaybackA01')?.resolve(lookupResult('PlaybackA01'));
    await flushPromises();
    controller.processCurrent();
    controller.processCurrent();
    expect(clickNext).toHaveBeenCalledTimes(1);
    expect(clickNext).toHaveBeenLastCalledWith('PlaybackA01');

    currentVideoId = undefined;
    controller.processCurrent();
    currentVideoId = 'PlaybackA01';
    controller.processCurrent();
    expect(clickNext).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledTimes(1);

    currentVideoId = 'PlaybackB01';
    controller.processCurrent();
    pending.get('PlaybackB01')?.resolve(lookupResult('PlaybackB01'));
    await flushPromises();
    expect(clickNext).toHaveBeenCalledTimes(2);
    expect(clickNext).toHaveBeenLastCalledWith('PlaybackB01');

    currentVideoId = 'PlaybackA01';
    controller.processCurrent();
    expect(lookup).toHaveBeenCalledTimes(3);
    pending.get('PlaybackA01')?.resolve(lookupResult('PlaybackA01'));
    await flushPromises();
    expect(clickNext).toHaveBeenCalledTimes(3);
  });

  it('discards a confirmed result after the player changes', async () => {
    let currentVideoId: string | undefined = 'PlaybackA01';
    const first = deferred<WatchDisclosureLookupResult>();
    const lookup = vi.fn((videoId: string) =>
      videoId === 'PlaybackA01'
        ? first.promise
        : Promise.resolve(lookupResult(videoId, 'not-detected')),
    );
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentVideoId: () => currentVideoId,
      getSettings: () => DEFAULT_SETTINGS,
      lookup,
      clickNext,
    });

    controller.processCurrent();
    currentVideoId = 'PlaybackB01';
    controller.processCurrent();
    first.resolve(lookupResult('PlaybackA01'));
    await flushPromises();

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(clickNext).not.toHaveBeenCalled();
  });

  it('does not look up or skip without a current player identity', () => {
    const lookup = vi.fn();
    const clickNext = vi.fn();
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentVideoId: () => undefined,
      getSettings: () => DEFAULT_SETTINGS,
      lookup,
      clickNext,
    });

    controller.processCurrent();

    expect(lookup).not.toHaveBeenCalled();
    expect(clickNext).not.toHaveBeenCalled();
  });

  it('applies setting changes without losing an already resolved current result', async () => {
    let settings = { ...DEFAULT_SETTINGS, youtubeMusicAutoSkip: false };
    const request = deferred<WatchDisclosureLookupResult>();
    const lookup = vi.fn(() => request.promise);
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentVideoId: () => 'PlaybackA01',
      getSettings: () => settings,
      lookup,
      clickNext,
    });

    controller.processCurrent();
    expect(lookup).not.toHaveBeenCalled();

    settings = { ...settings, youtubeMusicAutoSkip: true };
    controller.processCurrent();
    expect(lookup).toHaveBeenCalledTimes(1);

    settings = { ...settings, enabled: false };
    request.resolve(lookupResult('PlaybackA01'));
    await flushPromises();
    expect(clickNext).not.toHaveBeenCalled();

    settings = { ...settings, enabled: true };
    controller.processCurrent();
    expect(clickNext).toHaveBeenCalledTimes(1);
  });

  it('never retries the same playback after a failed or throwing click', async () => {
    const clickNext = vi.fn(() => false);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentVideoId: () => 'PlaybackA01',
      getSettings: () => DEFAULT_SETTINGS,
      lookup: async () => lookupResult('PlaybackA01'),
      clickNext,
    });

    controller.processCurrent();
    await flushPromises();
    controller.processCurrent();
    controller.processCurrent();
    expect(clickNext).toHaveBeenCalledTimes(1);

    const throwingClick = vi.fn(() => {
      throw new Error('synthetic click failure');
    });
    const throwingController = createYouTubeMusicAutoSkipController({
      getCurrentVideoId: () => 'PlaybackB01',
      getSettings: () => DEFAULT_SETTINGS,
      lookup: async () => lookupResult('PlaybackB01'),
      clickNext: throwingClick,
    });
    throwingController.processCurrent();
    await flushPromises();
    throwingController.processCurrent();
    expect(throwingClick).toHaveBeenCalledTimes(1);
  });
});
