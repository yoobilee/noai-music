import { describe, expect, it } from 'vitest';

import { parseYouTubeChannelRouteIdentity } from '@/adapters/youtube/channelRoute';

const channelId = 'UCabcdefghijklmnopqrstuv';

describe('YouTube channel-owned route identity', () => {
  it.each([
    [
      'https://www.youtube.com/@example/videos',
      { surface: 'videos', identityType: 'handle', channelHandle: '@example' },
    ],
    [
      'https://www.youtube.com/%40%EB%B8%94%EB%A3%A8%EB%A0%88%EC%9D%B8/videos?view=0#content',
      {
        surface: 'videos',
        identityType: 'handle',
        channelHandle: '@블루레인',
      },
    ],
    [
      `https://www.youtube.com/channel/${channelId}/videos?view=0#content`,
      { surface: 'videos', identityType: 'channel-id', channelId },
    ],
  ] as const)('parses a supported channel Videos route: %s', (href, expected) => {
    expect(parseYouTubeChannelRouteIdentity(new URL(href))).toEqual(expected);
  });

  it.each([
    'https://www.youtube.com/@/videos',
    'https://www.youtube.com/@1/videos',
    'https://www.youtube.com/%E0%A4%A/videos',
    'http://www.youtube.com/@example/videos',
    'https://example.com/@example/videos',
    'https://user@www.youtube.com/@example/videos',
    'https://www.youtube.com:8443/@example/videos',
    'https://www.youtube.com/@example',
    'https://www.youtube.com/@example/shorts',
    'https://www.youtube.com/@example/streams',
    'https://www.youtube.com/@example/playlists',
    'https://www.youtube.com/@example/community',
    `https://www.youtube.com/channel/${channelId}`,
    `https://www.youtube.com/channel/${channelId}/playlists`,
  ])('rejects an unsupported or malformed route: %s', (href) => {
    expect(parseYouTubeChannelRouteIdentity(new URL(href))).toBeNull();
  });
});
