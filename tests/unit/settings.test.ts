import { describe, expect, it } from 'vitest';

import type { FilterScope } from '@/filtering/contracts';
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
  it('gives a new installation the music scope default', async () => {
    const storage = createMemoryStorage();

    await expect(loadSettings(storage)).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      filterScope: 'music',
    });
    expect(storage.data[SETTINGS_STORAGE_KEY]).toEqual({
      ...DEFAULT_SETTINGS,
      filterScope: 'music',
    });
  });

  it.each(['music', 'all'] satisfies readonly FilterScope[])(
    'saves and restores the %s filter scope',
    async (filterScope) => {
      const storage = createMemoryStorage();
      await saveSettings(storage, {
        enabled: false,
        mode: 'mark',
        filterScope,
        youtubeMusicAutoSkip: false,
        uiLocale: 'ko',
      });

      await expect(loadSettings(storage)).resolves.toEqual({
        schemaVersion: STORAGE_SCHEMA_VERSION,
        enabled: false,
        mode: 'mark',
        filterScope,
        youtubeMusicAutoSkip: false,
        uiLocale: 'ko',
      });
    },
  );

  it('migrates 1.0 settings to all scope without losing existing values', async () => {
    const storage = createMemoryStorage({
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        enabled: false,
        mode: 'blur',
        youtubeMusicAutoSkip: false,
        uiLocale: 'en',
      },
    });

    const expected = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      enabled: false,
      mode: 'blur' as const,
      filterScope: 'all' as const,
      youtubeMusicAutoSkip: false,
      uiLocale: 'en' as const,
    };
    await expect(loadSettings(storage)).resolves.toEqual(expected);
    expect(storage.data[SETTINGS_STORAGE_KEY]).toEqual(expected);
  });

  it('migrates older version-one fields while preserving enabled and mode', async () => {
    const storage = createMemoryStorage({
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        enabled: false,
        mode: 'blur',
      },
    });

    await expect(loadSettings(storage)).resolves.toEqual({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      enabled: false,
      mode: 'blur',
      filterScope: 'all',
      youtubeMusicAutoSkip: true,
      uiLocale: 'auto',
    });
  });

  it('normalizes a missing or invalid current filter scope to all', async () => {
    for (const filterScope of [undefined, 'video']) {
      const storage = createMemoryStorage({
        [SETTINGS_STORAGE_KEY]: {
          schemaVersion: STORAGE_SCHEMA_VERSION,
          enabled: false,
          mode: 'mark',
          ...(filterScope === undefined ? {} : { filterScope }),
          youtubeMusicAutoSkip: false,
          uiLocale: 'ko',
        },
      });

      await expect(loadSettings(storage)).resolves.toEqual({
        schemaVersion: STORAGE_SCHEMA_VERSION,
        enabled: false,
        mode: 'mark',
        filterScope: 'all',
        youtubeMusicAutoSkip: false,
        uiLocale: 'ko',
      });
    }
  });

  it('repairs additive fields without losing valid core settings', async () => {
    const storage = createMemoryStorage({
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        enabled: false,
        mode: 'mark',
        filterScope: 'music',
        youtubeMusicAutoSkip: 'yes',
        uiLocale: 'fr',
      },
    });

    await expect(loadSettings(storage)).resolves.toEqual({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      enabled: false,
      mode: 'mark',
      filterScope: 'music',
      youtubeMusicAutoSkip: true,
      uiLocale: 'auto',
    });
  });

  it.each([
    { schemaVersion: 999, enabled: true, mode: 'hide' },
    { schemaVersion: STORAGE_SCHEMA_VERSION, enabled: 'yes', mode: 'hide' },
    { schemaVersion: STORAGE_SCHEMA_VERSION, enabled: true, mode: 'show' },
  ])('keeps future or invalid core schemas fail-closed', async (invalid) => {
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
              filterScope: 'all',
              youtubeMusicAutoSkip: false,
              uiLocale: 'en',
            },
          },
        },
        'local',
      ),
    ).toEqual({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      enabled: true,
      mode: 'blur',
      filterScope: 'all',
      youtubeMusicAutoSkip: false,
      uiLocale: 'en',
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
