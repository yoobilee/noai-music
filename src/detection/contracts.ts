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

export interface OfficialDisclosureEvidence {
  source: 'youtube-official-disclosure';
  text: string;
  location: string;
}

export type DetectionResult =
  | {
      status: 'official-disclosure-found';
      evidence: readonly OfficialDisclosureEvidence[];
    }
  | {
      status: 'no-official-disclosure';
    }
  | {
      status: 'indeterminate';
      reason: string;
    };
