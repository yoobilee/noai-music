import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import type { MediaIdentity } from '@/detection/contracts';
import { evaluateUserRules } from '@/filtering/userRules';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';
import type { WatchDisclosureLookupResult } from '@/shared/youtubeWatchDisclosure';
import type { FilterScope } from '@/filtering/contracts';
import type {
  PersistedAllowlist,
  PersistedBlocklist,
  PersistedSettings,
} from '@/storage/contracts';
import { DEFAULT_BLOCKLIST } from '@/storage/contracts';

interface YouTubeMusicAutoSkipInput {
  settings: Pick<PersistedSettings, 'enabled' | 'youtubeMusicAutoSkip'>;
  expectedVideoId: string;
  currentVideoId: string | undefined;
  currentIdentity: MediaIdentity | undefined;
  allowlist: PersistedAllowlist;
  blocklist?: PersistedBlocklist;
  filterScope: FilterScope;
  result: WatchDisclosureLookupResult;
}

export function decideYouTubeMusicAutoSkip({
  settings,
  expectedVideoId,
  currentVideoId,
  currentIdentity,
  allowlist,
  blocklist,
  filterScope,
  result,
}: YouTubeMusicAutoSkipInput): boolean {
  if (
    !settings.enabled ||
    !settings.youtubeMusicAutoSkip ||
    !isYouTubeVideoId(expectedVideoId) ||
    currentVideoId !== expectedVideoId ||
    currentIdentity === undefined ||
    currentIdentity.videoId !== expectedVideoId
  ) {
    return false;
  }

  const userRule = evaluateUserRules(currentIdentity, allowlist, blocklist ?? DEFAULT_BLOCKLIST, { artist: true, channel: false });
  if (userRule === 'allow') return false;
  if (userRule === 'block-track' || userRule === 'block-artist') return true;
  if (filterScope === 'music' && result.contentKind !== 'music') return false;
  if (
    result.videoId !== expectedVideoId ||
    result.status !== 'confirmed' ||
    result.failureReason !== undefined
  ) return false;

  try {
    return detectYouTubeOfficialDisclosure(result.evidence).detected;
  } catch {
    return false;
  }
}
