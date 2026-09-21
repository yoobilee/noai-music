import { describe, expect, it, vi } from 'vitest';

import {
  createMessageResolver,
  effectiveUiLocale,
  formatCatalogMessage,
  type MessageCatalog,
} from '@/i18n/messages';

const catalog: MessageCatalog = {
  greeting: { message: 'Hello' },
  count: {
    message: '$COUNT$ saved',
    placeholders: { count: { content: '$1' } },
  },
};

describe('application UI messages', () => {
  it('keeps Auto on the browser message resolver and browser locale', () => {
    const autoMessage = vi.fn(() => 'Browser message');
    const message = createMessageResolver('auto', catalog, autoMessage);

    expect(message('greeting')).toBe('Browser message');
    expect(autoMessage).toHaveBeenCalledWith('greeting');
    expect(effectiveUiLocale('auto', 'ko-KR')).toBe('ko-KR');
  });

  it('uses a selected locale catalog and Chrome-style substitutions', () => {
    const autoMessage = vi.fn(() => 'Browser message');
    const message = createMessageResolver('en', catalog, autoMessage);

    expect(message('greeting')).toBe('Hello');
    expect(message('count', '3')).toBe('3 saved');
    expect(effectiveUiLocale('en', 'ko-KR')).toBe('en');
    expect(autoMessage).not.toHaveBeenCalled();
  });

  it('falls back to the browser resolver when a catalog key is absent', () => {
    const message = createMessageResolver(
      'ko',
      catalog,
      () => 'Browser fallback',
    );

    expect(message('missing')).toBe('Browser fallback');
    expect(formatCatalogMessage(catalog, 'missing')).toBe('');
  });
});
