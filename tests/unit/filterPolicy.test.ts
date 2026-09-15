import { describe, expect, it } from 'vitest';

import type { OfficialDisclosureEvidence } from '@/detection/contracts';
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

describe('YouTube card filter policy', () => {
  it('does nothing when filtering is disabled', () => {
    expect(
      decideYouTubeCardFilter({
        settings: { enabled: false, mode: 'hide' },
        identity,
        allowlist: DEFAULT_ALLOWLIST,
        disclosureStatus: 'confirmed',
        evidence: confirmedEvidence,
      }),
    ).toEqual({ action: 'none' });
  });

  it.each(['hide', 'blur', 'mark'] as const)(
    'returns %s only for a confirmed official disclosure',
    (mode) => {
      expect(
        decideYouTubeCardFilter({
          settings: { enabled: true, mode },
          identity,
          allowlist: DEFAULT_ALLOWLIST,
          disclosureStatus: 'confirmed',
          evidence: confirmedEvidence,
        }),
      ).toEqual({
        action: mode,
        reason: 'youtube-official-ai-disclosure',
      });
    },
  );

  it.each(['not-detected', 'unknown-or-error'] as const)(
    'does nothing for %s results',
    (disclosureStatus) => {
      expect(
        decideYouTubeCardFilter({
          settings: { enabled: true, mode: 'hide' },
          identity,
          allowlist: DEFAULT_ALLOWLIST,
          disclosureStatus,
          evidence: confirmedEvidence,
        }),
      ).toEqual({ action: 'none' });
    },
  );

  it('rejects a malformed confirmed result without official evidence', () => {
    expect(
      decideYouTubeCardFilter({
        settings: { enabled: true, mode: 'hide' },
        identity,
        allowlist: DEFAULT_ALLOWLIST,
        disclosureStatus: 'confirmed',
        evidence: [],
      }),
    ).toEqual({ action: 'none' });
  });

  it('fails closed for an invalid media identity', () => {
    expect(
      decideYouTubeCardFilter({
        settings: { enabled: true, mode: 'hide' },
        identity: { ...identity, videoId: 'invalid' },
        allowlist: DEFAULT_ALLOWLIST,
        disclosureStatus: 'confirmed',
        evidence: confirmedEvidence,
      }),
    ).toEqual({ action: 'none' });
  });

  it.each([
    {
      name: 'track',
      allowlist: {
        ...DEFAULT_ALLOWLIST,
        tracks: [{ videoId: 'AllowedVid1' }],
      },
    },
    {
      name: 'artist',
      allowlist: {
        ...DEFAULT_ALLOWLIST,
        artists: [{ artistId: 'UCaaaaaaaaaaaaaaaaaaaaaa' }],
      },
    },
  ])('gives the $name allowlist priority over confirmed evidence', ({ allowlist }) => {
    expect(
      decideYouTubeCardFilter({
        settings: { enabled: true, mode: 'hide' },
        identity: {
          ...identity,
          artistIds: ['UCaaaaaaaaaaaaaaaaaaaaaa'],
        },
        allowlist,
        disclosureStatus: 'confirmed',
        evidence: confirmedEvidence,
      }),
    ).toEqual({ action: 'none' });
  });

  it('keeps a not-detected allowlisted item as a no-op', () => {
    expect(
      decideYouTubeCardFilter({
        settings: { enabled: true, mode: 'mark' },
        identity,
        allowlist: {
          ...DEFAULT_ALLOWLIST,
          tracks: [{ videoId: 'AllowedVid1' }],
        },
        disclosureStatus: 'not-detected',
        evidence: [],
      }),
    ).toEqual({ action: 'none' });
  });

  it('applies direct track blocks without disclosure and lets allowlist win', () => {
    const blocked = { ...DEFAULT_BLOCKLIST, tracks: [{ videoId: 'AllowedVid1' }] };
    expect(decideYouTubeCardFilter({ settings: { enabled: true, mode: 'blur' }, identity, allowlist: DEFAULT_ALLOWLIST, blocklist: blocked, directBlockKinds: { artist: false, channel: true }, disclosureStatus: 'not-detected', evidence: [] })).toEqual({ action: 'blur', reason: 'direct-block-track' });
    expect(decideYouTubeCardFilter({ settings: { enabled: true, mode: 'blur' }, identity, allowlist: { ...DEFAULT_ALLOWLIST, tracks: [{ videoId: 'AllowedVid1' }] }, blocklist: blocked, directBlockKinds: { artist: false, channel: true }, disclosureStatus: 'confirmed', evidence: confirmedEvidence })).toEqual({ action: 'none' });
  });

  it('prefers direct artist and channel reasons over official disclosure', () => {
    const identified = { ...identity, artistIds: ['UCaaaaaaaaaaaaaaaaaaaaaa'], channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb' };
    expect(decideYouTubeCardFilter({ settings: { enabled: true, mode: 'mark' }, identity: identified, allowlist: DEFAULT_ALLOWLIST, blocklist: { ...DEFAULT_BLOCKLIST, artists: [{ artistId: identified.artistIds[0]! }], channels: [{ identityType: 'channel-id', channelId: identified.channelId }] }, directBlockKinds: { artist: true, channel: true }, disclosureStatus: 'confirmed', evidence: confirmedEvidence })).toEqual({ action: 'mark', reason: 'direct-block-artist' });
  });
});
