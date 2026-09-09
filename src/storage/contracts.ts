import type { FilterMode } from '@/filtering/contracts';
import type { SupportedSite } from '@/shared/sites';

export const STORAGE_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'settingsV1';

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
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  enabled: true,
  mode: 'hide',
};
