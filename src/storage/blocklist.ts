import { isYouTubeArtistId } from '@/shared/youtubeArtistId';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';

import {
  BLOCKLIST_SCHEMA_VERSION,
  BLOCKLIST_STORAGE_KEY,
  DEFAULT_BLOCKLIST,
  type BlockedArtist,
  type BlockedChannel,
  type BlockedTrack,
  type PersistedBlocklist,
} from './contracts';
import type { SettingsStorageArea, StorageChangeValue } from './settings';

const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 120;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized === '' ? undefined : normalized.slice(0, maxLength);
}

function normalizeTrack(value: unknown): BlockedTrack | undefined {
  if (!isObject(value) || typeof value.videoId !== 'string' || !isYouTubeVideoId(value.videoId)) return undefined;
  const title = normalizeText(value.title, MAX_TITLE_LENGTH);
  return { videoId: value.videoId, ...(title ? { title } : {}) };
}

function normalizeArtist(value: unknown): BlockedArtist | undefined {
  if (!isObject(value) || typeof value.artistId !== 'string' || !isYouTubeArtistId(value.artistId)) return undefined;
  const name = normalizeText(value.name, MAX_NAME_LENGTH);
  return { artistId: value.artistId, ...(name ? { name } : {}) };
}

function normalizeChannel(value: unknown): BlockedChannel | undefined {
  if (!isObject(value) || typeof value.channelId !== 'string' || !isYouTubeArtistId(value.channelId)) return undefined;
  const name = normalizeText(value.name, MAX_NAME_LENGTH);
  return { channelId: value.channelId, ...(name ? { name } : {}) };
}

function normalizeUnique<T>(values: readonly unknown[], normalize: (value: unknown) => T | undefined, id: (value: T) => string): readonly T[] {
  const byId = new Map<string, T>();
  for (const value of values) {
    const item = normalize(value);
    if (item && !byId.has(id(item))) byId.set(id(item), item);
  }
  return [...byId.values()].sort((a, b) => id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0);
}

export function hasUnsupportedBlocklistSchemaVersion(value: unknown): boolean {
  return isObject(value) && typeof value.schemaVersion === 'number' && value.schemaVersion !== BLOCKLIST_SCHEMA_VERSION;
}

export function normalizeBlocklist(value: unknown): PersistedBlocklist {
  if (!isObject(value) || value.schemaVersion !== BLOCKLIST_SCHEMA_VERSION || !Array.isArray(value.tracks) || !Array.isArray(value.artists) || !Array.isArray(value.channels)) {
    return { ...DEFAULT_BLOCKLIST, tracks: [], artists: [], channels: [] };
  }
  return {
    schemaVersion: BLOCKLIST_SCHEMA_VERSION,
    tracks: normalizeUnique(value.tracks, normalizeTrack, (item) => item.videoId),
    artists: normalizeUnique(value.artists, normalizeArtist, (item) => item.artistId),
    channels: normalizeUnique(value.channels, normalizeChannel, (item) => item.channelId),
  };
}

export function isPersistedBlocklist(value: unknown): value is PersistedBlocklist {
  return isObject(value) && JSON.stringify(value) === JSON.stringify(normalizeBlocklist(value));
}

export const addBlockedTrack = (list: PersistedBlocklist, item: BlockedTrack) => normalizeBlocklist({ ...list, tracks: [...list.tracks, item] });
export const removeBlockedTrack = (list: PersistedBlocklist, videoId: string) => { const normalized = normalizeBlocklist(list); return { ...normalized, tracks: normalized.tracks.filter((item) => item.videoId !== videoId) }; };
export const addBlockedArtist = (list: PersistedBlocklist, item: BlockedArtist) => normalizeBlocklist({ ...list, artists: [...list.artists, item] });
export const removeBlockedArtist = (list: PersistedBlocklist, artistId: string) => { const normalized = normalizeBlocklist(list); return { ...normalized, artists: normalized.artists.filter((item) => item.artistId !== artistId) }; };
export const addBlockedChannel = (list: PersistedBlocklist, item: BlockedChannel) => normalizeBlocklist({ ...list, channels: [...list.channels, item] });
export const removeBlockedChannel = (list: PersistedBlocklist, channelId: string) => { const normalized = normalizeBlocklist(list); return { ...normalized, channels: normalized.channels.filter((item) => item.channelId !== channelId) }; };

export async function loadBlocklist(storage: SettingsStorageArea): Promise<PersistedBlocklist> {
  const stored = await storage.get(BLOCKLIST_STORAGE_KEY);
  const raw = stored[BLOCKLIST_STORAGE_KEY];
  const normalized = normalizeBlocklist(raw);
  if (!isPersistedBlocklist(raw) && !hasUnsupportedBlocklistSchemaVersion(raw)) await storage.set({ [BLOCKLIST_STORAGE_KEY]: normalized });
  return normalized;
}

export async function saveBlocklist(storage: SettingsStorageArea, blocklist: PersistedBlocklist): Promise<PersistedBlocklist> {
  const stored = await storage.get(BLOCKLIST_STORAGE_KEY);
  if (hasUnsupportedBlocklistSchemaVersion(stored[BLOCKLIST_STORAGE_KEY])) {
    throw new Error('Unsupported blocklist schema version.');
  }
  const normalized = normalizeBlocklist(blocklist);
  await storage.set({ [BLOCKLIST_STORAGE_KEY]: normalized });
  return normalized;
}

export function readBlocklistChange(changes: Record<string, StorageChangeValue>, areaName: string): PersistedBlocklist | null {
  return areaName === 'local' && BLOCKLIST_STORAGE_KEY in changes ? normalizeBlocklist(changes[BLOCKLIST_STORAGE_KEY]?.newValue) : null;
}
