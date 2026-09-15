import { describe, expect, it } from 'vitest';
import { parseBlocklistArtistInput, parseBlocklistChannelInput, parseBlocklistTrackInput } from '@/blocklist/identityInput';
const channel = 'UCabcdefghijklmnopqrstuv';
describe('blocklist identity input', () => {
  it('accepts exact IDs and supported URLs', () => {
    expect(parseBlocklistTrackInput('TrackVideo1')).toBe('TrackVideo1');
    expect(parseBlocklistTrackInput('https://music.youtube.com/watch?v=TrackVideo1')).toBe('TrackVideo1');
    expect(parseBlocklistArtistInput(`https://www.youtube.com/channel/${channel}`)).toBe(channel);
    expect(parseBlocklistChannelInput(channel)).toEqual({ identityType: 'channel-id', channelId: channel });
    expect(parseBlocklistChannelInput(`https://www.youtube.com/channel/${channel}`)).toEqual({ identityType: 'channel-id', channelId: channel });
  });
  it.each(['bad', 'https://example.com/watch?v=TrackVideo1'])('rejects unsupported or malformed input: %s', (value) => {
    expect(parseBlocklistArtistInput(value)).toBeNull();
    expect(parseBlocklistChannelInput(value)).toBeNull();
  });
  it('keeps handle URLs out of artist identity parsing', () => {
    expect(parseBlocklistArtistInput('https://www.youtube.com/@handle')).toBeNull();
  });
  it('does not accept a YouTube Music artist URL as a channel rule', () => {
    expect(parseBlocklistChannelInput(`https://music.youtube.com/channel/${channel}`)).toBeNull();
  });
  it.each([
    ['@example', '@example'],
    ['https://www.youtube.com/@example', '@example'],
    ['https://www.youtube.com/%40%EB%B8%94%EB%A3%A8%EB%A0%88%EC%9D%B8?view=1#about', '@블루레인'],
  ])('parses exact handle input %s', (input, handle) => {
    expect(parseBlocklistChannelInput(input)).toEqual({ identityType: 'handle', handle });
  });
  it.each(['@', '@1', 'https://www.youtube.com/@', 'https://example.com/@example', 'https://www.youtube.com/watch?v=TrackVideo1'])('rejects malformed handle input %s', (input) => {
    expect(parseBlocklistChannelInput(input)).toBeNull();
  });
});
