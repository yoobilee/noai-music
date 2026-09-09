import type { OfficialDisclosureEvidence } from '@/detection/contracts';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';
import { isYouTubeVideoId } from '@/adapters/youtube/videoId';
import type {
  WatchDisclosureFailureReason,
  WatchDisclosureLookupResult,
  WatchDisclosureStatus,
} from '@/shared/youtubeWatchDisclosure';

export const YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION = 1;
export const YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY =
  'youtubeDisclosureCacheV1';
export const YOUTUBE_DISCLOSURE_CACHE_MAX_ENTRIES = 500;

export const YOUTUBE_DISCLOSURE_CACHE_TTL_MS: Readonly<
  Record<WatchDisclosureStatus, number>
> = {
  confirmed: 7 * 24 * 60 * 60 * 1000,
  'not-detected': 12 * 60 * 60 * 1000,
  'unknown-or-error': 5 * 60 * 1000,
};

interface StoredDisclosureCacheEntry {
  videoId: string;
  status: WatchDisclosureStatus;
  evidence: readonly OfficialDisclosureEvidence[];
  checkedAt: number;
  expiresAt: number;
  failureReason?: WatchDisclosureFailureReason;
}

interface StoredDisclosureCache {
  schemaVersion: typeof YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION;
  entries: Record<string, StoredDisclosureCacheEntry>;
}

