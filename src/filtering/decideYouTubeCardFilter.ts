import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { isMediaAllowed } from '@/filtering/allowlist';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';

import type { FilterDecision, FilterPolicyInput } from './contracts';

export function decideYouTubeCardFilter({
  settings,
  identity,
  allowlist,
  disclosureStatus,
  evidence,
}: FilterPolicyInput): FilterDecision {
  if (
    !settings.enabled ||
    identity.videoId === undefined ||
    !isYouTubeVideoId(identity.videoId) ||
    isMediaAllowed(identity, allowlist) ||
    disclosureStatus !== 'confirmed'
  ) {
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
