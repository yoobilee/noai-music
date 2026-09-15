import { isYouTubeArtistId } from '@/shared/youtubeArtistId';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';

import {
  ALLOWLIST_SCHEMA_VERSION,
  ALLOWLIST_STORAGE_KEY,
  DEFAULT_ALLOWLIST,
  type AllowedArtist,
  type AllowedTrack,
  type PersistedAllowlist,
} from './contracts';
import type { SettingsStorageArea, StorageChangeValue } from './settings';

const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 120;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasUnsupportedAllowlistSchemaVersion(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.schemaVersion === 'number' &&
    value.schemaVersion !== ALLOWLIST_SCHEMA_VERSION
  );
}

function normalizeDisplayText(
  value: unknown,
  maximumLength: number,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized === '' ? undefined : normalized.slice(0, maximumLength);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeTrack(value: unknown): AllowedTrack | undefined {
  if (!isObject(value) || typeof value.videoId !== 'string') {
    return undefined;
  }
  if (!isYouTubeVideoId(value.videoId)) {
    return undefined;
  }

  const title = normalizeDisplayText(value.title, MAX_TITLE_LENGTH);
  const artistName = normalizeDisplayText(value.artistName, MAX_NAME_LENGTH);
  return {
    videoId: value.videoId,
    ...(title === undefined ? {} : { title }),
    ...(artistName === undefined ? {} : { artistName }),
  };
}

function normalizeArtist(value: unknown): AllowedArtist | undefined {
  if (!isObject(value) || typeof value.artistId !== 'string') {
    return undefined;
  }
  if (!isYouTubeArtistId(value.artistId)) {
    return undefined;
  }

  const name = normalizeDisplayText(value.name, MAX_NAME_LENGTH);
  return {
    artistId: value.artistId,
    ...(name === undefined ? {} : { name }),
  };
}

function normalizeUnique<T>(
  values: readonly unknown[],
  normalize: (value: unknown) => T | undefined,
  getId: (value: T) => string,
): readonly T[] {
  const byId = new Map<string, T>();
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized !== undefined && !byId.has(getId(normalized))) {
      byId.set(getId(normalized), normalized);
    }
  }
  return [...byId.values()].sort((left, right) =>
    compareIds(getId(left), getId(right)),
  );
}

export function normalizeAllowlist(value: unknown): PersistedAllowlist {
  if (
    !isObject(value) ||
    value.schemaVersion !== ALLOWLIST_SCHEMA_VERSION ||
    !Array.isArray(value.tracks) ||
    !Array.isArray(value.artists)
  ) {
    return { ...DEFAULT_ALLOWLIST, tracks: [], artists: [] };
  }

  return {
    schemaVersion: ALLOWLIST_SCHEMA_VERSION,
    tracks: normalizeUnique(value.tracks, normalizeTrack, (track) => track.videoId),
    artists: normalizeUnique(
      value.artists,
      normalizeArtist,
      (artist) => artist.artistId,
    ),
  };
}

export function isPersistedAllowlist(value: unknown): value is PersistedAllowlist {
  if (!isObject(value)) {
    return false;
  }
  return JSON.stringify(value) === JSON.stringify(normalizeAllowlist(value));
}

export function addAllowedTrack(
  allowlist: PersistedAllowlist,
  track: AllowedTrack,
): PersistedAllowlist {
  return normalizeAllowlist({
    ...allowlist,
    tracks: [...allowlist.tracks, track],
  });
}

export function removeAllowedTrack(
  allowlist: PersistedAllowlist,
  videoId: string,
): PersistedAllowlist {
  const normalized = normalizeAllowlist(allowlist);
  return {
    ...normalized,
    tracks: normalized.tracks.filter((track) => track.videoId !== videoId),
  };
}

export function addAllowedArtist(
  allowlist: PersistedAllowlist,
  artist: AllowedArtist,
): PersistedAllowlist {
  return normalizeAllowlist({
    ...allowlist,
    artists: [...allowlist.artists, artist],
  });
}

export function removeAllowedArtist(
  allowlist: PersistedAllowlist,
  artistId: string,
): PersistedAllowlist {
  const normalized = normalizeAllowlist(allowlist);
  return {
    ...normalized,
    artists: normalized.artists.filter((artist) => artist.artistId !== artistId),
  };
}

export async function loadAllowlist(
  storageArea: SettingsStorageArea,
): Promise<PersistedAllowlist> {
  const stored = await storageArea.get(ALLOWLIST_STORAGE_KEY);
  const rawAllowlist = stored[ALLOWLIST_STORAGE_KEY];
  const allowlist = normalizeAllowlist(rawAllowlist);
  if (
    !isPersistedAllowlist(rawAllowlist) &&
    !hasUnsupportedAllowlistSchemaVersion(rawAllowlist)
  ) {
    await storageArea.set({ [ALLOWLIST_STORAGE_KEY]: allowlist });
  }
  return allowlist;
}

export async function saveAllowlist(
  storageArea: SettingsStorageArea,
  allowlist: PersistedAllowlist,
): Promise<PersistedAllowlist> {
  const normalized = normalizeAllowlist(allowlist);
  await storageArea.set({ [ALLOWLIST_STORAGE_KEY]: normalized });
  return normalized;
}

export function readAllowlistChange(
  changes: Record<string, StorageChangeValue>,
  areaName: string,
): PersistedAllowlist | null {
  if (areaName !== 'local' || !(ALLOWLIST_STORAGE_KEY in changes)) {
    return null;
  }
  return normalizeAllowlist(changes[ALLOWLIST_STORAGE_KEY]?.newValue);
}
