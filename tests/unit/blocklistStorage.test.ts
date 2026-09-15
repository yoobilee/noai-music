import { describe, expect, it } from 'vitest';
import { addBlockedArtist, addBlockedChannel, addBlockedTrack, loadBlocklist, normalizeBlocklist, readBlocklistChange, removeBlockedArtist, removeBlockedChannel, removeBlockedTrack, saveBlocklist } from '@/storage/blocklist';
import { BLOCKLIST_STORAGE_KEY, DEFAULT_BLOCKLIST } from '@/storage/contracts';
import type { SettingsStorageArea } from '@/storage/settings';

const artistA = 'UCabcdefghijklmnopqrstuv';
const channelB = 'UCzyxwvutsrqponmlkjihgfe';
function memory(initial: Record<string, unknown> = {}): SettingsStorageArea & { data: Record<string, unknown> } {
  const storage = { data: structuredClone(initial), async get(key: string) { return key in storage.data ? { [key]: structuredClone(storage.data[key]) } : {}; }, async set(items: Record<string, unknown>) { Object.assign(storage.data, structuredClone(items)); } };
  return storage;
}

describe('versioned local direct blocklist', () => {
  it('creates the empty default', async () => {
    const storage = memory();
    await expect(loadBlocklist(storage)).resolves.toEqual(DEFAULT_BLOCKLIST);
    expect(storage.data[BLOCKLIST_STORAGE_KEY]).toEqual(DEFAULT_BLOCKLIST);
  });
  it('normalizes, trims, deduplicates, rejects malformed IDs, and sorts deterministically', () => {
    expect(normalizeBlocklist({ schemaVersion: 1, tracks: [{ videoId: 'TrackVideo2', title: `  ${'x'.repeat(210)} ` }, { videoId: 'TrackVideo1' }, { videoId: 'TrackVideo1', title: 'duplicate' }, { videoId: 'bad' }], artists: [{ artistId: artistA, name: `  Artist   A  ` }, { artistId: 'handle' }], channels: [{ channelId: channelB }, { channelId: channelB, name: 'duplicate' }] })).toEqual({ schemaVersion: 1, tracks: [{ videoId: 'TrackVideo1' }, { videoId: 'TrackVideo2', title: 'x'.repeat(200) }], artists: [{ artistId: artistA, name: 'Artist A' }], channels: [{ channelId: channelB }] });
  });
  it('recovers corrupt values but preserves an unsupported future schema', async () => {
    const corrupt = memory({ [BLOCKLIST_STORAGE_KEY]: 'bad' });
    await expect(loadBlocklist(corrupt)).resolves.toEqual(DEFAULT_BLOCKLIST);
    expect(corrupt.data[BLOCKLIST_STORAGE_KEY]).toEqual(DEFAULT_BLOCKLIST);
    const future = { schemaVersion: 2, tracks: [], artists: [], channels: [], future: true };
    const storage = memory({ [BLOCKLIST_STORAGE_KEY]: future });
    await expect(loadBlocklist(storage)).resolves.toEqual(DEFAULT_BLOCKLIST);
    expect(storage.data[BLOCKLIST_STORAGE_KEY]).toEqual(future);
    await expect(saveBlocklist(storage, { ...DEFAULT_BLOCKLIST, tracks: [{ videoId: 'TrackVideo1' }] })).rejects.toThrow('Unsupported blocklist schema version');
    expect(storage.data[BLOCKLIST_STORAGE_KEY]).toEqual(future);
  });
  it('adds and removes each kind idempotently', () => {
    const tracks = addBlockedTrack(DEFAULT_BLOCKLIST, { videoId: 'TrackVideo1' });
    expect(addBlockedTrack(tracks, { videoId: 'TrackVideo1', title: 'duplicate' })).toEqual(tracks);
    expect(removeBlockedTrack(tracks, 'TrackVideo1')).toEqual(DEFAULT_BLOCKLIST);
    const artists = addBlockedArtist(DEFAULT_BLOCKLIST, { artistId: artistA });
    expect(removeBlockedArtist(artists, artistA)).toEqual(DEFAULT_BLOCKLIST);
    const channels = addBlockedChannel(DEFAULT_BLOCKLIST, { channelId: channelB });
    expect(removeBlockedChannel(channels, channelB)).toEqual(DEFAULT_BLOCKLIST);
  });
  it('parses local storage changes only', () => {
    const value = { schemaVersion: 1, tracks: [{ videoId: 'TrackVideo1' }], artists: [], channels: [] };
    expect(readBlocklistChange({ [BLOCKLIST_STORAGE_KEY]: { newValue: value } }, 'local')).toEqual(value);
    expect(readBlocklistChange({ [BLOCKLIST_STORAGE_KEY]: { newValue: value } }, 'sync')).toBeNull();
  });
});
