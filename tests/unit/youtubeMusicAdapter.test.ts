// @vitest-environment happy-dom

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createYouTubeMusicAdapter } from '@/adapters/youtube-music';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';

const fixtureHtml = await readFile(
  resolve('tests/fixtures/youtube-music/playable-items.html'),
  'utf8',
);

function createAdapter(currentUrl: URL) {
  return createYouTubeMusicAdapter({
    document,
    getCurrentUrl: () => currentUrl,
    createMutationObserver: (callback) => new MutationObserver(callback),
    requestAnimationFrame: (callback) => requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
  });
}

function fixtureElement(testId: string): Element {
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`Missing fixture element: ${testId}`);
  }
  return element;
}

describe('YouTube Music playable item identity extraction', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = fixtureHtml;
  });

  it.each([
    [
      'search song row',
      'search-song-row',
      'https://music.youtube.com/search?q=synthetic',
      'search-result',
      'SearchSong1',
      ['UCabcdefghijklmnopqrstuv'],
    ],
    [
      'search video row',
      'search-video-row',
      'https://music.youtube.com/search?q=synthetic',
      'search-result',
      'SearchVid01',
      [],
    ],
    [
      'album track row',
      'album-track-row',
      'https://music.youtube.com/browse/MPREb_SANITIZED',
      'album-track',
      'AlbumTrack1',
      ['UCzyxwvutsrqponmlkjihgfe'],
    ],
    [
      'playlist track row',
      'playlist-track-row',
      'https://music.youtube.com/playlist?list=PL_SANITIZED',
      'playlist-track',
      'Playlist01A',
      ['UCabcdefghijklmnopqrstuv'],
    ],
    [
      'artist song row',
      'artist-song-row',
      'https://music.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa',
      'artist-song',
      'ArtistSong1',
      ['UCzyxwvutsrqponmlkjihgfe'],
    ],
  ])(
    'extracts a lookup-compatible identity from a %s',
    (_name, testId, currentUrl, surface, videoId, artistIds) => {
      const [candidate] = createAdapter(new URL(currentUrl)).collectCandidates(
        fixtureElement(testId),
      );

      expect(candidate).toMatchObject({
        surface,
        snapshot: {
          identity: {
            site: 'youtube-music',
            videoId,
            artistIds,
          },
          artistNames: [],
        },
      });
      expect(isYouTubeVideoId(videoId)).toBe(true);
    },
  );

  it('uses the title link before lower-priority conflicting watch links', () => {
    const [candidate] = createAdapter(
      new URL('https://music.youtube.com/search?q=synthetic'),
    ).collectCandidates(fixtureElement('priority-row'));

    expect(candidate?.snapshot.identity.videoId).toBe('PriorityY01');
  });

  it('fails closed for conflicting same-priority IDs', () => {
    const candidates = createAdapter(
      new URL('https://music.youtube.com/search?q=synthetic'),
    ).collectCandidates(fixtureElement('ambiguous-row'));

    expect(candidates).toEqual([]);
  });

  it('allows duplicate links with the same ID', () => {
    const [candidate] = createAdapter(
      new URL('https://music.youtube.com/search?q=synthetic'),
    ).collectCandidates(fixtureElement('duplicate-link-row'));

    expect(candidate?.snapshot.identity.videoId).toBe('Duplicate01');
  });

  it('falls back to another watch link when title markup is incomplete', () => {
    const [candidate] = createAdapter(
      new URL('https://music.youtube.com/search?q=synthetic'),
    ).collectCandidates(fixtureElement('fallback-link-row'));

    expect(candidate?.snapshot.identity.videoId).toBe('Fallback001');
  });

  it('does not identify rows without a supported watch URL', () => {
    const candidates = createAdapter(
      new URL('https://music.youtube.com/search?q=synthetic'),
    ).collectCandidates(fixtureElement('missing-id-row'));

    expect(candidates).toEqual([]);
  });

  it.each([
    'https://music.youtube.com/',
    'https://music.youtube.com/browse/FEmusic_home',
    'https://music.youtube.com/watch?v=RouteVideo1',
    'https://www.youtube.com/results?search_query=synthetic',
  ])('does not infer list identities on an unsupported route: %s', (url) => {
    expect(createAdapter(new URL(url)).collectCandidates(document)).toEqual([]);
  });

  it('extracts the current player identity from its title watch link', () => {
    const candidate = createAdapter(
      new URL('https://music.youtube.com/'),
    ).getNowPlayingCandidate();

    expect(candidate).toMatchObject({
      surface: 'player-current',
      snapshot: {
        identity: {
          site: 'youtube-music',
          videoId: 'NowPlaying1',
          channelId: 'UCabcdefghijklmnopqrstuv',
          artistIds: ['UCabcdefghijklmnopqrstuv'],
        },
      },
    });
  });

  it('does not retain a stale player ID when the player bar is reused', () => {
    const adapter = createAdapter(new URL('https://music.youtube.com/'));
    const titleLink = fixtureElement('player-bar').querySelector('.title a');

    expect(adapter.getNowPlayingCandidate()?.snapshot.identity.videoId).toBe(
      'NowPlaying1',
    );

    titleLink?.removeAttribute('href');
    expect(adapter.getNowPlayingCandidate()).toBeUndefined();

    titleLink?.setAttribute('href', '/watch?v=NextPlaying');
    expect(adapter.getNowPlayingCandidate()?.snapshot.identity.videoId).toBe(
      'NextPlaying',
    );
  });

  it('handles missing player and malformed DOM without throwing', () => {
    fixtureElement('player-bar').remove();
    fixtureElement('search-song-row').querySelector('.title')?.remove();
    const adapter = createAdapter(
      new URL('https://music.youtube.com/search?q=synthetic'),
    );

    expect(adapter.getNowPlayingCandidate()).toBeUndefined();
    expect(() => adapter.collectCandidates(document)).not.toThrow();
  });

  it('clicks an enabled, connected next control only for the expected track', () => {
    const adapter = createAdapter(new URL('https://music.youtube.com/'));
    const nextButton = fixtureElement('next-button') as HTMLButtonElement;
    const click = vi.spyOn(nextButton, 'click');

    expect(adapter.clickNext('Different01')).toBe(false);
    expect(adapter.clickNext('NowPlaying1')).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['disabled attribute', () => fixtureElement('next-button').setAttribute('disabled', '')],
    ['aria-disabled state', () => fixtureElement('next-button').setAttribute('aria-disabled', 'true')],
    ['missing control', () => fixtureElement('next-button').remove()],
  ])('does not click a next control with %s', (_name, arrange) => {
    arrange();
    expect(
      createAdapter(new URL('https://music.youtube.com/')).clickNext(
        'NowPlaying1',
      ),
    ).toBe(false);
  });

  it('rejects a disconnected next control and contains click failures', () => {
    const playerBar = fixtureElement('player-bar');
    const nextButton = fixtureElement('next-button') as HTMLButtonElement;
    nextButton.remove();
    vi.spyOn(playerBar, 'querySelector').mockReturnValue(nextButton);
    const adapter = createAdapter(new URL('https://music.youtube.com/'));

    expect(adapter.clickNext('NowPlaying1')).toBe(false);

    document.documentElement.innerHTML = fixtureHtml;
    const connectedButton = fixtureElement('next-button') as HTMLButtonElement;
    vi.spyOn(connectedButton, 'click').mockImplementation(() => {
      throw new Error('synthetic click failure');
    });
    expect(adapter.clickNext('NowPlaying1')).toBe(false);
  });
});
