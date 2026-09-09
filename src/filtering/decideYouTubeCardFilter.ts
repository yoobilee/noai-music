import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';

import type { FilterDecision, FilterPolicyInput } from './contracts';

export function decideYouTubeCardFilter({
  settings,
  disclosureStatus,
  evidence,
}: FilterPolicyInput): FilterDecision {
  if (!settings.enabled || disclosureStatus !== 'confirmed') {
    return { action: 'none' };
  }

  const detection = detectYouTubeOfficialDisclosure(evidence);
  if (!detection.detected) {
    return { action: 'none' };
  }

  return {
    action: settings.mode,
    reason: 'youtube-official-ai-disclosure',
  };
}
