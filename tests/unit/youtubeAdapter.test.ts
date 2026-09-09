// @vitest-environment happy-dom

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createYouTubeAdapter } from '@/adapters/youtube';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';

const fixturePath = resolve(
  'tests/fixtures/youtube/watch-made-with-ai.en.html',
);
const fixtureHtml = await readFile(fixturePath, 'utf8');
const fixtureUrl = new URL('https://www.youtube.com/watch?v=z8Dz-IFFFY4');

function createAdapter() {
  return createYouTubeAdapter({
    document,
    getCurrentUrl: () => fixtureUrl,
    createMutationObserver: (callback) => new MutationObserver(callback),
    requestAnimationFrame: (callback) => requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
  });
}

describe('YouTube adapter disclosure extraction', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = fixtureHtml;
  });

  it('extracts only structured official evidence from the observed fixture', () => {
    const adapter = createAdapter();
    const candidates = adapter.collectCandidates(document);
    const disclosed = candidates.find(
      ({ element }) => element.getAttribute('data-testid') === 'disclosed-video',
    );

    expect(disclosed).toBeDefined();
    const evidence = adapter.readOfficialDisclosures(disclosed!);

    expect(evidence).toEqual([
      {
        source: 'youtube',
        kind: 'made-with-ai',
        matchedText: 'AI: Content was made with AI',
        confidence: 'confirmed',
        location: 'metadata-badge',
        evidenceType: 'accessibility-label',
      },
      {
        source: 'youtube',
        kind: 'made-with-ai',
        matchedText: 'Made with AI',
        confidence: 'confirmed',
        location: 'expanded-description',
        evidenceType: 'official-support-link',
      },
    ]);
    expect(detectYouTubeOfficialDisclosure(evidence).detected).toBe(true);
  });

  it('ignores ordinary cards and similar user-controlled text', () => {
    const adapter = createAdapter();
    const candidates = adapter.collectCandidates(document);

    for (const testId of ['ordinary-video', 'similar-user-text-video']) {
      const candidate = candidates.find(
        ({ element }) => element.getAttribute('data-testid') === testId,
      );
      expect(candidate).toBeDefined();
      expect(adapter.readOfficialDisclosures(candidate!)).toEqual([]);
    }
  });

  it('handles a partially missing disclosure structure without throwing', () => {
    const adapter = createAdapter();
    const candidate = adapter
      .collectCandidates(document)
      .find(
        ({ element }) =>
          element.getAttribute('data-testid') === 'disclosed-video',
      );

    expect(candidate).toBeDefined();
    candidate!.element
      .querySelectorAll(
        'ytd-badge-supported-renderer, how-this-was-made-section-view-model a',
      )
      .forEach((element) => element.remove());

    expect(() => adapter.readOfficialDisclosures(candidate!)).not.toThrow();
    expect(adapter.readOfficialDisclosures(candidate!)).toEqual([]);
  });

  it('deduplicates repeated evidence from the same location', () => {
    const adapter = createAdapter();
    const candidate = adapter
      .collectCandidates(document)
      .find(
        ({ element }) =>
          element.getAttribute('data-testid') === 'disclosed-video',
      );

    expect(candidate).toBeDefined();
    expect(
      adapter
        .readOfficialDisclosures(candidate!)
        .filter(({ location }) => location === 'metadata-badge'),
    ).toHaveLength(1);
  });

  it('keeps an unrecognized official component indeterminate', () => {
    const adapter = createAdapter();
    const candidate = adapter
      .collectCandidates(document)
      .find(
        ({ element }) =>
          element.getAttribute('data-testid') === 'disclosed-video',
      );

    expect(candidate).toBeDefined();
    candidate!.element
      .querySelectorAll('ytd-badge-supported-renderer')
      .forEach((element) => element.remove());
    const section = candidate!.element.querySelector(
      'how-this-was-made-section-view-model',
    );
    expect(section).not.toBeNull();
    section!.querySelector('h3')!.textContent = 'An unrecognized disclosure';

    const evidence = adapter.readOfficialDisclosures(candidate!);
    expect(evidence).toMatchObject([
      {
        source: 'youtube',
        kind: 'unknown',
        confidence: 'indeterminate',
        location: 'expanded-description',
      },
    ]);
    expect(detectYouTubeOfficialDisclosure(evidence).detected).toBe(false);
  });
});
