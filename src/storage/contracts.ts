import type { FilterMode } from '@/filtering/contracts';
import type { SupportedSite } from '@/shared/sites';

export const STORAGE_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'settingsV1';
export const ALLOWLIST_SCHEMA_VERSION = 1;
export const ALLOWLIST_STORAGE_KEY = 'allowlistV1';
export const BLOCKLIST_SCHEMA_VERSION = 1;
export const BLOCKLIST_STORAGE_KEY = 'blocklistV1';

export interface StoredEntityReference {
  site: SupportedSite;
  kind: 'track' | 'artist' | 'channel';
  id: string;
  label?: string;
}

export interface UserRuleLists {
  allow: readonly StoredEntityReference[];
  block: readonly StoredEntityReference[];
}

export interface PersistedSettings {
  schemaVersion: typeof STORAGE_SCHEMA_VERSION;
  enabled: boolean;
  mode: FilterMode;
  youtubeMusicAutoSkip: boolean;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  enabled: true,
  mode: 'hide',
  youtubeMusicAutoSkip: true,
};

export interface AllowedTrack {
  videoId: string;
  title?: string;
  artistName?: string;
}

export interface AllowedArtist {
  artistId: string;
  name?: string;
}

export interface PersistedAllowlist {
  schemaVersion: typeof ALLOWLIST_SCHEMA_VERSION;
  tracks: readonly AllowedTrack[];
  artists: readonly AllowedArtist[];
}

export const DEFAULT_ALLOWLIST: PersistedAllowlist = {
  schemaVersion: ALLOWLIST_SCHEMA_VERSION,
  tracks: [],
  artists: [],
};

export interface BlockedTrack {
  videoId: string;
  title?: string;
}

export interface BlockedArtist {
  artistId: string;
  name?: string;
}

export interface BlockedChannelId {
  identityType: 'channel-id';
  channelId: string;
  name?: string;
}

export interface BlockedChannelHandle {
  identityType: 'handle';
  handle: string;
  name?: string;
}

export type BlockedChannel = BlockedChannelId | BlockedChannelHandle;

export interface PersistedBlocklist {
  schemaVersion: typeof BLOCKLIST_SCHEMA_VERSION;
  tracks: readonly BlockedTrack[];
  artists: readonly BlockedArtist[];
  channels: readonly BlockedChannel[];
}

export const DEFAULT_BLOCKLIST: PersistedBlocklist = {
  schemaVersion: BLOCKLIST_SCHEMA_VERSION,
  tracks: [],
  artists: [],
  channels: [],
};
