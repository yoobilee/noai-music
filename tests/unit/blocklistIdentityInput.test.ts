import { describe, expect, it } from 'vitest';
import { parseBlocklistArtistInput, parseBlocklistChannelInput, parseBlocklistTrackInput } from '@/blocklist/identityInput';
const channel = 'UCabcdefghijklmnopqrstuv';
describe('blocklist identity input', () => {
  it('accepts exact IDs and supported URLs', () => {
    expect(parseBlocklistTrackInput('TrackVideo1')).toBe('TrackVideo1');
    expect(parseBlocklistTrackInput('https://music.youtube.com/watch?v=TrackVideo1')).toBe('TrackVideo1');
    expect(parseBlocklistArtistInput(`https://www.youtube.com/channel/${channel}`)).toBe(channel);
    expect(parseBlocklistChannelInput(channel)).toBe(channel);
  });
  it.each(['https://www.youtube.com/@handle', 'bad', 'https://example.com/watch?v=TrackVideo1'])('rejects unsupported or malformed input: %s', (value) => {
    expect(parseBlocklistArtistInput(value)).toBeNull();
    expect(parseBlocklistChannelInput(value)).toBeNull();
  });
  it('does not accept a YouTube Music artist URL as a channel rule', () => {
    expect(parseBlocklistChannelInput(`https://music.youtube.com/channel/${channel}`)).toBeNull();
  });
});
