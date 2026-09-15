import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import type { MediaIdentity } from '@/detection/contracts';
import { isMediaAllowed } from '@/filtering/allowlist';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import type {
  PersistedAllowlist,
  PersistedSettings,
} from '@/storage/contracts';

interface YouTubeMusicAutoSkipInput {
  settings: Pick<PersistedSettings, 'enabled' | 'youtubeMusicAutoSkip'>;
  expectedVideoId: string;
  currentVideoId: string | undefined;
  currentIdentity: MediaIdentity | undefined;
  allowlist: PersistedAllowlist;
  result: WatchDisclosureLookupResult;
}

export function decideYouTubeMusicAutoSkip({
  settings,
  expectedVideoId,
  currentVideoId,
  currentIdentity,
  allowlist,
  result,
}: YouTubeMusicAutoSkipInput): boolean {
  if (
    !settings.enabled ||
    !settings.youtubeMusicAutoSkip ||
    !isYouTubeVideoId(expectedVideoId) ||
    currentVideoId !== expectedVideoId ||
    currentIdentity === undefined ||
    currentIdentity.videoId !== expectedVideoId ||
    isMediaAllowed(currentIdentity, allowlist) ||
    result.videoId !== expectedVideoId ||
    result.status !== 'confirmed' ||
    result.failureReason !== undefined
  ) {
    return false;
  }

  try {
    return detectYouTubeOfficialDisclosure(result.evidence).detected;
  } catch {
    return false;
  }
}
