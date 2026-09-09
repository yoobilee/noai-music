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
    (value.mode === 'hide' || value.mode === 'blur' || value.mode === 'mark')
  );
}

export function normalizeSettings(value: unknown): PersistedSettings {
  return isPersistedSettings(value)
    ? {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        enabled: value.enabled,
        mode: value.mode,
      }
    : { ...DEFAULT_SETTINGS };
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
  settings: Pick<PersistedSettings, 'enabled' | 'mode'>,
): Promise<PersistedSettings> {
  const normalized = normalizeSettings({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    enabled: settings.enabled,
    mode: settings.mode,
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
