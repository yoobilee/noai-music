import { describe, expect, it } from 'vitest';

import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import type { OfficialDisclosureEvidence } from '@/detection/contracts';

const confirmedEvidence: OfficialDisclosureEvidence = {
  source: 'youtube',
  kind: 'made-with-ai',
  matchedText: 'AI: Content was made with AI',
  confidence: 'confirmed',
  location: 'metadata-badge',
  evidenceType: 'accessibility-label',
};

describe('detectYouTubeOfficialDisclosure', () => {
  it('detects confirmed official YouTube disclosure evidence', () => {
    expect(detectYouTubeOfficialDisclosure([confirmedEvidence])).toEqual({
      detected: true,
      source: 'youtube',
      reason: 'youtube-official-ai-disclosure',
      evidence: [confirmedEvidence],
    });
  });

  it('does not detect ordinary content evidence', () => {
    const ordinaryEvidence: OfficialDisclosureEvidence = {
      ...confirmedEvidence,
      kind: 'unknown',
      matchedText: 'Ordinary video metadata',
      confidence: 'indeterminate',
    };

    expect(detectYouTubeOfficialDisclosure([ordinaryEvidence])).toMatchObject({
      detected: false,
      reason: 'no-confirmed-youtube-official-disclosure',
    });
  });

  it('does not trust similar wording without confirmed official evidence', () => {
    const untrustedSimilarText: OfficialDisclosureEvidence = {
      ...confirmedEvidence,
      kind: 'made-with-ai',
      matchedText: 'Made with AI',
      confidence: 'indeterminate',
      location: 'expanded-description',
      evidenceType: 'official-support-link',
    };

    expect(
      detectYouTubeOfficialDisclosure([untrustedSimilarText]).detected,
    ).toBe(false);
  });

  it('does not detect when evidence is absent', () => {
    expect(detectYouTubeOfficialDisclosure([])).toEqual({
      detected: false,
      source: 'youtube',
      reason: 'no-confirmed-youtube-official-disclosure',
      evidence: [],
    });
  });

  it('deduplicates confirmed evidence', () => {
    expect(
      detectYouTubeOfficialDisclosure([
        confirmedEvidence,
        confirmedEvidence,
      ]).evidence,
    ).toHaveLength(1);
  });
});
