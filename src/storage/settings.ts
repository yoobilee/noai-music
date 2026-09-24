import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  STORAGE_SCHEMA_VERSION,
  type PersistedSettings,
} from './contracts';

export interface SettingsStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface StorageChangeValue {
  newValue?: unknown;
  oldValue?: unknown;
}

const LEGACY_SETTINGS_SCHEMA_VERSION = 1;
const INVALID_PERSISTED_FILTER_SCOPE_FALLBACK = 'all';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPersistedSettings(
  value: unknown,
): value is PersistedSettings {
  return (
    isObject(value) &&
    value.schemaVersion === STORAGE_SCHEMA_VERSION &&
    typeof value.enabled === 'boolean' &&
    (value.mode === 'hide' || value.mode === 'blur' || value.mode === 'mark') &&
    (value.filterScope === 'music' || value.filterScope === 'all') &&
    typeof value.youtubeMusicAutoSkip === 'boolean' &&
    (value.uiLocale === 'auto' || value.uiLocale === 'ko' || value.uiLocale === 'en')
  );
}

export function normalizeSettings(value: unknown): PersistedSettings {
  if (
    !isObject(value) ||
    (value.schemaVersion !== STORAGE_SCHEMA_VERSION &&
      value.schemaVersion !== LEGACY_SETTINGS_SCHEMA_VERSION) ||
    typeof value.enabled !== 'boolean' ||
    (value.mode !== 'hide' && value.mode !== 'blur' && value.mode !== 'mark')
  ) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    enabled: value.enabled,
    mode: value.mode,
    filterScope:
      value.schemaVersion === LEGACY_SETTINGS_SCHEMA_VERSION
        ? 'all'
        : value.filterScope === 'music' || value.filterScope === 'all'
          ? value.filterScope
          : INVALID_PERSISTED_FILTER_SCOPE_FALLBACK,
    youtubeMusicAutoSkip:
      typeof value.youtubeMusicAutoSkip === 'boolean'
        ? value.youtubeMusicAutoSkip
        : DEFAULT_SETTINGS.youtubeMusicAutoSkip,
    uiLocale:
      value.uiLocale === 'ko' || value.uiLocale === 'en'
        ? value.uiLocale
        : DEFAULT_SETTINGS.uiLocale,
  };
}

export async function loadSettings(
  storageArea: SettingsStorageArea,
): Promise<PersistedSettings> {
  const stored = await storageArea.get(SETTINGS_STORAGE_KEY);
  const rawSettings = stored[SETTINGS_STORAGE_KEY];
  const settings = normalizeSettings(rawSettings);

  if (!isPersistedSettings(rawSettings)) {
    await storageArea.set({ [SETTINGS_STORAGE_KEY]: settings });
  }

  return settings;
}

export async function saveSettings(
  storageArea: SettingsStorageArea,
  settings: Pick<
    PersistedSettings,
    'enabled' | 'mode' | 'filterScope' | 'youtubeMusicAutoSkip' | 'uiLocale'
  >,
): Promise<PersistedSettings> {
  const normalized = normalizeSettings({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    enabled: settings.enabled,
    mode: settings.mode,
    filterScope: settings.filterScope,
    youtubeMusicAutoSkip: settings.youtubeMusicAutoSkip,
    uiLocale: settings.uiLocale,
  });
  await storageArea.set({ [SETTINGS_STORAGE_KEY]: normalized });
  return normalized;
}

export function readSettingsChange(
  changes: Record<string, StorageChangeValue>,
  areaName: string,
): PersistedSettings | null {
  if (areaName !== 'local' || !(SETTINGS_STORAGE_KEY in changes)) {
    return null;
  }

  return normalizeSettings(changes[SETTINGS_STORAGE_KEY]?.newValue);
}
