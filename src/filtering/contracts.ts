import type { DetectionResult, MediaIdentity } from '@/detection/contracts';

export type FilterMode = 'hide' | 'blur' | 'show';

export type FilterReason =
  | 'allowlist'
  | 'user-blocklist'
  | 'official-disclosure'
  | 'no-filter-rule';

export interface FilterPolicyInput {
  enabled: boolean;
  mode: FilterMode;
  media: MediaIdentity;
  detection: DetectionResult;
}

export interface FilterDecision {
  presentation: 'unchanged' | FilterMode;
  reason: FilterReason;
}
