import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_CONTENT_SCRIPT_MATCHES,
  YOUTUBE_MATCH_PATTERNS,
  YOUTUBE_MUSIC_MATCH_PATTERNS,
} from '@/shared/sites';

describe('content script host scope', () => {
  it('is limited to the two supported YouTube origins', () => {
    expect(YOUTUBE_MATCH_PATTERNS).toEqual(['https://www.youtube.com/*']);
    expect(YOUTUBE_MUSIC_MATCH_PATTERNS).toEqual([
      'https://music.youtube.com/*',
    ]);
    expect(SUPPORTED_CONTENT_SCRIPT_MATCHES).toEqual([
      'https://www.youtube.com/*',
      'https://music.youtube.com/*',
    ]);
  });

  it('does not request broad URL access', () => {
    expect(SUPPORTED_CONTENT_SCRIPT_MATCHES).not.toContain('<all_urls>');
    expect(
      SUPPORTED_CONTENT_SCRIPT_MATCHES.every((pattern) =>
        pattern.startsWith('https://'),
      ),
    ).toBe(true);
  });
});
