// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';

import type { DomMediaCandidate } from '@/adapters/contracts';
import type { FilterDecision } from '@/filtering/contracts';
import {
  applyYouTubeCardFilter,
  clearAllYouTubeCardFilters,
  FILTER_ACTION_ATTRIBUTE,
  FILTER_REASON_ATTRIBUTE,
  FILTER_REASON_BADGE_ATTRIBUTE,
  isYouTubeCardFilterCurrent,
} from '@/ui/youtubeCardFilter';

const reasonText = 'NoAI · YouTube AI disclosure';

function createCandidate(): DomMediaCandidate {
  const element = document.createElement('ytd-video-renderer');
  element.innerHTML = '<a href="/watch?v=Disclose001">Fixture video</a>';
  document.body.append(element);
  return {
    element,
    surface: 'video-card',
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
    expect(isYouTubeCardFilterCurrent(candidate.element, decision(action))).toBe(
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
    expect(candidate.element.textContent).toBe('Fixture video');
  });

  it('does not duplicate reason badges during repeated processing', () => {
    const candidate = createCandidate();
    applyYouTubeCardFilter(candidate, decision('mark'), reasonText);
    applyYouTubeCardFilter(candidate, decision('mark'), reasonText);

    expect(
      candidate.element.querySelectorAll(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(1);
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
});
