import type { OfficialDisclosureEvidence } from '@/detection/contracts';

export const YOUTUBE_WATCH_DISCLOSURE_MESSAGE =
  'noai:youtube-watch-disclosure:lookup';

export type WatchDisclosureStatus =
  | 'confirmed'
  | 'not-detected'
  | 'unknown-or-error';

export type WatchDisclosureFailureReason =
  | 'timeout'
  | 'network-error'
  | 'http-error'
  | 'unexpected-content-type'
  | 'response-too-large'
  | 'invalid-response-url'
  | 'invalid-html'
  | 'queue-full'
  | 'background-unavailable';

export interface WatchDisclosureLookupResult {
  videoId: string;
  status: WatchDisclosureStatus;
  evidence: readonly OfficialDisclosureEvidence[];
  checkedAt: number;
  source: 'cache' | 'network';
  failureReason?: WatchDisclosureFailureReason;
}

export interface YouTubeWatchDisclosureLookupMessage {
  type: typeof YOUTUBE_WATCH_DISCLOSURE_MESSAGE;
  videoId: string;
}

export function isYouTubeWatchDisclosureLookupMessage(
  value: unknown,
): value is YouTubeWatchDisclosureLookupMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === YOUTUBE_WATCH_DISCLOSURE_MESSAGE &&
    typeof candidate.videoId === 'string'
  );
}

export function isWatchDisclosureLookupResult(
  value: unknown,
): value is WatchDisclosureLookupResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.videoId === 'string' &&
    (candidate.status === 'confirmed' ||
      candidate.status === 'not-detected' ||
      candidate.status === 'unknown-or-error') &&
    Array.isArray(candidate.evidence) &&
    typeof candidate.checkedAt === 'number' &&
    (candidate.source === 'cache' || candidate.source === 'network')
  );
}
