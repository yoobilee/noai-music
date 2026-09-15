import { describe, expect, it } from 'vitest';

import {
  parseAllowlistArtistInput,
  parseAllowlistTrackInput,
} from '@/allowlist/identityInput';

const artistId = 'UCabcdefghijklmnopqrstuv';

describe('allowlist identity input', () => {
  it.each([
    ['TrackVideo1', 'TrackVideo1'],
    [' https://www.youtube.com/watch?v=TrackVideo1 ', 'TrackVideo1'],
    ['https://music.youtube.com/watch?v=TrackVideo1', 'TrackVideo1'],
  ])('accepts a stable track ID or supported watch URL', (input, expected) => {
    expect(parseAllowlistTrackInput(input)).toBe(expected);
  });

  it.each([
    '',
    'short',
    'track title',
    'https://example.com/watch?v=TrackVideo1',
    'https://www.youtube.com/watch?v=invalid',
  ])('rejects an invalid track identity: %s', (input) => {
    expect(parseAllowlistTrackInput(input)).toBeNull();
  });

  it.each([
    [artistId, artistId],
    [`https://www.youtube.com/channel/${artistId}`, artistId],
    [`https://music.youtube.com/channel/${artistId}`, artistId],
    [`https://music.youtube.com/browse/${artistId}`, artistId],
  ])('accepts a stable artist ID or supported channel URL', (input, expected) => {
    expect(parseAllowlistArtistInput(input)).toBe(expected);
  });

  it.each([
    '',
    'artist name',
    'UC_short',
    `https://www.youtube.com/@handle`,
    `https://www.youtube.com/browse/${artistId}`,
    `https://example.com/channel/${artistId}`,
  ])('rejects an invalid artist identity: %s', (input) => {
    expect(parseAllowlistArtistInput(input)).toBeNull();
  });
});
