import type { SupportedSite } from '@/shared/sites';

export interface MediaIdentity {
  site: SupportedSite;
  videoId?: string;
  channelId?: string;
  artistIds: readonly string[];
}

export interface MediaCandidateSnapshot {
  identity: MediaIdentity;
  title?: string;
  artistNames: readonly string[];
}

export type OfficialDisclosureKind =
  | 'made-with-ai'
  | 'altered-or-synthetic-content'
  | 'unknown';

export interface OfficialDisclosureEvidence {
  source: 'youtube';
  kind: OfficialDisclosureKind;
  matchedText: string;
  confidence: 'confirmed' | 'indeterminate';
  location: 'metadata-badge' | 'expanded-description';
  evidenceType: 'accessibility-label' | 'official-support-link';
}

export type DetectionResult =
  | {
      detected: true;
      source: 'youtube';
      reason: 'youtube-official-ai-disclosure';
      evidence: readonly OfficialDisclosureEvidence[];
    }
  | {
      detected: false;
      source: 'youtube';
      reason: 'no-confirmed-youtube-official-disclosure';
      evidence: readonly OfficialDisclosureEvidence[];
    };