export interface DisclosureCacheStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface YouTubeDisclosureCache {
  get(videoId: string): Promise<WatchDisclosureLookupResult | null>;
  set(result: WatchDisclosureLookupResult): Promise<void>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredStatus(value: unknown): value is WatchDisclosureStatus {
  return (
    value === 'confirmed' ||
    value === 'not-detected' ||
    value === 'unknown-or-error'
  );
}

const FAILURE_REASONS = new Set<WatchDisclosureFailureReason>([
  'timeout',
  'network-error',
  'http-error',
  'unexpected-content-type',
  'response-too-large',
  'invalid-response-url',
  'invalid-html',
  'queue-full',
  'background-unavailable',
]);

function readEvidence(value: unknown): OfficialDisclosureEvidence | null {
  if (!isObject(value)) {
    return null;
  }

  const { confidence, evidenceType, kind, location, matchedText, source } = value;
  if (
    source !== 'youtube' ||
    (kind !== 'made-with-ai' &&
      kind !== 'altered-or-synthetic-content' &&
      kind !== 'unknown') ||
    typeof matchedText !== 'string' ||
    matchedText.length > 500 ||
    (confidence !== 'confirmed' && confidence !== 'indeterminate') ||
    (location !== 'metadata-badge' && location !== 'expanded-description') ||
    (evidenceType !== 'accessibility-label' &&
      evidenceType !== 'official-support-link')
  ) {
    return null;
  }

  return value as unknown as OfficialDisclosureEvidence;
}

function readStoredEntry(value: unknown): StoredDisclosureCacheEntry | null {
  if (!isObject(value)) {
    return null;
  }

  const { checkedAt, evidence, expiresAt, failureReason, status, videoId } = value;
  if (
    typeof videoId !== 'string' ||
    !isYouTubeVideoId(videoId) ||
    !isStoredStatus(status) ||
    !Array.isArray(evidence) ||
    typeof checkedAt !== 'number' ||
    !Number.isFinite(checkedAt) ||
    typeof expiresAt !== 'number' ||
    !Number.isFinite(expiresAt) ||
    checkedAt < 0 ||
    expiresAt !== checkedAt + YOUTUBE_DISCLOSURE_CACHE_TTL_MS[status] ||
    (failureReason !== undefined &&
      (typeof failureReason !== 'string' ||
        !FAILURE_REASONS.has(failureReason as WatchDisclosureFailureReason)))
  ) {
    return null;
  }

  const parsedEvidence = evidence.map(readEvidence);
  if (parsedEvidence.some((item) => item === null)) {
    return null;
  }
  const validEvidence = parsedEvidence as OfficialDisclosureEvidence[];
  const detection = detectYouTubeOfficialDisclosure(validEvidence);
  if (
    (status === 'confirmed' && !detection.detected) ||
    (status === 'not-detected' &&
      (detection.detected ||
        validEvidence.some(({ confidence }) => confidence === 'indeterminate'))) ||
    (status === 'unknown-or-error' && failureReason === undefined) ||
    (status !== 'unknown-or-error' && failureReason !== undefined)
  ) {
    return null;
  }

  return {
    videoId,
    status,
    evidence: validEvidence,
    checkedAt,
    expiresAt,
    ...(failureReason === undefined
      ? {}
      : { failureReason: failureReason as WatchDisclosureFailureReason }),
  };
}

function readStoredCache(value: unknown): StoredDisclosureCache {
  const empty: StoredDisclosureCache = {
    schemaVersion: YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION,
    entries: {},
  };

  if (
    !isObject(value) ||
    value.schemaVersion !== YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION ||
    !isObject(value.entries)
  ) {
    return empty;
  }

  const entries: Record<string, StoredDisclosureCacheEntry> = {};
  for (const [videoId, candidate] of Object.entries(value.entries)) {
    const entry = readStoredEntry(candidate);
    if (entry !== null && entry.videoId === videoId) {
      entries[videoId] = entry;
    }
  }

  return { schemaVersion: YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION, entries };
}

function toLookupResult(
  entry: StoredDisclosureCacheEntry,
): WatchDisclosureLookupResult {
  return {
    videoId: entry.videoId,
    status: entry.status,
    evidence: entry.evidence,
    checkedAt: entry.checkedAt,
    source: 'cache',
    ...(entry.failureReason === undefined
      ? {}
      : { failureReason: entry.failureReason }),
  };
}

export function createYouTubeDisclosureCache(
  storageArea: DisclosureCacheStorageArea,
  now: () => number = Date.now,
): YouTubeDisclosureCache {
  let mutationChain: Promise<void> = Promise.resolve();

  const readCache = async (): Promise<StoredDisclosureCache> => {
    const stored = await storageArea.get(YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY);
    return readStoredCache(stored[YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY]);
  };

  const queueMutation = (mutate: () => Promise<void>): Promise<void> => {
    const operation = mutationChain.then(mutate);
    mutationChain = operation.catch(() => undefined);
    return operation;
  };

  return {
    async get(videoId) {
      await mutationChain;
      const cache = await readCache();
      const entry = cache.entries[videoId];
      if (entry === undefined) {
        return null;
      }

      if (entry.expiresAt <= now()) {
        await queueMutation(async () => {
          const latest = await readCache();
          if (latest.entries[videoId]?.expiresAt === entry.expiresAt) {
            delete latest.entries[videoId];
            await storageArea.set({
              [YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY]: latest,
            });
          }
        });
        return null;
      }

      return toLookupResult(entry);
    },
    async set(result) {
      await queueMutation(async () => {
        const currentTime = now();
        const cache = await readCache();
        const liveEntries = Object.values(cache.entries).filter(
          ({ expiresAt }) => expiresAt > currentTime,
        );
        const entry: StoredDisclosureCacheEntry = {
          videoId: result.videoId,
          status: result.status,
          evidence: result.evidence,
          checkedAt: result.checkedAt,
          expiresAt:
            result.checkedAt + YOUTUBE_DISCLOSURE_CACHE_TTL_MS[result.status],
          ...(result.failureReason === undefined
            ? {}
            : { failureReason: result.failureReason }),
        };

        const validatedEntry = readStoredEntry(entry);
        if (validatedEntry === null) {
          return;
        }

        const entries = Object.fromEntries(
          [
            ...liveEntries.filter(({ videoId }) => videoId !== result.videoId),
            validatedEntry,
          ]
            .sort((left, right) => right.checkedAt - left.checkedAt)
            .slice(0, YOUTUBE_DISCLOSURE_CACHE_MAX_ENTRIES)
            .map((item) => [item.videoId, item]),
        );

        await storageArea.set({
          [YOUTUBE_DISCLOSURE_CACHE_STORAGE_KEY]: {
            schemaVersion: YOUTUBE_DISCLOSURE_CACHE_SCHEMA_VERSION,
            entries,
          } satisfies StoredDisclosureCache,
        });
      });
    },
  };
}
