// @vitest-environment happy-dom

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createYouTubeAdapter } from '@/adapters/youtube';
import type { FilterDecision } from '@/filtering/contracts';
import {
  applyYouTubeCardFilter,
  FILTER_ACTION_ATTRIBUTE,
  FILTER_REASON_BADGE_ATTRIBUTE,
} from '@/ui/youtubeCardFilter';

const fixtureHtml = await readFile(
  resolve('tests/fixtures/youtube/video-cards.html'),
  'utf8',
);
const channelVideosFixtureHtml = await readFile(
  resolve('tests/fixtures/youtube/channel-videos.html'),
  'utf8',
);

const decision = (action: 'hide' | 'blur' | 'mark'): FilterDecision => ({
  action,
  reason: 'youtube-official-ai-disclosure',
});

function createAdapter(
  currentUrl = new URL('https://www.youtube.com/'),
) {
  return createYouTubeAdapter({
    document,
    getCurrentUrl: () => currentUrl,
    createMutationObserver: (callback) => new MutationObserver(callback),
    requestAnimationFrame: (callback) => requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
  });
}

describe('YouTube video card identity extraction', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = fixtureHtml;
  });

  it('extracts IDs from home, search, related and playlist video units', () => {
    const candidates = createAdapter().collectCandidates(document);
    const identities = Object.fromEntries(
      candidates.map(({ element, snapshot }) => [
        element.getAttribute('data-testid'),
        snapshot.identity.videoId,
      ]),
    );

    expect(identities).toMatchObject({
      'home-video': 'HomeVid0001',
      'search-video': 'SearchVid01',
      'related-video': 'Related0001',
      'playlist-video': 'Playlist001',
    });
  });

  it('extracts only stable UC channel identities from confirmed channel links', () => {
    const candidates = createAdapter().collectCandidates(document);
    const home = candidates.find(
      ({ element }) => element.getAttribute('data-testid') === 'home-video',
    );
    const search = candidates.find(
      ({ element }) => element.getAttribute('data-testid') === 'search-video',
    );

    expect(home?.snapshot.identity).toMatchObject({
      channelId: 'UCabcdefghijklmnopqrstuv',
      artistIds: ['UCabcdefghijklmnopqrstuv'],
    });
    expect(search?.snapshot.identity).toMatchObject({
      channelId: 'UCzyxwvutsrqponmlkjihgfe',
      artistIds: ['UCzyxwvutsrqponmlkjihgfe'],
    });
  });

  it('extracts exact ASCII and Unicode handles without a UC link', () => {
    const candidates = createAdapter().collectCandidates(document);
    const handle = candidates.find(({ element }) => element.getAttribute('data-testid') === 'handle-video');
    const korean = candidates.find(({ element }) => element.getAttribute('data-testid') === 'korean-handle-video');
    expect(handle?.snapshot.identity).toMatchObject({ channelHandle: '@example', artistIds: [] });
    expect(handle?.snapshot.identity.channelId).toBeUndefined();
    expect(korean?.snapshot.identity).toMatchObject({ channelHandle: '@블루레인', artistIds: [] });
  });

  it('uses the exact channel Videos route when a card omits channel metadata', () => {
    document.documentElement.innerHTML = channelVideosFixtureHtml;
    const candidate = createAdapter(
      new URL(
        'https://www.youtube.com/%40%EB%B8%94%EB%A3%A8%EB%A0%88%EC%9D%B8/videos',
      ),
    )
      .collectCandidates(document)
      .find(
        ({ element }) =>
          element.getAttribute('data-testid') === 'channel-route-video',
      );

    expect(candidate?.snapshot.identity.channelHandle).toBe('@블루레인');
  });

  it('uses a UC channel Videos route when a card omits channel metadata', () => {
    document.documentElement.innerHTML = channelVideosFixtureHtml;
    const channelId = 'UCabcdefghijklmnopqrstuv';
    const candidate = createAdapter(
      new URL(`https://www.youtube.com/channel/${channelId}/videos`),
    )
      .collectCandidates(document)
      .find(
        ({ element }) =>
          element.getAttribute('data-testid') === 'channel-route-video',
      );

    expect(candidate?.snapshot.identity.channelId).toBe(channelId);
    expect(candidate?.snapshot.identity.artistIds).toEqual([]);
  });

  it('does not use a channel route on unsupported tabs or over explicit card identity', () => {
    document.documentElement.innerHTML = channelVideosFixtureHtml;
    const videosCandidates = createAdapter(
      new URL('https://www.youtube.com/@example/videos'),
    ).collectCandidates(document);
    const explicit = videosCandidates.find(
      ({ element }) =>
        element.getAttribute('data-testid') === 'explicit-other-channel-video',
    );
    const home = createAdapter(
      new URL('https://www.youtube.com/@example'),
    )
      .collectCandidates(document)
      .find(
        ({ element }) =>
          element.getAttribute('data-testid') === 'channel-route-video',
      );

    expect(explicit?.snapshot.identity.channelHandle).toBe('@other-channel');
    expect(home?.snapshot.identity.channelHandle).toBeUndefined();
    expect(home?.snapshot.identity.channelId).toBeUndefined();
  });

  it('does not fall back when card channel metadata is ambiguous', () => {
    document.documentElement.innerHTML = channelVideosFixtureHtml;
    const metadata = document.querySelector(
      '[data-testid="explicit-other-channel-video"] yt-content-metadata-view-model',
    );
    metadata?.insertAdjacentHTML(
      'beforeend',
      '<a href="/@second-channel">Second channel</a>',
    );
    const explicit = createAdapter(
      new URL('https://www.youtube.com/@example/videos'),
    )
      .collectCandidates(document)
      .find(
        ({ element }) =>
          element.getAttribute('data-testid') === 'explicit-other-channel-video',
      );

    expect(explicit?.snapshot.identity.channelHandle).toBeUndefined();
  });

  it('reads the current route on every collection after SPA navigation', () => {
    document.documentElement.innerHTML = channelVideosFixtureHtml;
    let currentUrl = new URL('https://www.youtube.com/@channel-a/videos');
    const adapter = createYouTubeAdapter({
      document,
      getCurrentUrl: () => currentUrl,
      createMutationObserver: (callback) => new MutationObserver(callback),
      requestAnimationFrame: (callback) => requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
    });
    const readHandle = () =>
      adapter
        .collectCandidates(document)
        .find(
          ({ element }) =>
            element.getAttribute('data-testid') === 'channel-route-video',
        )?.snapshot.identity.channelHandle;

    expect(readHandle()).toBe('@channel-a');
    currentUrl = new URL('https://www.youtube.com/@channel-b/videos');
    expect(readHandle()).toBe('@channel-b');
  });

  it('keeps the card filter overlay anchor inside the thumbnail surface', () => {
    const candidates = createAdapter().collectCandidates(document);
    const home = candidates.find(
      ({ element }) => element.getAttribute('data-testid') === 'home-video',
    );
    const related = candidates.find(
      ({ element }) => element.getAttribute('data-testid') === 'related-video',
    );

    const homeAnchor = home?.filterOverlayAnchor;
    expect(homeAnchor?.tagName).toBe('YT-THUMBNAIL-VIEW-MODEL');
    expect(home?.element.contains(homeAnchor!)).toBe(true);
    expect(homeAnchor).not.toBe(home?.element);
    const homeAnchorPath: string[] = [];
    let current = homeAnchor?.parentElement;
    while (current && current !== home?.element) {
      homeAnchorPath.push(
        current.id
          ? `${current.tagName.toLowerCase()}#${current.id}`
          : current.tagName.toLowerCase(),
      );
      current = current.parentElement;
    }
    expect(current).toBe(home?.element);
    expect(homeAnchorPath).toEqual([
      'a',
      'div',
      'yt-lockup-view-model',
      'div#content',
    ]);
    expect(related?.filterOverlayAnchor?.tagName).toBe(
      'YT-THUMBNAIL-VIEW-MODEL',
    );
  });

  it('resolves a mutation inside a nested lockup back to the outer rich item', () => {
    const mutationRoot = document.querySelector(
      '[data-testid="home-video"] .ytThumbnailViewModelImage',
    );
    expect(mutationRoot).not.toBeNull();

    const candidates = createAdapter().collectCandidates(mutationRoot!);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.element.getAttribute('data-testid')).toBe(
      'home-video',
    );
    expect(candidates[0]?.filterOverlayAnchor?.tagName).toBe(
      'YT-THUMBNAIL-VIEW-MODEL',
    );
  });

  it.each([
    'home-video',
    'search-video',
    'related-video',
    'playlist-video',
  ])('connects the %s adapter candidate to every filter mode', (testId) => {
    const candidate = createAdapter()
      .collectCandidates(document)
      .find(({ element }) => element.getAttribute('data-testid') === testId);
    expect(candidate).toBeDefined();

    applyYouTubeCardFilter(candidate!, decision('hide'), 'reason');
    expect(candidate!.element.getAttribute(FILTER_ACTION_ATTRIBUTE)).toBe(
      'hide',
    );

    applyYouTubeCardFilter(candidate!, decision('blur'), 'reason');
    expect(candidate!.element.getAttribute(FILTER_ACTION_ATTRIBUTE)).toBe(
      'blur',
    );
    const blurBadge = candidate!.element.querySelector(
      `[${FILTER_REASON_BADGE_ATTRIBUTE}]`,
    );
    expect(blurBadge?.parentElement).toBe(candidate!.filterOverlayAnchor);
    expect(blurBadge?.parentElement).not.toBe(candidate!.element);

    applyYouTubeCardFilter(candidate!, decision('mark'), 'reason');
    expect(candidate!.element.getAttribute(FILTER_ACTION_ATTRIBUTE)).toBe(
      'mark',
    );
    expect(
      candidate!.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(1);

    applyYouTubeCardFilter(candidate!, decision('hide'), 'reason');
    expect(candidate!.element.getAttribute(FILTER_ACTION_ATTRIBUTE)).toBe(
      'hide',
    );
    expect(
      candidate!.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(0);
  });

  it('uses the title link before lower-priority conflicting watch links', () => {
    const candidate = createAdapter()
      .collectCandidates(document)
      .find(({ element }) => element.getAttribute('data-testid') === 'priority-video');

    expect(candidate?.snapshot.identity.videoId).toBe('Priority001');
  });

  it('keeps watch metadata identity based on the current watch URL', () => {
    const candidate = createAdapter(
      new URL('https://www.youtube.com/watch?v=CurrentVid1&list=PL_SANITIZED'),
    )
      .collectCandidates(document)
      .find(({ element }) => element.getAttribute('data-testid') === 'watch-metadata');

    expect(candidate?.snapshot.identity.videoId).toBe('CurrentVid1');
  });

  it('keeps separate cards that repeat the same video ID', () => {
    const repeatedCandidates = createAdapter()
      .collectCandidates(document)
      .filter(({ snapshot }) => snapshot.identity.videoId === 'RepeatVid01');

    expect(repeatedCandidates).toHaveLength(2);
    expect(repeatedCandidates[0]?.element).not.toBe(repeatedCandidates[1]?.element);
  });

  it('does not identify non-video, Shorts, ambiguous or advertisement units', () => {
    const candidateTestIds = new Set(
      createAdapter()
        .collectCandidates(document)
        .map(({ element }) => element.getAttribute('data-testid')),
    );

    expect(candidateTestIds).not.toContain('non-video-links');
    expect(candidateTestIds).not.toContain('shorts-card');
    expect(candidateTestIds).not.toContain('playlist-collection-card');
    expect(candidateTestIds).not.toContain('ambiguous-video');
    expect(candidateTestIds).not.toContain('missing-link');
    expect(candidateTestIds).not.toContain('advertisement');
    expect(candidateTestIds).not.toContain('nested-ad-video');
  });

  it('handles missing and malformed card structure without throwing', () => {
    document.querySelector('[data-testid="home-video"] a#video-title')?.remove();
    document
      .querySelector(
        '[data-testid="home-video"] a.ytLockupViewModelContentImage',
      )
      ?.setAttribute('href', 'https://example.com/not-a-video');

    const adapter = createAdapter();
    expect(() => adapter.collectCandidates(document)).not.toThrow();
    expect(
      adapter
        .collectCandidates(document)
        .some(({ element }) => element.getAttribute('data-testid') === 'home-video'),
    ).toBe(false);
  });
});
