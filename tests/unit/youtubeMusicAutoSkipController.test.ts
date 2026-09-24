import { describe, expect, it, vi } from 'vitest';

import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import {
  DEFAULT_ALLOWLIST,
  DEFAULT_BLOCKLIST,
  DEFAULT_SETTINGS,
  type PersistedAllowlist,
} from '@/storage/contracts';
import { createYouTubeMusicAutoSkipController as createAutoSkipController } from '@/youtube-music/autoSkipController';

function createYouTubeMusicAutoSkipController(
  dependencies: Omit<
    Parameters<typeof createAutoSkipController>[0],
    'filterScope'
  > & {
    filterScope?: Parameters<typeof createAutoSkipController>[0]['filterScope'];
  },
) {
  return createAutoSkipController({ filterScope: 'all', ...dependencies });
}

function playerIdentity(
  videoId: string | undefined,
  artistIds: readonly string[] = [],
) {
  return videoId === undefined
    ? undefined
    : {
        site: 'youtube-music' as const,
        videoId,
        artistIds,
      };
}

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
    contentKind: 'unknown',
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
  it('passes content kind through a music-scoped disclosure decision', async () => {
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => playerIdentity('PlaybackA01'),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => DEFAULT_ALLOWLIST,
      filterScope: 'music',
      lookup: async () => lookupResult('PlaybackA01'),
      clickNext,
    });

    controller.processCurrent();
    await flushPromises();

    expect(clickNext).not.toHaveBeenCalled();
  });

  it('skips direct blocked tracks without starting disclosure lookup and allowlist wins', () => {
    let allowlist = DEFAULT_ALLOWLIST;
    const lookup = vi.fn(async (videoId: string) => lookupResult(videoId));
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => playerIdentity('PlaybackA01'),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => allowlist,
      getBlocklist: () => ({ ...DEFAULT_BLOCKLIST, tracks: [{ videoId: 'PlaybackA01' }] }),
      lookup,
      clickNext,
    });
    controller.processCurrent();
    expect(clickNext).toHaveBeenCalledOnce();
    expect(lookup).not.toHaveBeenCalled();
    controller.processCurrent();
    expect(clickNext).toHaveBeenCalledOnce();

    const second = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => playerIdentity('PlaybackA01'),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => allowlist,
      getBlocklist: () => ({ ...DEFAULT_BLOCKLIST, tracks: [{ videoId: 'PlaybackA01' }] }),
      lookup,
      clickNext,
    });
    allowlist = { ...DEFAULT_ALLOWLIST, tracks: [{ videoId: 'PlaybackA01' }] };
    second.processCurrent();
    expect(clickNext).toHaveBeenCalledOnce();
  });

  it('skips an unambiguously direct blocked artist without lookup', () => {
    const artistId = 'UCabcdefghijklmnopqrstuv';
    const lookup = vi.fn(async (videoId: string) => lookupResult(videoId));
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => playerIdentity('PlaybackA01', [artistId]),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => DEFAULT_ALLOWLIST,
      getBlocklist: () => ({ ...DEFAULT_BLOCKLIST, artists: [{ artistId }] }),
      lookup,
      clickNext,
    });
    controller.processCurrent();
    expect(clickNext).toHaveBeenCalledWith('PlaybackA01');
    expect(lookup).not.toHaveBeenCalled();
  });
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
      getCurrentIdentity: () => playerIdentity(currentVideoId),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => DEFAULT_ALLOWLIST,
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
      getCurrentIdentity: () => playerIdentity(currentVideoId),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => DEFAULT_ALLOWLIST,
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
      getCurrentIdentity: () => undefined,
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => DEFAULT_ALLOWLIST,
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
      getCurrentIdentity: () => playerIdentity('PlaybackA01'),
      getSettings: () => settings,
      getAllowlist: () => DEFAULT_ALLOWLIST,
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
      getCurrentIdentity: () => playerIdentity('PlaybackA01'),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => DEFAULT_ALLOWLIST,
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
      getCurrentIdentity: () => playerIdentity('PlaybackB01'),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => DEFAULT_ALLOWLIST,
      lookup: async () => lookupResult('PlaybackB01'),
      clickNext: throwingClick,
    });
    throwingController.processCurrent();
    await flushPromises();
    throwingController.processCurrent();
    expect(throwingClick).toHaveBeenCalledTimes(1);
  });

  it('does not look up or skip an allowlisted track or artist', () => {
    const artistId = 'UCabcdefghijklmnopqrstuv';
    let currentIdentity = playerIdentity('PlaybackA01');
    let allowlist: PersistedAllowlist = {
      ...DEFAULT_ALLOWLIST,
      tracks: [{ videoId: 'PlaybackA01' }],
    };
    const lookup = vi.fn();
    const clickNext = vi.fn();
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => currentIdentity,
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => allowlist,
      lookup,
      clickNext,
    });

    controller.processCurrent();
    expect(lookup).not.toHaveBeenCalled();

    currentIdentity = playerIdentity('PlaybackB01', [artistId]);
    allowlist = {
      ...DEFAULT_ALLOWLIST,
      artists: [{ artistId }],
    };
    controller.processCurrent();

    expect(lookup).not.toHaveBeenCalled();
    expect(clickNext).not.toHaveBeenCalled();
  });

  it('keeps the current generation allowed after removal and evaluates the next generation', async () => {
    let currentVideoId = 'PlaybackA01';
    let allowlist: PersistedAllowlist = {
      ...DEFAULT_ALLOWLIST,
      tracks: [{ videoId: currentVideoId }],
    };
    const lookup = vi.fn(async (videoId: string) => lookupResult(videoId));
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => playerIdentity(currentVideoId),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => allowlist,
      lookup,
      clickNext,
    });

    controller.processCurrent();
    allowlist = DEFAULT_ALLOWLIST;
    controller.processCurrent();
    await flushPromises();
    expect(lookup).not.toHaveBeenCalled();
    expect(clickNext).not.toHaveBeenCalled();

    currentVideoId = 'PlaybackB01';
    controller.processCurrent();
    await flushPromises();
    expect(lookup).toHaveBeenCalledWith('PlaybackB01');
    expect(clickNext).toHaveBeenCalledWith('PlaybackB01');
  });

  it('honors an allowlist update while a lookup is pending', async () => {
    const request = deferred<WatchDisclosureLookupResult>();
    let allowlist: PersistedAllowlist = DEFAULT_ALLOWLIST;
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => playerIdentity('PlaybackA01'),
      getSettings: () => DEFAULT_SETTINGS,
      getAllowlist: () => allowlist,
      lookup: () => request.promise,
      clickNext,
    });

    controller.processCurrent();
    allowlist = {
      ...DEFAULT_ALLOWLIST,
      tracks: [{ videoId: 'PlaybackA01' }],
    };
    controller.processCurrent();
    request.resolve(lookupResult('PlaybackA01'));
    await flushPromises();

    expect(clickNext).not.toHaveBeenCalled();
  });

  it('retains the current allowlist generation while auto-skip is disabled', async () => {
    let settings = { ...DEFAULT_SETTINGS, youtubeMusicAutoSkip: false };
    let allowlist: PersistedAllowlist = {
      ...DEFAULT_ALLOWLIST,
      tracks: [{ videoId: 'PlaybackA01' }],
    };
    const lookup = vi.fn(async (videoId: string) => lookupResult(videoId));
    const clickNext = vi.fn(() => true);
    const controller = createYouTubeMusicAutoSkipController({
      getCurrentIdentity: () => playerIdentity('PlaybackA01'),
      getSettings: () => settings,
      getAllowlist: () => allowlist,
      lookup,
      clickNext,
    });

    controller.processCurrent();
    allowlist = DEFAULT_ALLOWLIST;
    settings = { ...settings, youtubeMusicAutoSkip: true };
    controller.processCurrent();
    await flushPromises();

    expect(lookup).not.toHaveBeenCalled();
    expect(clickNext).not.toHaveBeenCalled();
  });
});
