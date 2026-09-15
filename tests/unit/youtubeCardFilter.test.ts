// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DomMediaCandidate } from '@/adapters/contracts';
import type { FilterDecision } from '@/filtering/contracts';
import {
  applyYouTubeCardFilter,
  clearAllYouTubeCardFilters,
  FILTER_ACTION_ATTRIBUTE,
  FILTER_OVERLAY_ANCHOR_ATTRIBUTE,
  FILTER_REASON_ATTRIBUTE,
  FILTER_REASON_BADGE_ATTRIBUTE,
  isYouTubeCardFilterCurrent,
} from '@/ui/youtubeCardFilter';

const reasonText = 'NoAI · YouTube AI disclosure';

function createCandidate(): DomMediaCandidate {
  const element = document.createElement('ytd-video-renderer');
  element.innerHTML = `<ytd-thumbnail>
    <a id="thumbnail" href="/watch?v=Disclose001">Thumbnail</a>
  </ytd-thumbnail>
  <a id="video-title" href="/watch?v=Disclose001">Fixture video</a>`;
  document.body.append(element);
  return {
    element,
    surface: 'video-card',
    filterOverlayAnchor:
      element.querySelector<HTMLElement>('ytd-thumbnail') ?? undefined,
    snapshot: {
      identity: { site: 'youtube', videoId: 'Disclose001', artistIds: [] },
      artistNames: [],
    },
  };
}

function decision(action: 'hide' | 'blur' | 'mark'): FilterDecision {
  return { action, reason: 'youtube-official-ai-disclosure' };
}

describe('YouTube card DOM filtering', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it.each(['hide', 'blur', 'mark'] as const)('applies %s reversibly', (action) => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision(action), reasonText);

    expect(candidate.element.getAttribute(FILTER_ACTION_ATTRIBUTE)).toBe(action);
    expect(candidate.element.getAttribute(FILTER_REASON_ATTRIBUTE)).toBe(
      'youtube-official-ai-disclosure',
    );
    expect(isYouTubeCardFilterCurrent(candidate, decision(action))).toBe(
      true,
    );
    expect(
      candidate.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(action === 'hide' ? 0 : 1);
  });

  it('removes the previous mode before applying the next mode', () => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision('blur'), reasonText);
    applyYouTubeCardFilter(candidate, decision('mark'), reasonText);

    expect(candidate.element.getAttribute(FILTER_ACTION_ATTRIBUTE)).toBe('mark');
    expect(
      candidate.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(1);
  });

  it('restores the original card for a none decision', () => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision('hide'), reasonText);
    applyYouTubeCardFilter(candidate, { action: 'none' }, reasonText);

    expect(candidate.element.hasAttribute(FILTER_ACTION_ATTRIBUTE)).toBe(false);
    expect(candidate.element.hasAttribute(FILTER_REASON_ATTRIBUTE)).toBe(false);
    expect(candidate.element.querySelector('#video-title')?.textContent).toBe(
      'Fixture video',
    );
    expect(
      candidate.element.querySelectorAll(
        `[${FILTER_OVERLAY_ANCHOR_ATTRIBUTE}]`,
      ),
    ).toHaveLength(0);
  });

  it('does not duplicate reason badges during repeated processing', () => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision('mark'), reasonText);
    applyYouTubeCardFilter(candidate, decision('mark'), reasonText);

    expect(
      candidate.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(1);
  });

  it('renders keyboard-accessible allow actions without duplicating them', () => {
    const candidate = createCandidate();
    const allowTrack = vi.fn();
    applyYouTubeCardFilter(candidate, decision('mark'), reasonText, {
      track: { label: 'Allow this track', onActivate: allowTrack },
    });

    const button = candidate.element.querySelector('button');
    expect(button?.textContent).toBe('Allow this track');
    expect(button?.getAttribute('aria-label')).toBe('Allow this track');
    button?.click();
    expect(allowTrack).toHaveBeenCalledOnce();

    applyYouTubeCardFilter(candidate, decision('mark'), reasonText, {
      track: { label: 'Allow this track', onActivate: allowTrack },
    });
    expect(candidate.element.querySelectorAll('button')).toHaveLength(1);
  });

  it('mounts the badge outside card layout flow on the thumbnail overlay', () => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision('blur'), reasonText, {
      track: { label: 'Allow this track', onActivate: vi.fn() },
    });

    const badge = candidate.element.querySelector(
      `[${FILTER_REASON_BADGE_ATTRIBUTE}]`,
    );
    expect(badge?.parentElement?.tagName).toBe('YTD-THUMBNAIL');
    expect(badge?.parentElement).not.toBe(candidate.element);
    expect(
      badge?.parentElement?.hasAttribute(FILTER_OVERLAY_ANCHOR_ATTRIBUTE),
    ).toBe(true);
  });

  it('does not force layout positioning or annotate the card ancestor path', () => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision('blur'), reasonText);

    const styles = document.head.querySelector(
      '[data-noai-youtube-card-filter-styles]',
    )?.textContent;
    expect(styles).not.toContain('position: relative');
    expect(styles).not.toContain('filter-overlay-path');
    expect(candidate.element.querySelector('[data-noai-filter-overlay-path]')).toBeNull();
    expect(
      candidate.element.querySelector(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).not.toBe(candidate.element.firstElementChild);
  });

  it('fails closed for visible modes without a confirmed overlay anchor', () => {
    const candidate = createCandidate();
    candidate.filterOverlayAnchor = undefined;

    applyYouTubeCardFilter(candidate, decision('mark'), reasonText);

    expect(candidate.element.hasAttribute(FILTER_ACTION_ATTRIBUTE)).toBe(false);
    expect(
      candidate.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(0);
    expect(candidate.element.querySelector('#video-title')).not.toBeNull();
  });

  it('clears every applied state without changing card content', () => {
    const first = createCandidate();
    const second = createCandidate();
    applyYouTubeCardFilter(first, decision('hide'), reasonText);
    applyYouTubeCardFilter(second, decision('blur'), reasonText);

    clearAllYouTubeCardFilters(document);

    expect(document.querySelectorAll(`[${FILTER_ACTION_ATTRIBUTE}]`)).toHaveLength(
      0,
    );
    expect(document.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`)).toHaveLength(
      0,
    );
  });

  it('removes every stale badge if the DOM already contains duplicates', () => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision('mark'), reasonText);
    const duplicate = document.createElement('span');
    duplicate.setAttribute(FILTER_REASON_BADGE_ATTRIBUTE, 'true');
    candidate.element.append(duplicate);

    applyYouTubeCardFilter(candidate, { action: 'none' }, reasonText);

    expect(
      candidate.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(0);
  });
});
