import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface LocaleMessages {
  youtubeDisclosureReason: { message: string };
}

async function readMessages(locale: 'en' | 'ko'): Promise<LocaleMessages> {
  return JSON.parse(
    await readFile(
      resolve(`src/public/_locales/${locale}/messages.json`),
      'utf8',
    ),
  ) as LocaleMessages;
}

describe('official disclosure reason localization', () => {
  it('uses wording that describes the YouTube disclosure without inferring AI music', async () => {
    const [english, korean] = await Promise.all([
      readMessages('en'),
      readMessages('ko'),
    ]);

    expect(english.youtubeDisclosureReason.message).toBe(
      'NoAI · YouTube AI disclosure',
    );
    expect(korean.youtubeDisclosureReason.message).toBe(
      'NoAI · YouTube AI 표시',
    );
  });
});
