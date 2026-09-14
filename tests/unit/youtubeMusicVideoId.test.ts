import { describe, expect, it } from 'vitest';

import { parseYouTubeMusicWatchVideoId } from '@/adapters/youtube-music/videoId';

describe('YouTube Music watch video ID parser', () => {
  it.each([
    ['/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['watch?v=BaW_jenozKc&list=PL_SANITIZED', 'BaW_jenozKc'],
    [
      'https://music.youtube.com/watch?index=0&list=PL_SANITIZED&v=M7lc1UVf-VE',
      'M7lc1UVf-VE',
    ],
    ['/watch?v=z8Dz-IFFFY4&list=OLAK5uy_SANITIZED', 'z8Dz-IFFFY4'],
  ])('extracts a supported watch URL: %s', (href, expected) => {
    expect(parseYouTubeMusicWatchVideoId(href)).toBe(expected);
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
    '/watch?v=dQw4w9WgXcQ#fragment',
    '/watch?v=dQw4w9WgXcQ&feature=share',
    '/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ&start_radio=1',
    '/browse/MPREb_SANITIZED?v=dQw4w9WgXcQ',
    '/playlist?list=PL_SANITIZED&v=dQw4w9WgXcQ',
    '/channel/UC_SANITIZED?v=dQw4w9WgXcQ',
    '/shorts/dQw4w9WgXcQ',
    '//music.youtube.com/watch?v=dQw4w9WgXcQ',
    'http://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    ' /watch?v=dQw4w9WgXcQ',
    '\\watch?v=dQw4w9WgXcQ',
    'not a URL',
  ])('rejects an unsupported or malformed URL: %s', (href) => {
    expect(parseYouTubeMusicWatchVideoId(href)).toBeNull();
  });
});
