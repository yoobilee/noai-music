import type { FilterMode } from '@/filtering/contracts';
import type { SupportedSite } from '@/shared/sites';

export const STORAGE_SCHEMA_VERSION = 1;

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
  locale: 'system' | 'ko' | 'en';
  rules: UserRuleLists;
}
