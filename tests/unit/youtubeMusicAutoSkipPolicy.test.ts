import { describe, expect, it } from 'vitest';

import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import { decideYouTubeMusicAutoSkip } from '@/filtering/decideYouTubeMusicAutoSkip';
import type {
  ContentKind,
  WatchDisclosureLookupResult,
} from '@/shared/youtubeWatchDisclosure';
import { DEFAULT_ALLOWLIST, DEFAULT_BLOCKLIST } from '@/storage/contracts';

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

function result(
  status: WatchDisclosureLookupResult['status'],
  evidence: readonly OfficialDisclosureEvidence[] = confirmedEvidence,
  contentKind: ContentKind = 'unknown',
): WatchDisclosureLookupResult {
  return {
    videoId: 'PlaybackA01',
    status,
    contentKind,
    evidence,
    checkedAt: 1,
    source: 'network',
  };
}

function decide(
  overrides: Partial<Parameters<typeof decideYouTubeMusicAutoSkip>[0]> = {},
) {
  return decideYouTubeMusicAutoSkip({
    settings: { enabled: true, youtubeMusicAutoSkip: true },
    expectedVideoId: 'PlaybackA01',
    currentVideoId: 'PlaybackA01',
    currentIdentity: {
      site: 'youtube-music',
      videoId: 'PlaybackA01',
      artistIds: [],
    },
    allowlist: DEFAULT_ALLOWLIST,
    filterScope: 'all',
    result: result('confirmed'),
    ...overrides,
  });
}

describe('YouTube Music auto-skip policy', () => {
  it('allows only a confirmed result with revalidated official evidence', () => {
    expect(decide()).toBe(true);
  });

  it('applies music scope only to confirmed disclosure decisions', () => {
    expect(
      decide({
        filterScope: 'music',
        result: result('confirmed', confirmedEvidence, 'music'),
      }),
    ).toBe(true);
    expect(
      decide({
        filterScope: 'music',
        result: result('confirmed', confirmedEvidence, 'unknown'),
      }),
    ).toBe(false);
    expect(
      decide({
        filterScope: 'music',
        result: result('confirmed', confirmedEvidence, 'non-music'),
      }),
    ).toBe(false);
  });

  it.each([
    { enabled: false, youtubeMusicAutoSkip: true },
    { enabled: true, youtubeMusicAutoSkip: false },
  ])('does not skip with disabled settings: %o', (settings) => {
    expect(decide({ settings })).toBe(false);
  });

  it.each(['not-detected', 'unknown-or-error'] as const)(
    'does not skip a %s result',
    (status) => {
      expect(decide({ result: result(status) })).toBe(false);
    },
  );

  it('does not skip a confirmed result without supported official evidence', () => {
    expect(decide({ result: result('confirmed', []) })).toBe(false);
  });

  it('does not skip an allowed track or artist', () => {
    expect(
      decide({
        allowlist: {
          ...DEFAULT_ALLOWLIST,
          tracks: [{ videoId: 'PlaybackA01' }],
        },
      }),
    ).toBe(false);
    expect(
      decide({
        currentIdentity: {
          site: 'youtube-music',
          videoId: 'PlaybackA01',
          artistIds: ['UCaaaaaaaaaaaaaaaaaaaaaa'],
        },
        allowlist: {
          ...DEFAULT_ALLOWLIST,
          artists: [{ artistId: 'UCaaaaaaaaaaaaaaaaaaaaaa' }],
        },
      }),
    ).toBe(false);
  });

  it('does not skip a failed, stale, or mismatched result', () => {
    expect(
      decide({
        result: {
          ...result('confirmed'),
          failureReason: 'timeout',
        },
      }),
    ).toBe(false);
    expect(decide({ currentVideoId: 'PlaybackB01' })).toBe(false);
    expect(
      decide({ result: { ...result('confirmed'), videoId: 'PlaybackB01' } }),
    ).toBe(false);
    expect(
      decide({
        expectedVideoId: 'invalid',
        currentVideoId: 'invalid',
        result: { ...result('confirmed'), videoId: 'invalid' },
      }),
    ).toBe(false);
  });

  it('skips direct blocked tracks and artists even when lookup failed, unless allowed', () => {
    const failed = { ...result('unknown-or-error', []), failureReason: 'network-error' as const };
    expect(decide({ blocklist: { ...DEFAULT_BLOCKLIST, tracks: [{ videoId: 'PlaybackA01' }] }, result: failed })).toBe(true);
    const artistId = 'UCaaaaaaaaaaaaaaaaaaaaaa';
    expect(decide({ currentIdentity: { site: 'youtube-music', videoId: 'PlaybackA01', artistIds: [artistId] }, blocklist: { ...DEFAULT_BLOCKLIST, artists: [{ artistId }] }, result: failed })).toBe(true);
    expect(decide({ allowlist: { ...DEFAULT_ALLOWLIST, tracks: [{ videoId: 'PlaybackA01' }] }, blocklist: { ...DEFAULT_BLOCKLIST, tracks: [{ videoId: 'PlaybackA01' }] }, result: failed })).toBe(false);
  });

  it('keeps direct blocks ahead of music scope', () => {
    expect(
      decide({
        blocklist: {
          ...DEFAULT_BLOCKLIST,
          tracks: [{ videoId: 'PlaybackA01' }],
        },
        filterScope: 'music',
        result: result('confirmed', confirmedEvidence, 'unknown'),
      }),
    ).toBe(true);
  });
});
