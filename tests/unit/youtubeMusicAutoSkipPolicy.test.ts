import { describe, expect, it } from 'vitest';

import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import { decideYouTubeMusicAutoSkip } from '@/filtering/decideYouTubeMusicAutoSkip';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';

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
): WatchDisclosureLookupResult {
  return {
    videoId: 'PlaybackA01',
    status,
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
    result: result('confirmed'),
    ...overrides,
  });
}

describe('YouTube Music auto-skip policy', () => {
  it('allows only a confirmed result with revalidated official evidence', () => {
    expect(decide()).toBe(true);
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
});
