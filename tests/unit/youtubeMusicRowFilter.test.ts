// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FilterDecision } from '@/filtering/contracts';
import {
  applyYouTubeMusicRowFilter,
  clearAllYouTubeMusicRowFilters,
  YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE,
  YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE,
  YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE,
  YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE,
} from '@/ui/youtubeMusicRowFilter';

const reasonText = 'NoAI · YouTube AI disclosure';

function createRow(): Element {
  const element = document.createElement(
    'ytmusic-responsive-list-item-renderer',
  );
  element.innerHTML = '<div class="title"><a href="/watch?v=SurfaceAI01">Track</a></div>';
  document.body.append(element);
  return element;
}

function decision(action: 'hide' | 'blur' | 'mark'): FilterDecision {
  return { action, reason: 'youtube-official-ai-disclosure' };
}

describe('YouTube Music row DOM filtering', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it.each(['hide', 'blur', 'mark'] as const)('applies %s reversibly', (action) => {
    const row = createRow();
    applyYouTubeMusicRowFilter(row, decision(action), reasonText);

    expect(row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(action);
    expect(row.getAttribute(YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE)).toBe(
      'youtube-official-ai-disclosure',
    );
    const badges = row.querySelectorAll(
      `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
    );
    expect(badges).toHaveLength(action === 'hide' ? 0 : 1);
    if (action !== 'hide') {
      expect(badges[0]?.textContent).toBe(reasonText);
      expect(badges[0]?.getAttribute('role')).toBe('note');
    }

    applyYouTubeMusicRowFilter(row, { action: 'none' }, reasonText);
    expect(row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(false);
    expect(row.hasAttribute(YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE)).toBe(false);
    expect(row.textContent).toBe('Track');
  });

  it('replaces modes without duplicate badges', () => {
    const row = createRow();
    applyYouTubeMusicRowFilter(row, decision('blur'), reasonText);
    applyYouTubeMusicRowFilter(row, decision('mark'), reasonText);
    applyYouTubeMusicRowFilter(row, decision('mark'), reasonText);

    expect(row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe('mark');
    expect(
      row.querySelectorAll(`[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(1);
  });

  it('clears all applied rows without removing their content', () => {
    const first = createRow();
    const second = createRow();
    applyYouTubeMusicRowFilter(first, decision('hide'), reasonText);
    applyYouTubeMusicRowFilter(second, decision('blur'), reasonText);

    clearAllYouTubeMusicRowFilters(document);

    expect(
      document.querySelectorAll(`[${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}]`),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll(
        `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
      ),
    ).toHaveLength(0);
    expect(document.querySelectorAll('a')).toHaveLength(2);
  });

  it('removes every stale badge if the DOM already contains duplicates', () => {
    const row = createRow();
    applyYouTubeMusicRowFilter(row, decision('mark'), reasonText);
    const duplicate = document.createElement('span');
    duplicate.setAttribute(YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE, 'true');
    row.append(duplicate);

    applyYouTubeMusicRowFilter(row, { action: 'none' }, reasonText);

    expect(
      row.querySelectorAll(`[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(0);
  });

  it('renders separate accessible track and artist allow actions', () => {
    const row = createRow();
    const allowTrack = vi.fn();
    const allowArtist = vi.fn();
    applyYouTubeMusicRowFilter(row, decision('blur'), reasonText, {
      track: { label: 'Allow this track', onActivate: allowTrack },
      artist: { label: 'Allow this artist', onActivate: allowArtist },
    });

    const buttons = row.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Allow this track');
    expect(buttons[1]?.getAttribute('aria-label')).toBe('Allow this artist');
    buttons[0]?.click();
    buttons[1]?.click();
    expect(allowTrack).toHaveBeenCalledOnce();
    expect(allowArtist).toHaveBeenCalledOnce();
  });

  it('collapses a hidden queue item without removing its DOM node', () => {
    const queueItem = document.createElement('ytmusic-player-queue-item');
    queueItem.textContent = 'Queue track';
    document.body.append(queueItem);

    applyYouTubeMusicRowFilter(
      queueItem,
      decision('hide'),
      reasonText,
      undefined,
      'queue-item',
    );

    expect(queueItem.getAttribute(YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE)).toBe(
      'queue-item',
    );
    const styles = document.head.textContent ?? '';
    expect(styles).toContain('display: none !important');
    expect(styles).not.toContain('visibility: hidden !important');
    expect(queueItem.isConnected).toBe(true);
    expect(queueItem.textContent).toBe('Queue track');
  });
});
