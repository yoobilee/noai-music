import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import type { MediaIdentity } from '@/detection/contracts';
import type { WatchDisclosureStatus } from '@/shared/youtubeWatchDisclosure';
import type { PersistedAllowlist } from '@/storage/contracts';

export type FilterMode = 'hide' | 'blur' | 'mark';

export type FilterReason = 'youtube-official-ai-disclosure';

export interface FilterSettings {
  enabled: boolean;
  mode: FilterMode;
}

export interface FilterPolicyInput {
  settings: FilterSettings;
  identity: MediaIdentity;
  allowlist: PersistedAllowlist;
  disclosureStatus: WatchDisclosureStatus;
  evidence: readonly OfficialDisclosureEvidence[];
}

export type FilterDecision =
  | { action: 'none' }
  | {
      action: FilterMode;
      reason: FilterReason;
    };
