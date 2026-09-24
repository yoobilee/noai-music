import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import type { MediaIdentity } from '@/detection/contracts';
import type {
  ContentKind,
  WatchDisclosureStatus,
} from '@/shared/youtubeWatchDisclosure';
import type { PersistedAllowlist, PersistedBlocklist } from '@/storage/contracts';

export type FilterMode = 'hide' | 'blur' | 'mark';

export type FilterScope = 'music' | 'all';

export type FilterReason =
  | 'youtube-official-ai-disclosure'
  | 'direct-block-track'
  | 'direct-block-artist'
  | 'direct-block-channel';

export interface FilterSettings {
  enabled: boolean;
  mode: FilterMode;
}

export interface FilterPolicyInput {
  settings: FilterSettings;
  identity: MediaIdentity;
  allowlist: PersistedAllowlist;
  blocklist?: PersistedBlocklist;
  directBlockKinds?: DirectBlockKinds;
  filterScope: FilterScope;
  disclosureStatus: WatchDisclosureStatus;
  contentKind: ContentKind;
  evidence: readonly OfficialDisclosureEvidence[];
}

export interface DirectBlockKinds {
  artist: boolean;
  channel: boolean;
}

export type FilterDecision =
  | { action: 'none' }
  | {
      action: FilterMode;
      reason: FilterReason;
    };
