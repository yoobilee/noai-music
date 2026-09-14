import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import type { PersistedSettings } from '@/storage/contracts';

interface YouTubeMusicAutoSkipInput {
  settings: Pick<PersistedSettings, 'enabled' | 'youtubeMusicAutoSkip'>;
  expectedVideoId: string;
  currentVideoId: string | undefined;
  result: WatchDisclosureLookupResult;
}

export function decideYouTubeMusicAutoSkip({
  settings,
  expectedVideoId,
  currentVideoId,
  result,
}: YouTubeMusicAutoSkipInput): boolean {
  if (
    !settings.enabled ||
    !settings.youtubeMusicAutoSkip ||
    !isYouTubeVideoId(expectedVideoId) ||
    currentVideoId !== expectedVideoId ||
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
