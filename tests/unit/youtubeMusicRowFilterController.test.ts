// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createYouTubeMusicAdapter } from '@/adapters/youtube-music';
import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import type { FilterMode } from '@/filtering/contracts';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import {
  DEFAULT_ALLOWLIST,
  DEFAULT_SETTINGS,
  type PersistedAllowlist,
  type PersistedSettings,
} from '@/storage/contracts';
import {
  YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE,
  YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE,
} from '@/ui/youtubeMusicRowFilter';
import { createYouTubeMusicRowFilterController } from '@/youtube-music/rowFilterController';

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
  evidence: readonly OfficialDisclosureEvidence[] = confirmedEvidence,
): WatchDisclosureLookupResult {
  return {
    videoId,
    status,
    evidence,
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
  await Promise.resolve();
}

interface SetupOptions {
  url?: string;
  rowHtml?: string;
  settings?: PersistedSettings;
  allowlist?: PersistedAllowlist;
  lookup?: (videoId: string) => Promise<WatchDisclosureLookupResult>;
}

function setup(options: SetupOptions = {}) {
  let currentUrl = new URL(
    options.url ?? 'https://music.youtube.com/search?q=fixture',
  );
  let settings = options.settings ?? { ...DEFAULT_SETTINGS };
  let allowlist = options.allowlist ?? DEFAULT_ALLOWLIST;
  document.body.innerHTML =
    options.rowHtml ??
    `<ytmusic-responsive-list-item-renderer data-testid="row">
      <div class="title"><a href="/watch?v=SurfaceAI01">Fixture track</a></div>
    </ytmusic-responsive-list-item-renderer>`;
  const adapter = createYouTubeMusicAdapter({
    document,
    getCurrentUrl: () => currentUrl,
    createMutationObserver: (callback) => new MutationObserver(callback),
    requestAnimationFrame: (callback) => requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
  });
  const lookup = vi.fn(
    options.lookup ?? (async (videoId) => lookupResult(videoId)),
  );
  const controller = createYouTubeMusicRowFilterController({
    adapter,
    document,
    getSettings: () => settings,
    getAllowlist: () => allowlist,
    lookup,
    reasonText: 'NoAI · YouTube AI disclosure',
  });
  const row = document.querySelector('[data-testid="row"]');
  if (!row) {
    throw new Error('Missing fixture row');
  }

  return {
    controller,
    lookup,
    row,
    setSettings(next: PersistedSettings) {
      settings = next;
    },
    setAllowlist(next: PersistedAllowlist) {
      allowlist = next;
    },
    setUrl(next: string) {
      currentUrl = new URL(next);
    },
  };
}

describe('YouTube Music row filter lifecycle', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it.each([
    ['search-result', 'https://music.youtube.com/search?q=fixture'],
    ['album-track', 'https://music.youtube.com/browse/MPREfixture'],
    ['playlist-track', 'https://music.youtube.com/playlist?list=PLfixture'],
    [
      'artist-song',
      'https://music.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa',
    ],
  ])('applies every mode on the supported %s surface', async (_surface, url) => {
    for (const mode of ['hide', 'blur', 'mark'] as const) {
      const state = setup({
        url,
        settings: { ...DEFAULT_SETTINGS, mode },
      });
      state.controller.processRoots([document]);
      await flushPromises();

      expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
        mode,
      );
      expect(
        state.row.querySelectorAll(
          `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
        ),
      ).toHaveLength(mode === 'hide' ? 0 : 1);
      state.controller.dispose();
    }
  });

  it('does not look up or filter while globally disabled', () => {
    const state = setup({
      settings: { ...DEFAULT_SETTINGS, enabled: false },
    });
    state.controller.processRoots([document]);

    expect(state.lookup).not.toHaveBeenCalled();
    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
  });

  it.each([
    ['not-detected', 'not-detected', confirmedEvidence],
    ['unknown/error', 'unknown-or-error', confirmedEvidence],
    ['confirmed without evidence', 'confirmed', []],
  ] as const)('does not filter a %s result', async (_name, status, evidence) => {
    const state = setup({
      lookup: async (videoId) => lookupResult(videoId, status, evidence),
    });
    state.controller.processRoots([document]);
    await flushPromises();

    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
  });

  it('rejects a result whose video ID differs from the expected identity', async () => {
    const state = setup({
      lookup: async () => lookupResult('Different01'),
    });
    state.controller.processRoots([document]);
    await flushPromises();

    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
  });

  it.each([
    [
      'missing identity',
      `<ytmusic-responsive-list-item-renderer data-testid="row">
        <div class="title"><a href="/browse/MPREfixture">Album</a></div>
      </ytmusic-responsive-list-item-renderer>`,
    ],
    [
      'ambiguous identity',
      `<ytmusic-responsive-list-item-renderer data-testid="row">
        <div class="title">
          <a href="/watch?v=Ambiguous01">First</a>
          <a href="/watch?v=Ambiguous02">Second</a>
        </div>
      </ytmusic-responsive-list-item-renderer>`,
    ],
  ])('does not look up a row with %s', (_name, rowHtml) => {
    const state = setup({ rowHtml });
    state.controller.processRoots([document]);

    expect(state.lookup).not.toHaveBeenCalled();
    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
  });

  it('discards a stale result after the same element gets a new identity', async () => {
    const first = deferred<WatchDisclosureLookupResult>();
    const state = setup({
      lookup: (videoId) =>
        videoId === 'SurfaceAI01'
          ? first.promise
          : Promise.resolve(lookupResult(videoId, 'not-detected', [])),
    });
    state.controller.processRoots([document]);

    const link = state.row.querySelector('a');
    link?.setAttribute('href', '/watch?v=SurfaceOrd1');
    state.controller.processRoots([link ?? state.row]);
    first.resolve(lookupResult('SurfaceAI01'));
    await flushPromises();

    expect(state.lookup).toHaveBeenCalledTimes(2);
    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
  });

  it('clears a confirmed row immediately when the element is reused', async () => {
    const second = deferred<WatchDisclosureLookupResult>();
    const state = setup({
      lookup: (videoId) =>
        videoId === 'SurfaceAI01'
          ? Promise.resolve(lookupResult(videoId))
          : second.promise,
    });
    state.controller.processRoots([document]);
    await flushPromises();
    expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      'hide',
    );

    const link = state.row.querySelector('a');
    link?.setAttribute('href', '/watch?v=SurfaceOrd1');
    state.controller.processRoots([link ?? state.row]);

    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
    expect(state.lookup).toHaveBeenCalledTimes(2);
  });

  it('deduplicates repeated processing and never duplicates the badge', async () => {
    const request = deferred<WatchDisclosureLookupResult>();
    const state = setup({
      settings: { ...DEFAULT_SETTINGS, mode: 'mark' },
      lookup: () => request.promise,
    });

    state.controller.processRoots([document]);
    state.controller.processRoots([state.row]);
    state.controller.processRoots([state.row, document]);
    expect(state.lookup).toHaveBeenCalledTimes(1);

    request.resolve(lookupResult('SurfaceAI01'));
    await flushPromises();
    state.controller.processRoots([state.row]);
    state.controller.processRoots([state.row]);

    expect(state.lookup).toHaveBeenCalledTimes(1);
    expect(
      state.row.querySelectorAll(
        `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
      ),
    ).toHaveLength(1);
  });

  it('restores an allowlisted track immediately and reapplies after removal', async () => {
    const state = setup({
      settings: { ...DEFAULT_SETTINGS, mode: 'mark' },
    });
    state.controller.processRoots([document]);
    await flushPromises();
    expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      'mark',
    );

    state.setAllowlist({
      ...DEFAULT_ALLOWLIST,
      tracks: [{ videoId: 'SurfaceAI01' }],
    });
    state.controller.processRoots([document]);
    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
    expect(
      state.row.querySelectorAll(
        `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
      ),
    ).toHaveLength(0);

    state.setAllowlist(DEFAULT_ALLOWLIST);
    state.controller.processRoots([document]);
    await flushPromises();
    expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      'mark',
    );
  });

  it('does not look up or filter a row with an allowlisted stable artist ID', () => {
    const artistId = 'UCabcdefghijklmnopqrstuv';
    const state = setup({
      rowHtml: `<ytmusic-responsive-list-item-renderer data-testid="row">
        <div class="title"><a href="/watch?v=SurfaceAI01">Fixture track</a></div>
        <a href="/browse/${artistId}">Fixture artist</a>
      </ytmusic-responsive-list-item-renderer>`,
      allowlist: {
        ...DEFAULT_ALLOWLIST,
        artists: [{ artistId }],
      },
    });

    state.controller.processRoots([document]);

    expect(state.lookup).not.toHaveBeenCalled();
    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
  });

  it('does not retain an old allowlist decision when the row identity changes', async () => {
    const state = setup({
      allowlist: {
        ...DEFAULT_ALLOWLIST,
        tracks: [{ videoId: 'SurfaceAI01' }],
      },
    });
    state.controller.processRoots([document]);
    expect(state.lookup).not.toHaveBeenCalled();

    const link = state.row.querySelector('a');
    link?.setAttribute('href', '/watch?v=SurfaceAI02');
    state.controller.processRoots([link ?? state.row]);
    await flushPromises();

    expect(state.lookup).toHaveBeenCalledOnce();
    expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      'hide',
    );
  });

  it('does not attach another handler when enabled changes during a pending lookup', async () => {
    const request = deferred<WatchDisclosureLookupResult>();
    const then = vi.spyOn(request.promise, 'then');
    const state = setup({ lookup: () => request.promise });
    state.controller.processRoots([document]);
    const initialThenCalls = then.mock.calls.length;

    state.setSettings({ ...DEFAULT_SETTINGS, enabled: false });
    state.controller.processRoots([document]);
    state.setSettings({ ...DEFAULT_SETTINGS, enabled: true, mode: 'mark' });
    state.controller.processRoots([document]);
    expect(state.lookup).toHaveBeenCalledTimes(1);
    expect(then).toHaveBeenCalledTimes(initialThenCalls);

    request.resolve(lookupResult('SurfaceAI01'));
    await flushPromises();
    expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      'mark',
    );
    expect(
      state.row.querySelectorAll(
        `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
      ),
    ).toHaveLength(1);
  });

  it('restores clean state across every mode and enabled transition', async () => {
    const state = setup();
    state.controller.processRoots([document]);
    await flushPromises();

    for (const mode of ['blur', 'mark', 'hide'] as FilterMode[]) {
      state.setSettings({ ...DEFAULT_SETTINGS, mode });
      state.controller.processRoots([document]);
      expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
        mode,
      );
      expect(
        state.row.querySelectorAll(
          `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
        ),
      ).toHaveLength(mode === 'hide' ? 0 : 1);
    }

    state.setSettings({ ...DEFAULT_SETTINGS, enabled: false, mode: 'hide' });
    state.controller.processRoots([document]);
    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
    expect(
      state.row.querySelectorAll(
        `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
      ),
    ).toHaveLength(0);

    state.setSettings({
      ...DEFAULT_SETTINGS,
      enabled: true,
      mode: 'mark',
      youtubeMusicAutoSkip: false,
    });
    state.controller.processRoots([document]);
    expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      'mark',
    );
    expect(state.lookup).toHaveBeenCalledTimes(1);
  });

  it('clears route state before processing a supported SPA destination', async () => {
    const state = setup();
    state.controller.processRoots([document]);
    await flushPromises();
    expect(state.row.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      'hide',
    );

    state.setUrl('https://music.youtube.com/browse/FEmusic_home');
    state.controller.processRoots([document]);
    expect(state.row.hasAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE)).toBe(
      false,
    );
  });
});
