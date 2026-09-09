import { describe, expect, it } from 'vitest';

import { parseYouTubeWatchVideoId } from '@/adapters/youtube/videoId';

describe('YouTube watch video ID parser', () => {
  it.each([
    ['/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['/watch?feature=share&v=BaW_jenozKc&t=10', 'BaW_jenozKc'],
    ['https://www.youtube.com/watch?v=M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://youtube.com/watch?list=PL_TEST&v=z8Dz-IFFFY4&index=3', 'z8Dz-IFFFY4'],
  ])('extracts a supported watch URL: %s', (href, expected) => {
    expect(parseYouTubeWatchVideoId(href)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    '/watch',
    '/watch?v=',
    '/watch?v=too-short',
    '/watch?v=dQw4w9WgXcQ0',
    '/watch?v=dQw4w9WgX%63Q',
    '/watch?%76=dQw4w9WgXcQ',
    '/watch?v=dQw4w9WgXcQ&v=M7lc1UVf-VE',
    '/watch/?v=dQw4w9WgXcQ',
    '/playlist?list=PL_TEST&v=dQw4w9WgXcQ',
    '/channel/UC_TEST?v=dQw4w9WgXcQ',
    '/shorts/dQw4w9WgXcQ',
    '//www.youtube.com/watch?v=dQw4w9WgXcQ',
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    ' /watch?v=dQw4w9WgXcQ',
    '\\watch?v=dQw4w9WgXcQ',
    'not a URL',
  ])('rejects an unsupported or malformed URL: %s', (href) => {
    expect(parseYouTubeWatchVideoId(href)).toBeNull();
  });
});
