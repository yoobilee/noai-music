import { describe, expect, it } from 'vitest';

import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import type { FilterPolicyInput } from '@/filtering/contracts';
import { decideYouTubeCardFilter } from '@/filtering/decideYouTubeCardFilter';
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
const identity = {
  site: 'youtube' as const,
  videoId: 'AllowedVid1',
  artistIds: [],
};
const baseInput: FilterPolicyInput = {
  settings: { enabled: true, mode: 'hide' },
  identity,
  allowlist: DEFAULT_ALLOWLIST,
  blocklist: DEFAULT_BLOCKLIST,
  directBlockKinds: { artist: false, channel: false },
  filterScope: 'all',
  disclosureStatus: 'confirmed',
  contentKind: 'unknown',
  evidence: confirmedEvidence,
};

function decide(overrides: Partial<FilterPolicyInput> = {}) {
  return decideYouTubeCardFilter({ ...baseInput, ...overrides });
}

describe('YouTube card filter policy', () => {
  it('does nothing when filtering is disabled', () => {
    expect(decide({ settings: { enabled: false, mode: 'hide' } })).toEqual({
      action: 'none',
    });
  });

  it.each(['hide', 'blur', 'mark'] as const)(
    'returns %s only for a confirmed official disclosure',
    (mode) => {
      expect(decide({ settings: { enabled: true, mode } })).toEqual({
        action: mode,
        reason: 'youtube-official-ai-disclosure',
      });
    },
  );

  it.each(['not-detected', 'unknown-or-error'] as const)(
    'does nothing for %s results',
    (disclosureStatus) => {
      expect(decide({ disclosureStatus })).toEqual({ action: 'none' });
    },
  );

  it('rejects a malformed confirmed result without official evidence', () => {
    expect(decide({ evidence: [] })).toEqual({ action: 'none' });
  });

  it('fails closed for an invalid media identity', () => {
    expect(decide({ identity: { ...identity, videoId: 'invalid' } })).toEqual({
      action: 'none',
    });
  });

  it.each(['music', 'unknown', 'non-music'] as const)(
    'filters %s content with a confirmed disclosure in all scope',
    (contentKind) => {
      expect(decide({ filterScope: 'all', contentKind })).toEqual({
        action: 'hide',
        reason: 'youtube-official-ai-disclosure',
      });
    },
  );

  it('filters confirmed Music content in music scope', () => {
    expect(decide({ filterScope: 'music', contentKind: 'music' })).toEqual({
      action: 'hide',
      reason: 'youtube-official-ai-disclosure',
    });
  });

  it.each(['unknown', 'non-music'] as const)(
    'does not filter %s content via disclosure in music scope',
    (contentKind) => {
      expect(decide({ filterScope: 'music', contentKind })).toEqual({
        action: 'none',
      });
    },
  );

  it('applies a direct block in music scope even when content kind is unknown', () => {
    expect(
      decide({
        blocklist: {
          ...DEFAULT_BLOCKLIST,
          tracks: [{ videoId: 'AllowedVid1' }],
        },
        filterScope: 'music',
        contentKind: 'unknown',
        disclosureStatus: 'not-detected',
        evidence: [],
      }),
    ).toEqual({ action: 'hide', reason: 'direct-block-track' });
  });

  it('gives the allowlist priority over direct block, scope and disclosure', () => {
    expect(
      decide({
        allowlist: {
          ...DEFAULT_ALLOWLIST,
          tracks: [{ videoId: 'AllowedVid1' }],
        },
        blocklist: {
          ...DEFAULT_BLOCKLIST,
          tracks: [{ videoId: 'AllowedVid1' }],
        },
        filterScope: 'music',
        contentKind: 'music',
      }),
    ).toEqual({ action: 'none' });
  });

  it('prefers direct artist and channel reasons over official disclosure', () => {
    const identified = {
      ...identity,
      artistIds: ['UCaaaaaaaaaaaaaaaaaaaaaa'],
      channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb',
    };
    expect(
      decide({
        settings: { enabled: true, mode: 'mark' },
        identity: identified,
        blocklist: {
          ...DEFAULT_BLOCKLIST,
          artists: [{ artistId: identified.artistIds[0]! }],
          channels: [
            { identityType: 'channel-id', channelId: identified.channelId },
          ],
        },
        directBlockKinds: { artist: true, channel: true },
        filterScope: 'music',
        contentKind: 'unknown',
      }),
    ).toEqual({ action: 'mark', reason: 'direct-block-artist' });
  });

  it('prefers an exact handle channel rule over confirmed official disclosure', () => {
    expect(
      decide({
        settings: { enabled: true, mode: 'blur' },
        identity: { ...identity, channelHandle: '@example' },
        blocklist: {
          ...DEFAULT_BLOCKLIST,
          channels: [{ identityType: 'handle', handle: '@example' }],
        },
        directBlockKinds: { artist: false, channel: true },
      }),
    ).toEqual({ action: 'blur', reason: 'direct-block-channel' });
  });
});
