import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type Catalog = Record<string, { message: string }>;

async function readCatalog(locale: 'en' | 'ko'): Promise<Catalog> {
  return JSON.parse(
    await readFile(
      resolve(`src/public/_locales/${locale}/messages.json`),
      'utf8',
    ),
  ) as Catalog;
}

describe('UI locale catalogs', () => {
  it('keeps English and Korean message coverage aligned', async () => {
    const [english, korean] = await Promise.all([
      readCatalog('en'),
      readCatalog('ko'),
    ]);

    expect(Object.keys(english).sort()).toEqual(Object.keys(korean).sort());
    for (const key of [
      'languageLabel',
      'languageAuto',
      'languageKorean',
      'languageEnglish',
    ]) {
      expect(english[key]?.message).toBeTruthy();
      expect(korean[key]?.message).toBeTruthy();
    }
  });
});
