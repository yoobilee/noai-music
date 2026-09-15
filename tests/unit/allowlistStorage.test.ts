import { describe, expect, it } from 'vitest';

import {
  addAllowedArtist,
  addAllowedTrack,
  loadAllowlist,
  readAllowlistChange,
  removeAllowedArtist,
  removeAllowedTrack,
  saveAllowlist,
} from '@/storage/allowlist';
import {
  ALLOWLIST_SCHEMA_VERSION,
  ALLOWLIST_STORAGE_KEY,
  DEFAULT_ALLOWLIST,
} from '@/storage/contracts';
import type { SettingsStorageArea } from '@/storage/settings';

const artistA = 'UCabcdefghijklmnopqrstuv';
const artistB = 'UCzyxwvutsrqponmlkjihgfe';

function createMemoryStorage(
  initial: Record<string, unknown> = {},
): SettingsStorageArea & { data: Record<string, unknown> } {
  const storage = {
    data: structuredClone(initial),
    async get(key: string) {
      return key in storage.data
        ? { [key]: structuredClone(storage.data[key]) }
        : {};
    },
    async set(items: Record<string, unknown>) {
      Object.assign(storage.data, structuredClone(items));
    },
  };
  return storage;
}

describe('versioned local allowlist', () => {
  it('stores and returns an empty default when absent', async () => {
    const storage = createMemoryStorage();

    await expect(loadAllowlist(storage)).resolves.toEqual(DEFAULT_ALLOWLIST);
    expect(storage.data[ALLOWLIST_STORAGE_KEY]).toEqual(DEFAULT_ALLOWLIST);
  });

  it('saves and loads valid tracks and artists in stable ID order', async () => {
    const storage = createMemoryStorage();
    await saveAllowlist(storage, {
      schemaVersion: ALLOWLIST_SCHEMA_VERSION,
      tracks: [
        { videoId: 'TrackVideo2', title: ' Second  track ' },
        { videoId: 'TrackVideo1', artistName: ' Artist ' },
      ],
      artists: [{ artistId: artistB }, { artistId: artistA, name: ' Artist A ' }],
    });

    await expect(loadAllowlist(storage)).resolves.toEqual({
      schemaVersion: ALLOWLIST_SCHEMA_VERSION,
      tracks: [
        { videoId: 'TrackVideo1', artistName: 'Artist' },
        { videoId: 'TrackVideo2', title: 'Second track' },
      ],
      artists: [
        { artistId: artistA, name: 'Artist A' },
        { artistId: artistB },
      ],
    });
  });

  it('deduplicates IDs and rejects invalid track and artist identities', async () => {
    const storage = createMemoryStorage({
      [ALLOWLIST_STORAGE_KEY]: {
        schemaVersion: ALLOWLIST_SCHEMA_VERSION,
        tracks: [
          { videoId: 'TrackVideo1', title: 'First' },
          { videoId: 'TrackVideo1', title: 'Duplicate' },
          { videoId: 'too-short' },
        ],
        artists: [
          { artistId: artistA, name: 'First' },
          { artistId: artistA, name: 'Duplicate' },
          { artistId: 'artist-name' },
        ],
      },
    });

    await expect(loadAllowlist(storage)).resolves.toEqual({
      schemaVersion: ALLOWLIST_SCHEMA_VERSION,
      tracks: [{ videoId: 'TrackVideo1', title: 'First' }],
      artists: [{ artistId: artistA, name: 'First' }],
    });
  });

  it('recovers corrupt values without retaining invalid data', async () => {
    for (const corrupt of [null, 'corrupt', {}, { schemaVersion: 1 }]) {
      const storage = createMemoryStorage({ [ALLOWLIST_STORAGE_KEY]: corrupt });
      await expect(loadAllowlist(storage)).resolves.toEqual(DEFAULT_ALLOWLIST);
      expect(storage.data[ALLOWLIST_STORAGE_KEY]).toEqual(DEFAULT_ALLOWLIST);
    }
  });

  it('does not overwrite a storage version this build cannot migrate', async () => {
    const future = { schemaVersion: 2, tracks: [], artists: [], future: true };
    const storage = createMemoryStorage({ [ALLOWLIST_STORAGE_KEY]: future });

    await expect(loadAllowlist(storage)).resolves.toEqual(DEFAULT_ALLOWLIST);
    expect(storage.data[ALLOWLIST_STORAGE_KEY]).toEqual(future);
  });

  it('adds and removes tracks and artists idempotently', () => {
    const withTrack = addAllowedTrack(DEFAULT_ALLOWLIST, {
      videoId: 'TrackVideo1',
    });
    expect(
      addAllowedTrack(withTrack, { videoId: 'TrackVideo1', title: 'Duplicate' }),
    ).toEqual(withTrack);
    expect(removeAllowedTrack(withTrack, 'TrackVideo1')).toEqual(
      DEFAULT_ALLOWLIST,
    );

    const withArtist = addAllowedArtist(DEFAULT_ALLOWLIST, {
      artistId: artistA,
    });
    expect(addAllowedArtist(withArtist, { artistId: artistA, name: 'Duplicate' })).toEqual(
      withArtist,
    );
    expect(removeAllowedArtist(withArtist, artistA)).toEqual(DEFAULT_ALLOWLIST);
  });

  it('accepts only local changes and normalizes invalid entries', () => {
    expect(
      readAllowlistChange(
        {
          [ALLOWLIST_STORAGE_KEY]: {
            newValue: {
              schemaVersion: ALLOWLIST_SCHEMA_VERSION,
              tracks: [{ videoId: 'TrackVideo1' }, { videoId: 'invalid' }],
              artists: [{ artistId: artistA }],
            },
          },
        },
        'local',
      ),
    ).toEqual({
      schemaVersion: ALLOWLIST_SCHEMA_VERSION,
      tracks: [{ videoId: 'TrackVideo1' }],
      artists: [{ artistId: artistA }],
    });
    expect(
      readAllowlistChange(
        { [ALLOWLIST_STORAGE_KEY]: { newValue: DEFAULT_ALLOWLIST } },
        'sync',
      ),
    ).toBeNull();
  });
});
