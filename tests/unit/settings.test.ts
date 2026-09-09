import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  STORAGE_SCHEMA_VERSION,
} from '@/storage/contracts';
import {
  loadSettings,
  readSettingsChange,
  saveSettings,
  type SettingsStorageArea,
} from '@/storage/settings';

function createMemoryStorage(
  initial: Record<string, unknown> = {},
): SettingsStorageArea & { data: Record<string, unknown> } {
  const storage = {
    data: structuredClone(initial),
    async get(key: string) {
      return key in storage.data ? { [key]: structuredClone(storage.data[key]) } : {};
    },
    async set(items: Record<string, unknown>) {
      Object.assign(storage.data, structuredClone(items));
    },
  };
  return storage;
}

describe('versioned local settings', () => {
  it('stores and returns defaults when settings are absent', async () => {
    const storage = createMemoryStorage();

    await expect(loadSettings(storage)).resolves.toEqual(DEFAULT_SETTINGS);
    expect(storage.data[SETTINGS_STORAGE_KEY]).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and loads valid settings', async () => {
    const storage = createMemoryStorage();
    await saveSettings(storage, { enabled: false, mode: 'mark' });

    await expect(loadSettings(storage)).resolves.toEqual({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      enabled: false,
      mode: 'mark',
    });
  });

  it.each([
    { schemaVersion: 999, enabled: true, mode: 'hide' },
    { schemaVersion: STORAGE_SCHEMA_VERSION, enabled: 'yes', mode: 'hide' },
    { schemaVersion: STORAGE_SCHEMA_VERSION, enabled: true, mode: 'show' },
  ])('repairs invalid settings with safe defaults', async (invalid) => {
    const storage = createMemoryStorage({ [SETTINGS_STORAGE_KEY]: invalid });

    await expect(loadSettings(storage)).resolves.toEqual(DEFAULT_SETTINGS);
    expect(storage.data[SETTINGS_STORAGE_KEY]).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts only local settings changes and normalizes corruption', () => {
    expect(
      readSettingsChange(
        {
          [SETTINGS_STORAGE_KEY]: {
            newValue: {
              schemaVersion: STORAGE_SCHEMA_VERSION,
              enabled: true,
              mode: 'blur',
            },
          },
        },
        'local',
      ),
    ).toEqual({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      enabled: true,
      mode: 'blur',
    });
    expect(
      readSettingsChange(
        { [SETTINGS_STORAGE_KEY]: { newValue: { mode: 'invalid' } } },
        'local',
      ),
    ).toEqual(DEFAULT_SETTINGS);
    expect(
      readSettingsChange(
        { [SETTINGS_STORAGE_KEY]: { newValue: DEFAULT_SETTINGS } },
        'sync',
      ),
    ).toBeNull();
  });
});
