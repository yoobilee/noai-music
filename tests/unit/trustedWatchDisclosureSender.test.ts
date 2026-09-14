import { describe, expect, it } from 'vitest';

import { isTrustedWatchDisclosureSender } from '@/background/trustedWatchDisclosureSender';

describe('watch disclosure message sender boundary', () => {
  it.each([
    'https://www.youtube.com/results?search_query=fixture',
    'https://music.youtube.com/watch?v=PlaybackA01',
  ])('accepts the extension content script on %s', (url) => {
    expect(
      isTrustedWatchDisclosureSender({ id: 'extension-id', url }, 'extension-id'),
    ).toBe(true);
  });

  it.each([
    { id: 'other-extension', url: 'https://music.youtube.com/' },
    { id: 'extension-id', url: 'https://example.com/' },
    { id: 'extension-id', url: 'https://youtube.com/' },
    { id: 'extension-id', url: 'not a url' },
    { id: 'extension-id' },
  ])('rejects an untrusted sender: %o', (sender) => {
    expect(isTrustedWatchDisclosureSender(sender, 'extension-id')).toBe(false);
  });
});
