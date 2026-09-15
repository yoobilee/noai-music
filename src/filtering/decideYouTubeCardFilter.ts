import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { evaluateUserRules } from '@/filtering/userRules';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';
import { DEFAULT_BLOCKLIST } from '@/storage/contracts';

import type { FilterDecision, FilterPolicyInput } from './contracts';

export function decideYouTubeCardFilter({
  settings,
  identity,
  allowlist,
  blocklist,
  directBlockKinds,
  disclosureStatus,
  evidence,
}: FilterPolicyInput): FilterDecision {
  if (
    !settings.enabled ||
    identity.videoId === undefined ||
    !isYouTubeVideoId(identity.videoId)
  ) {
    return { action: 'none' };
  }

  const userRule = evaluateUserRules(
    identity,
    allowlist,
    blocklist ?? DEFAULT_BLOCKLIST,
    directBlockKinds ?? { artist: false, channel: false },
  );
  if (userRule === 'allow') return { action: 'none' };
  if (userRule !== 'none') {
    return { action: settings.mode, reason: `direct-${userRule}` };
  }
  if (disclosureStatus !== 'confirmed') return { action: 'none' };

  const detection = detectYouTubeOfficialDisclosure(evidence);
  if (!detection.detected) {
    return { action: 'none' };
  }

  return {
    action: settings.mode,
    reason: 'youtube-official-ai-disclosure',
  };
}
