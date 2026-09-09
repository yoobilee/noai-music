import { describe, expect, it } from 'vitest';

import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import { decideYouTubeCardFilter } from '@/filtering/decideYouTubeCardFilter';

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

describe('YouTube card filter policy', () => {
  it('does nothing when filtering is disabled', () => {
    expect(
      decideYouTubeCardFilter({
        settings: { enabled: false, mode: 'hide' },
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
        disclosureStatus: 'confirmed',
        evidence: [],
      }),
    ).toEqual({ action: 'none' });
  });
});
