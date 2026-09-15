import { describe, expect, it } from 'vitest';
import { evaluateUserRules } from '@/filtering/userRules';
import { DEFAULT_ALLOWLIST, DEFAULT_BLOCKLIST } from '@/storage/contracts';

const artist = 'UCabcdefghijklmnopqrstuv';
const identity = { site: 'youtube' as const, videoId: 'TrackVideo1', artistIds: [artist], channelId: artist };
const blocklist = { ...DEFAULT_BLOCKLIST, tracks: [{ videoId: 'TrackVideo1' }], artists: [{ artistId: artist }], channels: [{ identityType: 'channel-id' as const, channelId: artist }, { identityType: 'handle' as const, handle: '@example' }] };

describe('user rule priority', () => {
  it('uses track > artist > channel for direct-block reasons', () => {
    expect(evaluateUserRules(identity, DEFAULT_ALLOWLIST, blocklist, { artist: true, channel: true })).toBe('block-track');
    expect(evaluateUserRules({ ...identity, videoId: 'OtherVideo1' }, DEFAULT_ALLOWLIST, blocklist, { artist: true, channel: true })).toBe('block-artist');
    expect(evaluateUserRules({ ...identity, videoId: 'OtherVideo1', artistIds: [] }, DEFAULT_ALLOWLIST, blocklist, { artist: true, channel: true })).toBe('block-channel');
    expect(evaluateUserRules({ ...identity, videoId: 'OtherVideo1', artistIds: [], channelId: undefined, channelHandle: '@example' }, DEFAULT_ALLOWLIST, blocklist, { artist: true, channel: true })).toBe('block-channel');
  });
  it('always gives track and artist allowlist priority', () => {
    expect(evaluateUserRules(identity, { ...DEFAULT_ALLOWLIST, tracks: [{ videoId: 'TrackVideo1' }] }, blocklist, { artist: true, channel: true })).toBe('allow');
    expect(evaluateUserRules(identity, { ...DEFAULT_ALLOWLIST, artists: [{ artistId: artist }] }, blocklist, { artist: true, channel: true })).toBe('allow');
  });
  it('gives a track rule priority over a matching channel handle', () => {
    const handleIdentity = { ...identity, channelId: undefined, channelHandle: '@example' };
    expect(evaluateUserRules(handleIdentity, DEFAULT_ALLOWLIST, blocklist, { artist: false, channel: true })).toBe('block-track');
    expect(evaluateUserRules(handleIdentity, { ...DEFAULT_ALLOWLIST, tracks: [{ videoId: 'TrackVideo1' }] }, blocklist, { artist: false, channel: true })).toBe('allow');
  });
  it('does not cross artist/channel kind capability boundaries', () => {
    expect(evaluateUserRules({ ...identity, videoId: 'OtherVideo1' }, DEFAULT_ALLOWLIST, { ...DEFAULT_BLOCKLIST, artists: [{ artistId: artist }] }, { artist: false, channel: true })).toBe('none');
    expect(evaluateUserRules({ ...identity, videoId: 'OtherVideo1' }, DEFAULT_ALLOWLIST, { ...DEFAULT_BLOCKLIST, channels: [{ identityType: 'channel-id', channelId: artist }] }, { artist: true, channel: false })).toBe('none');
    expect(evaluateUserRules({ ...identity, videoId: 'OtherVideo1', artistIds: [], channelId: undefined, channelHandle: '@other' }, DEFAULT_ALLOWLIST, blocklist, { artist: false, channel: true })).toBe('none');
    expect(evaluateUserRules({ ...identity, videoId: 'OtherVideo1', artistIds: [], channelId: undefined, channelHandle: '@Example' }, DEFAULT_ALLOWLIST, blocklist, { artist: false, channel: true })).toBe('none');
    expect(evaluateUserRules({ site: 'youtube-music', videoId: 'OtherVideo1', artistIds: [], channelHandle: '@example' }, DEFAULT_ALLOWLIST, blocklist, { artist: true, channel: false })).toBe('none');
  });
  it('fails closed for malformed identities', () => {
    expect(evaluateUserRules({ site: 'youtube', videoId: 'bad', artistIds: ['bad'], channelId: 'bad' }, DEFAULT_ALLOWLIST, blocklist, { artist: true, channel: true })).toBe('none');
  });
});
