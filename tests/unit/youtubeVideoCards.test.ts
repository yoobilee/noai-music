// @vitest-environment happy-dom

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createYouTubeAdapter } from '@/adapters/youtube';

const fixtureHtml = await readFile(
  resolve('tests/fixtures/youtube/video-cards.html'),
  'utf8',
);

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
      .querySelector('[data-testid="home-video"] a#thumbnail')
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
