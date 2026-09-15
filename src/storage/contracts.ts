import type { FilterMode } from '@/filtering/contracts';
import type { SupportedSite } from '@/shared/sites';

export const STORAGE_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'settingsV1';
export const ALLOWLIST_SCHEMA_VERSION = 1;
export const ALLOWLIST_STORAGE_KEY = 'allowlistV1';

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
